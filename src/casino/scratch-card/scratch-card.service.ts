import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, DeepPartial } from 'typeorm';
import { ScratchCardType } from './scratch-card-type.entity';
import {
  ScratchCardTypePrize,
  PrizeType,
} from './scratch-card-type-prize.entity';
import { UserScratchCard, ScratchedPrize } from './user-scratch-card.entity';
import { TitleTaxReduction } from './title-tax-reduction.entity';
import { User } from '../../users/user.entity';
import { UserTitle } from '../../titles/user-title.entity';
import { Title } from '../../titles/title.entity';

@Injectable()
export class ScratchCardService {
  constructor(
    @InjectRepository(ScratchCardType)
    private scratchCardTypeRepo: Repository<ScratchCardType>,
    @InjectRepository(ScratchCardTypePrize)
    private prizeRepo: Repository<ScratchCardTypePrize>,
    @InjectRepository(UserScratchCard)
    private userCardRepo: Repository<UserScratchCard>,
    @InjectRepository(TitleTaxReduction)
    private titleTaxReductionRepo: Repository<TitleTaxReduction>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Title)
    private titleRepo: Repository<Title>,
    private dataSource: DataSource,
  ) {}

  // Get all active card types
  async getActiveCardTypes(): Promise<ScratchCardType[]> {
    try {
      const result = await this.scratchCardTypeRepo.find({
        where: { isActive: true },
        relations: ['prizes'],
        order: { createdAt: 'DESC' },
      });
      console.debug(
        '[ScratchCardService] getActiveCardTypes ->',
        result.length,
      );
      return result;
    } catch (error) {
      console.error('[ScratchCardService] getActiveCardTypes error', error);
      throw error;
    }
  }

  // Get card type by ID with prizes
  async getCardTypeById(id: number): Promise<ScratchCardType> {
    const cardType = await this.scratchCardTypeRepo.findOne({
      where: { id, isActive: true },
      relations: ['prizes'],
    });

    if (!cardType) {
      throw new NotFoundException('Card type not found');
    }

    return cardType;
  }

  // Purchase a scratch card
  async purchaseCard(
    userId: number,
    cardTypeId: number,
  ): Promise<UserScratchCard> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      console.debug('[ScratchCardService] purchaseCard start', {
        userId,
        cardTypeId,
      });
      // Get user and check gold
      const user = await queryRunner.manager.findOne(User, {
        where: { id: userId },
      });
      console.debug('[ScratchCardService] purchaseCard found user', {
        userId,
        user: !!user,
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Get card type
      const cardType = await queryRunner.manager.findOne(ScratchCardType, {
        where: { id: cardTypeId, isActive: true },
        relations: ['prizes'],
      });
      console.debug('[ScratchCardService] purchaseCard found cardType', {
        cardTypeId,
        found: !!cardType,
      });

      if (!cardType) {
        throw new NotFoundException('Card type not found or inactive');
      }

      // Check if user has enough gold
      if (user.gold < cardType.costGold) {
        throw new BadRequestException('Not enough gold');
      }

      // Calculate total positions first
      const totalPositions = cardType.gridRows * cardType.gridCols;

      // Generate player lucky number (1-100, like real lottery scratch cards)
      const playerNumber = Math.floor(Math.random() * 100) + 1;
      console.debug(
        '[ScratchCardService] purchaseCard playerNumber',
        playerNumber,
      );

      // Generate position numbers for each grid position (10% chance to match player number or random 1-100)
      const positionNumbers: number[] = [];
      for (let i = 0; i < totalPositions; i++) {
        // 30% chance to match player's lucky number, 70% chance to be random 1-100
        const shouldMatch = Math.random() < 0.3; // 30% chance to match
        if (shouldMatch) {
          positionNumbers.push(playerNumber); // Match player's lucky number
        } else {
          positionNumbers.push(Math.floor(Math.random() * 100) + 1); // Random 1-100
        }
      }

      console.debug(
        '[ScratchCardService] purchaseCard positionNumbers',
        positionNumbers,
      );

      // Prepare per-user prize placements - distribute prizes randomly across ALL positions
      // Each position gets a prize based on weighted probability
      const placedPrizes = [] as Array<{
        prizeId: number;
        positionRow: number;
        positionCol: number;
      }>;

      // For each position, assign a prize based on weighted probability
      for (let i = 0; i < totalPositions; i++) {
        const row = Math.floor(i / cardType.gridCols);
        const col = i % cardType.gridCols;

        // Compute weighted sum across all prizes
        let totalWeight = 0;
        for (const p of cardType.prizes) {
          totalWeight += p.probabilityWeight ?? 1;
        }

        if (totalWeight <= 0) {
          // No prizes available, skip this position
          continue;
        }

        // Select prize based on weighted probability
        let r = Math.random() * totalWeight;
        let selectedPrize: ScratchCardTypePrize | null = null;

        for (const p of cardType.prizes) {
          const weight = p.probabilityWeight ?? 1;
          if (r < weight) {
            selectedPrize = p;
            break;
          }
          r -= weight;
        }

        if (selectedPrize) {
          placedPrizes.push({
            prizeId: selectedPrize.id,
            positionRow: row,
            positionCol: col,
          });
        }
      }

      console.debug('[ScratchCardService] purchaseCard placements', {
        playerNumber,
        positionNumbers,
        placedPrizesCount: placedPrizes.length,
      });
      // Create user scratch card with placedPrizes stored
      const userCard = queryRunner.manager.create(UserScratchCard, {
        user,
        cardType,
        playerNumber,
        positionNumbers,
        scratchedPositions: [],
        revealedPrizes: [],
        placedPrizes,
        isCompleted: false,
        totalGoldWon: 0,
        totalItemsWon: [],
        taxDeducted: 0,
        finalGoldReceived: 0,
      });

      // Deduct gold from user
      user.gold -= cardType.costGold;
      console.debug(
        '[ScratchCardService] purchaseCard user gold after deduction',
        { userId, gold: user.gold },
      );
      await queryRunner.manager.save(user);

      // Save the card
      const savedCard = await queryRunner.manager.save(userCard);
      console.debug('[ScratchCardService] purchaseCard savedCard', {
        id: savedCard.id,
      });

      await queryRunner.commitTransaction();
      return savedCard;
    } catch (error) {
      console.error(
        '[ScratchCardService] purchaseCard error',
        error && (error.stack || error),
      );
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // Scratch a position on the card
  async scratchPosition(
    userId: number,
    cardId: number,
    row: number,
    col: number,
  ): Promise<ScratchedPrize> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get user card
      const userCard = await queryRunner.manager.findOne(UserScratchCard, {
        where: { id: cardId, user: { id: userId } },
        relations: ['user', 'cardType', 'cardType.prizes'],
      });

      if (!userCard) {
        throw new NotFoundException('Card not found');
      }

      // Defensive: ensure JSON fields are arrays (in case DB returned null)
      if (!userCard.placedPrizes) userCard.placedPrizes = [];
      if (!userCard.scratchedPositions) userCard.scratchedPositions = [];
      if (!userCard.revealedPrizes) userCard.revealedPrizes = [];

      console.debug('[ScratchCardService] scratchPosition', {
        userId,
        cardId,
        row,
        col,
        placedCount: userCard.placedPrizes.length,
        scratchedCount: userCard.scratchedPositions.length,
      });

      if (userCard.isCompleted) {
        throw new BadRequestException('Card is already completed');
      }

      // Check if position is valid
      if (
        row < 0 ||
        row >= userCard.cardType.gridRows ||
        col < 0 ||
        col >= userCard.cardType.gridCols
      ) {
        throw new BadRequestException('Invalid position');
      }

      // Check if position already scratched
      const positionIndex = row * userCard.cardType.gridCols + col;
      if (userCard.scratchedPositions.includes(positionIndex)) {
        throw new BadRequestException('Position already scratched');
      }

      // Find placed prize entry for this user card
      const placed = userCard.placedPrizes.find(
        (pp) => pp.positionRow === row && pp.positionCol === col,
      );

      // Check if this position's number matches the player's lucky number
      const positionNumber = userCard.positionNumbers[positionIndex];
      const isMatchingNumber = positionNumber === userCard.playerNumber;

      console.debug('[ScratchCardService] scratchPosition number check', {
        positionNumber,
        playerNumber: userCard.playerNumber,
        isMatchingNumber,
        hasPlacedPrize: !!placed,
      });

      // We'll always reveal the prize at this position, but only award it if numbers match
      let scratchedPrize: ScratchedPrize;

      if (!placed) {
        // No prize at this position
        scratchedPrize = {
          prizeId: null,
          prizeType: 'none',
          positionRow: row,
          positionCol: col,
          playerNumber: userCard.playerNumber,
          message: `Số ${positionNumber} - Không có phần thưởng`,
        };

        // Update user card with scratched position and revealed message
        userCard.scratchedPositions.push(positionIndex);
        userCard.revealedPrizes.push(scratchedPrize);
      } else {
        // There's a prize here - load it
        let prize: ScratchCardTypePrize | null = null;
        try {
          prize = await queryRunner.manager.findOne(ScratchCardTypePrize, {
            where: { id: placed.prizeId },
          });
        } catch (e) {
          console.error('[ScratchCardService] failed to load prize', {
            prizeId: placed.prizeId,
            error: e && (e.stack || e),
          });
          throw e;
        }

        if (!prize) {
          console.error(
            '[ScratchCardService] prize not found for id',
            placed.prizeId,
          );
          throw new NotFoundException('Prize not found');
        }

        // Always reveal the prize, but only award if numbers match
        if (!isMatchingNumber) {
          // Numbers don't match - show the prize but don't award it
          scratchedPrize = {
            prizeId: prize.id,
            prizeType: prize.prizeType,
            prizeValue: prize.prizeValue,
            prizeQuantity: prize.prizeQuantity,
            positionRow: row,
            positionCol: col,
            playerNumber: userCard.playerNumber,
            message: `Số ${positionNumber} không trùng với số may mắn ${userCard.playerNumber} - Thấy tiếc quá!`,
          };

          userCard.scratchedPositions.push(positionIndex);
          userCard.revealedPrizes.push(scratchedPrize);
        } else {
          // Numbers match - award the prize!
          // Check if prize has reached max claims
          if (prize.maxClaims && prize.claimsCount >= prize.maxClaims) {
            // treat as no prize available
            scratchedPrize = {
              prizeId: null,
              prizeType: 'none',
              positionRow: row,
              positionCol: col,
              playerNumber: userCard.playerNumber,
              message: 'Prize no longer available',
            };

            userCard.scratchedPositions.push(positionIndex);
            userCard.revealedPrizes.push(scratchedPrize);
          } else {
            // Calculate tax for this user
            const taxRate = await this.calculateTaxRate(userId, prize.taxRate);

            // Calculate final amount after tax
            let finalAmount = prize.prizeValue;
            let taxDeducted = 0;

            if (prize.prizeType === PrizeType.GOLD) {
              taxDeducted = Math.floor(prize.prizeValue * taxRate);
              finalAmount = prize.prizeValue - taxDeducted;
            }

            // Create scratched prize object
            scratchedPrize = {
              prizeId: prize.id,
              prizeType: prize.prizeType,
              prizeValue: prize.prizeValue,
              prizeQuantity: prize.prizeQuantity,
              taxDeducted,
              finalAmount,
              positionRow: row,
              positionCol: col,
            };

            // Update user card totals
            if (prize.prizeType === PrizeType.GOLD) {
              userCard.totalGoldWon += prize.prizeValue;
              userCard.taxDeducted += taxDeducted;
              userCard.finalGoldReceived += finalAmount;
            } else if (prize.prizeType === PrizeType.ITEM) {
              const existingItem = userCard.totalItemsWon.find(
                (item) => item.itemId === prize.prizeValue,
              );
              if (existingItem) {
                existingItem.quantity += prize.prizeQuantity;
              } else {
                userCard.totalItemsWon.push({
                  itemId: prize.prizeValue,
                  quantity: prize.prizeQuantity,
                });
              }
            }

            // Update prize claims count (global)
            prize.claimsCount += 1;
            await queryRunner.manager.save(prize);

            // Update user card with scratched position and revealed prize
            userCard.scratchedPositions.push(positionIndex);
            userCard.revealedPrizes.push(scratchedPrize);
          }
        }
      }

      // Check if card is completed
      const totalPositions =
        userCard.cardType.gridRows * userCard.cardType.gridCols;
      if (userCard.scratchedPositions.length >= totalPositions) {
        userCard.isCompleted = true;
        userCard.completedAt = new Date();

        // Award prizes to user
        await this.awardPrizesToUser(queryRunner, userId, userCard);
      }

      // Save user card
      await queryRunner.manager.save(userCard);

      await queryRunner.commitTransaction();
      return scratchedPrize;
    } catch (error) {
      // Log error for easier debugging and rethrow
      console.error(
        '[ScratchCardService] scratchPosition error',
        error && (error.stack || error),
      );
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // Calculate tax rate for user based on titles
  private async calculateTaxRate(
    userId: number,
    baseTaxRate: any,
  ): Promise<number> {
    // Convert baseTaxRate to number if it's a string (from database)
    const taxRate =
      typeof baseTaxRate === 'string'
        ? parseFloat(baseTaxRate) / 100
        : baseTaxRate;

    // TODO: Implement title-based tax reduction later
    // For now, return base tax rate
    return taxRate;
  }
  private async awardPrizesToUser(
    queryRunner: any,
    userId: number,
    userCard: UserScratchCard,
  ): Promise<void> {
    const user = await queryRunner.manager.findOne(User, {
      where: { id: userId },
    });
    if (!user) return;

    // Award gold
    if (userCard.finalGoldReceived > 0) {
      user.gold += userCard.finalGoldReceived;
    }

    // Award items (this would need integration with user inventory system)
    // For now, we'll assume items are added to mailbox or inventory
    // This needs to be implemented based on your inventory system

    await queryRunner.manager.save(user);
  }

  // Get user's scratch cards
  async getUserCards(userId: number): Promise<UserScratchCard[]> {
    return this.userCardRepo.find({
      where: { user: { id: userId } },
      relations: ['cardType'],
      order: { createdAt: 'DESC' },
    });
  }

  // Get specific user card
  async getUserCard(userId: number, cardId: number): Promise<UserScratchCard> {
    const card = await this.userCardRepo.findOne({
      where: { id: cardId, user: { id: userId } },
      relations: ['cardType', 'cardType.prizes'],
    });

    if (!card) {
      throw new NotFoundException('Card not found');
    }

    return card;
  }

  // Admin: Create card type
  async createCardType(data: {
    name: string;
    description?: string;
    backgroundImageUrl?: string;
    costGold: number;
    gridRows?: number;
    gridCols?: number;
  }): Promise<ScratchCardType> {
    // Log and validate payload
    console.debug('[ScratchCardService] createCardType payload', data);
    if (!data || !data.name) {
      throw new BadRequestException('Field "name" is required');
    }

    const payload = {
      name: data.name,
      description: data.description ?? null,
      backgroundImageUrl: data.backgroundImageUrl ?? null,
      costGold: data.costGold ?? 100,
      gridRows: data.gridRows ?? 3,
      gridCols: data.gridCols ?? 3,
    };

    try {
      const cardType = this.scratchCardTypeRepo.create(
        payload as DeepPartial<ScratchCardType>,
      );
      return await this.scratchCardTypeRepo.save(cardType);
    } catch (error) {
      console.error('[ScratchCardService] createCardType error', error);
      throw error;
    }
  }

  // Admin: Add prize to card type
  async addPrizeToCardType(
    cardTypeId: number,
    prizeData: {
      prizeType: PrizeType;
      prizeValue: number;
      prizeQuantity?: number;
      probabilityWeight?: number;
      taxRate?: number;
      maxClaims?: number;
    },
  ): Promise<ScratchCardTypePrize> {
    const cardType = await this.getCardTypeById(cardTypeId);

    const prize = this.prizeRepo.create({
      cardType,
      prizeType: prizeData.prizeType,
      prizeValue: prizeData.prizeValue,
      prizeQuantity: prizeData.prizeQuantity ?? 1,
      probabilityWeight: prizeData.probabilityWeight ?? 1,
      taxRate: prizeData.taxRate ?? 0.1,
      maxClaims: prizeData.maxClaims ?? null,
    });

    return this.prizeRepo.save(prize);
  }

  // Admin: Update an existing prize
  async updatePrize(
    cardTypeId: number,
    prizeId: number,
    data: Partial<{
      prizeType: PrizeType;
      prizeValue: number;
      prizeQuantity?: number;
      probabilityWeight?: number;
      taxRate?: number;
      maxClaims?: number | null;
    }>,
  ): Promise<ScratchCardTypePrize> {
    const prize = await this.prizeRepo.findOne({
      where: { id: prizeId },
      relations: ['cardType'],
    });

    if (!prize || !prize.cardType || prize.cardType.id !== cardTypeId) {
      throw new NotFoundException('Prize not found for this card type');
    }

    if (data.prizeType !== undefined) prize.prizeType = data.prizeType;
    if (data.prizeValue !== undefined) prize.prizeValue = data.prizeValue;
    if (data.prizeQuantity !== undefined)
      prize.prizeQuantity = data.prizeQuantity;
    if (data.probabilityWeight !== undefined)
      prize.probabilityWeight = data.probabilityWeight;
    if (data.taxRate !== undefined) prize.taxRate = data.taxRate;
    if (data.maxClaims !== undefined) prize.maxClaims = data.maxClaims;

    return this.prizeRepo.save(prize);
  }

  // Admin: Delete a prize
  async deletePrize(cardTypeId: number, prizeId: number): Promise<void> {
    const prize = await this.prizeRepo.findOne({
      where: { id: prizeId },
      relations: ['cardType'],
    });

    if (!prize || !prize.cardType || prize.cardType.id !== cardTypeId) {
      throw new NotFoundException('Prize not found for this card type');
    }

    await this.prizeRepo.remove(prize);
  }

  // Admin: Create title tax reduction
  async createTitleTaxReduction(
    titleId: number,
    taxReductionPercentage: number,
  ): Promise<TitleTaxReduction> {
    const title = await this.titleRepo.findOne({ where: { id: titleId } });
    if (!title) {
      throw new NotFoundException('Title not found');
    }

    const taxReduction = this.titleTaxReductionRepo.create({
      title,
      taxReductionPercentage,
    });

    return this.titleTaxReductionRepo.save(taxReduction);
  }

  // Admin: Update card type background image
  async updateCardTypeBackgroundImage(
    cardTypeId: number,
    backgroundImageUrl: string,
  ): Promise<ScratchCardType> {
    const cardType = await this.getCardTypeById(cardTypeId);
    cardType.backgroundImageUrl = backgroundImageUrl;
    return this.scratchCardTypeRepo.save(cardType);
  }

  // Admin: Update card type
  async updateCardType(
    id: number,
    data: Partial<{
      name: string;
      description: string;
      costGold: number;
      gridRows: number;
      gridCols: number;
      isActive: boolean;
    }>,
  ): Promise<ScratchCardType> {
    const cardType = await this.getCardTypeById(id);

    if (data.name !== undefined) cardType.name = data.name;
    if (data.description !== undefined) cardType.description = data.description;
    if (data.costGold !== undefined) cardType.costGold = data.costGold;
    if (data.gridRows !== undefined) cardType.gridRows = data.gridRows;
    if (data.gridCols !== undefined) cardType.gridCols = data.gridCols;
    if (data.isActive !== undefined) cardType.isActive = data.isActive;

    return this.scratchCardTypeRepo.save(cardType);
  }

  // Admin: Delete card type
  async deleteCardType(id: number): Promise<void> {
    const cardType = await this.getCardTypeById(id);
    await this.scratchCardTypeRepo.remove(cardType);
  }
}

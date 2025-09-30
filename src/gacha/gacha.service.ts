import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { GachaBox } from './gacha-box.entity';
import { GachaBoxEntry } from './gacha-box-entry.entity';
import { GachaBoxOpenLog } from './gacha-box-open-log.entity';
import { UserItemsService } from '../user-items/user-items.service';
import { UserItem } from '../user-items/user-item.entity';
import { Item } from '../items/item.entity';
import { ItemType } from '../items/item-types.enum';
import * as crypto from 'crypto';

@Injectable()
export class GachaService {
  constructor(
    @InjectRepository(GachaBox)
    private readonly boxRepo: Repository<GachaBox>,
    @InjectRepository(GachaBoxEntry)
    private readonly entryRepo: Repository<GachaBoxEntry>,
    @InjectRepository(GachaBoxOpenLog)
    private readonly logRepo: Repository<GachaBoxOpenLog>,
    @InjectRepository(Item)
    private readonly itemRepo: Repository<Item>,
    private readonly dataSource: DataSource,
    private readonly userItemsService: UserItemsService,
  ) {}

  private randFromBuffer(
    buf: Buffer,
    offset: number,
  ): { value: number; nextOffset: number } {
    // read 6 bytes as 48-bit number
    const val = buf.readUIntBE(offset, 6);
    return { value: val / 0xffffffffffff, nextOffset: offset + 6 };
  }

  private makeRandomStream(seed?: string) {
    if (!seed) {
      return () => {
        const buf = crypto.randomBytes(6);
        const val = buf.readUIntBE(0, 6);
        return val / 0xffffffffffff;
      };
    }
    // deterministic stream from seed using HMAC-SHA256 with a counter
    let counter = 0;
    let buffer = Buffer.alloc(0);
    return () => {
      if (buffer.length - 6 < 0) {
        const h = crypto.createHmac('sha256', seed);
        h.update(Buffer.from(String(counter++)));
        buffer = Buffer.concat([buffer, h.digest()]);
      }
      const { value, nextOffset } = this.randFromBuffer(buffer, 0);
      buffer = buffer.slice(nextOffset);
      return value;
    };
  }

  async openBox(
    playerId: number,
    boxId: number,
    count: number = 1,
    options?: {
      keyItemId?: number;
      seed?: string;
      userGachaBoxId?: number;
      manager?: EntityManager;
    },
  ) {
    const box = await this.boxRepo.findOne({
      where: { id: boxId },
      relations: ['entries'],
    });
    if (!box || !box.isActive)
      throw new BadRequestException('Box không tồn tại hoặc không hoạt động');

    const entries = await this.entryRepo.find({
      where: { box: { id: boxId } },
    });
    if (!entries || entries.length === 0)
      throw new BadRequestException('Box không có mục nào');

    const awarded: any[] = [];
    const rand = this.makeRandomStream(options?.seed);

    // New group-based selection logic
    const doOpen = async (manager: EntityManager) => {
      // If the box requires a specific key item (stored in metadata) then the
      // caller must provide that keyItemId. Otherwise, if caller provided any
      // keyItemId we will consume it as before.
      // Normalize required key id stored in metadata to a number. Admin UI
      // may have stored it as a string which would cause a strict !== check
      // to fail even when the client sends the matching numeric id.
      const rawRequired = (box.metadata as any)?.requiredKeyItemId;
      const requiredKeyItemId =
        rawRequired != null ? Number(rawRequired) : null;
      if (
        requiredKeyItemId &&
        (typeof options?.keyItemId !== 'number' ||
          options.keyItemId !== requiredKeyItemId)
      ) {
        // include expected/provided ids to help debugging (safe non-sensitive info)
        throw new BadRequestException(
          `Yêu cầu sử dụng key cụ thể để mở hộp (required=${requiredKeyItemId}, provided=${options?.keyItemId ?? 'none'})`,
        );
      }

      // If a keyItemId is provided, ensure the player has and consume one
      if (options?.keyItemId) {
        const existing = await manager.findOne(
          UserItem as any,
          {
            where: { userId: playerId, itemId: options.keyItemId },
          } as any,
        );
        if (!existing || (existing as any).quantity <= 0) {
          throw new BadRequestException('Không có key để mở hộp');
        }
        // decrement or delete
        if ((existing as any).quantity <= 1) {
          await manager.delete(UserItem as any, (existing as any).id);
        } else {
          await manager.update(UserItem as any, { id: (existing as any).id }, {
            quantity: (existing as any).quantity - 1,
          } as any);
        }
      }

      for (let i = 0; i < count; i++) {
        // Partition entries by groupKey (null groups are treated as their own keys)
        const groups: Record<string, GachaBoxEntry[]> = {};
        for (const e of entries) {
          const k = e.groupKey || '__default__';
          groups[k] = groups[k] || [];
          groups[k].push(e);
        }

        const awardedThisOpen: any[] = [];

        for (const [groupKey, groupEntries] of Object.entries(groups)) {
          if (box.openMode === 'single') {
            // If any entries in group have weight, use weighted selection; otherwise pick uniformly
            const weighted = groupEntries.filter(
              (e) => typeof e.weight === 'number' && e.weight > 0,
            );
            let chosen: GachaBoxEntry | undefined;
            if (weighted.length > 0) {
              const total = weighted.reduce((s, e) => s + (e.weight || 0), 0);
              const r = Math.floor(rand() * total);
              let acc = 0;
              for (const e of weighted) {
                acc += e.weight || 0;
                if (r < acc) {
                  chosen = e;
                  break;
                }
              }
            } else {
              // uniform random pick
              const idx = Math.floor(rand() * groupEntries.length);
              chosen = groupEntries[idx];
            }

            if (chosen) {
              const qty =
                chosen.amountMin +
                Math.floor(rand() * (chosen.amountMax - chosen.amountMin + 1));
              if (chosen.itemId) {
                const ui = await manager.findOneBy('user_item', {
                  userId: playerId,
                  itemId: chosen.itemId,
                } as any);
                if (ui) {
                  await manager.update(
                    'user_item',
                    { id: (ui as any).id },
                    { quantity: (ui as any).quantity + qty },
                  );
                } else {
                  await manager.insert('user_item', {
                    userId: playerId,
                    itemId: chosen.itemId,
                    quantity: qty,
                  });
                }
                awardedThisOpen.push({
                  itemId: chosen.itemId,
                  qty,
                  entryId: chosen.id,
                });
              } else if (chosen.itemJson) {
                awardedThisOpen.push({
                  itemJson: chosen.itemJson,
                  qty,
                  entryId: chosen.id,
                });
              }
            }
          } else {
            // multi mode: perform independent probability trials within group; ensure at most one guaranteed award per group
            let groupHadGuaranteed = false;
            for (const e of groupEntries) {
              if (typeof e.probability === 'number') {
                if (rand() < e.probability) {
                  const qty =
                    e.amountMin +
                    Math.floor(rand() * (e.amountMax - e.amountMin + 1));
                  if (e.itemId) {
                    const ui = await manager.findOneBy('user_item', {
                      userId: playerId,
                      itemId: e.itemId,
                    } as any);
                    if (ui) {
                      await manager.update(
                        'user_item',
                        { id: (ui as any).id },
                        { quantity: (ui as any).quantity + qty },
                      );
                    } else {
                      await manager.insert('user_item', {
                        userId: playerId,
                        itemId: e.itemId,
                        quantity: qty,
                      });
                    }
                    awardedThisOpen.push({
                      itemId: e.itemId,
                      qty,
                      entryId: e.id,
                    });
                  } else if (e.itemJson) {
                    awardedThisOpen.push({
                      itemJson: e.itemJson,
                      qty,
                      entryId: e.id,
                    });
                  }
                  if (e.guaranteed) groupHadGuaranteed = true;
                }
              }
            }

            // If nothing hit in this group and group contains guaranteed entries, award one guaranteed entry
            if (!groupHadGuaranteed) {
              const guaranteed = groupEntries.filter((g) => g.guaranteed);
              if (guaranteed.length > 0) {
                const pick = guaranteed[Math.floor(rand() * guaranteed.length)];
                const qty =
                  pick.amountMin +
                  Math.floor(rand() * (pick.amountMax - pick.amountMin + 1));
                if (pick.itemId) {
                  const ui = await manager.findOneBy('user_item', {
                    userId: playerId,
                    itemId: pick.itemId,
                  } as any);
                  if (ui) {
                    await manager.update(
                      'user_item',
                      { id: (ui as any).id },
                      { quantity: (ui as any).quantity + qty },
                    );
                  } else {
                    await manager.insert('user_item', {
                      userId: playerId,
                      itemId: pick.itemId,
                      quantity: qty,
                    });
                  }
                  awardedThisOpen.push({
                    itemId: pick.itemId,
                    qty,
                    entryId: pick.id,
                  });
                } else if (pick.itemJson) {
                  awardedThisOpen.push({
                    itemJson: pick.itemJson,
                    qty,
                    entryId: pick.id,
                  });
                }
              }
            }
          }
        }

        // After processing groups, apply immediate guarantee: if box has any guaranteed entries and none awardedThisOpen had guaranteed, award one guaranteed entry globally
        const awardedHasGuaranteed = awardedThisOpen.some((a) => {
          try {
            const entry = entries.find((en) => en.id === a.entryId);
            return entry?.guaranteed;
          } catch {
            return false;
          }
        });
        if (!awardedHasGuaranteed) {
          const allGuaranteed = entries.filter((e) => e.guaranteed);
          if (allGuaranteed.length > 0) {
            const pick =
              allGuaranteed[Math.floor(rand() * allGuaranteed.length)];
            const qty =
              pick.amountMin +
              Math.floor(rand() * (pick.amountMax - pick.amountMin + 1));
            if (pick.itemId) {
              const ui = await manager.findOneBy('user_item', {
                userId: playerId,
                itemId: pick.itemId,
              } as any);
              if (ui) {
                await manager.update(
                  'user_item',
                  { id: (ui as any).id },
                  { quantity: (ui as any).quantity + qty },
                );
              } else {
                await manager.insert('user_item', {
                  userId: playerId,
                  itemId: pick.itemId,
                  quantity: qty,
                });
              }
              awardedThisOpen.push({
                itemId: pick.itemId,
                qty,
                entryId: pick.id,
              });
            } else if (pick.itemJson) {
              awardedThisOpen.push({
                itemJson: pick.itemJson,
                qty,
                entryId: pick.id,
              });
            }
          }
        }

        // merge awardedThisOpen into awarded
        awarded.push(...awardedThisOpen);
      }

      // Persist log inside transaction
      const log = manager.create(GachaBoxOpenLog as any, {
        playerId,
        boxId,
        awarded,
        seed: options?.seed || null,
        userGachaBoxId: options?.userGachaBoxId || null,
      });
      await manager.save(log as any);
    };

    if (options?.manager) {
      await doOpen(options.manager);
    } else {
      await this.dataSource.transaction(async (manager) => {
        await doOpen(manager);
      });
    }

    return { success: true, awarded };
  }

  // Consume a user_item (stackable) and open the mapped gacha box atomically
  async openBoxFromUserItem(
    playerId: number,
    userItemId: number,
    keyItemId?: number,
  ) {
    return this.dataSource.transaction(async (manager) => {
      // find the user_item row
      const ui = await manager.findOne(
        UserItem as any,
        { where: { id: userItemId, userId: playerId } } as any,
      );
      if (!ui || (ui as any).quantity <= 0)
        throw new BadRequestException('Không có hộp trong kho');

      // find the item to get gacha_box mapping
      const item = await manager.findOne(
        Item as any,
        { where: { id: (ui as any).itemId } } as any,
      );
      if (!item || !item.gachaBoxId)
        throw new BadRequestException('Item không phải là gacha box');

      // consume one
      if ((ui as any).quantity <= 1) {
        await manager.delete(UserItem as any, (ui as any).id);
      } else {
        await manager.update(UserItem as any, { id: (ui as any).id }, {
          quantity: (ui as any).quantity - 1,
        } as any);
      }

      // call openBox sharing this transaction manager so logging and awarding happen atomically
      return this.openBox(playerId, item.gachaBoxId, 1, { manager, keyItemId });
    });
  }

  // Entry admin CRUD
  async addEntry(boxId: number, payload: Partial<GachaBoxEntry>) {
    const entry = this.entryRepo.create({
      ...(payload as any),
      box: { id: boxId } as any,
    } as any);
    return this.entryRepo.save(entry as any);
  }

  async updateEntry(entryId: number, payload: Partial<GachaBoxEntry>) {
    await this.entryRepo.update(entryId, payload as any);
    return this.entryRepo.findOne({ where: { id: entryId } });
  }

  // Return public box info for players: entries with item name and display rate
  async getBoxPublic(boxId: number) {
    const box = await this.boxRepo.findOne({ where: { id: boxId } });
    if (!box || !box.isActive)
      throw new BadRequestException('Box không tồn tại hoặc không hoạt động');
    const entries = await this.entryRepo.find({
      where: { box: { id: boxId } },
    });

    // If openMode is 'single' and some entries have weight, compute normalized weights
    let totalWeight = 0;
    const hasWeight = entries.some(
      (e) => typeof e.weight === 'number' && e.weight > 0,
    );
    if (hasWeight)
      totalWeight = entries.reduce((s, e) => s + (Number(e.weight) || 0), 0);

    const formatted = await Promise.all(
      entries.map(async (e) => {
        let itemName: string | null = null;
        if (e.itemId) {
          try {
            const it = await this.itemRepo.findOne({ where: { id: e.itemId } });
            itemName = it ? it.name : null;
          } catch {
            itemName = null;
          }
        }
        const displayRate = (() => {
          if (box.openMode === 'single') {
            if (hasWeight) {
              return totalWeight > 0 ? Number(e.weight || 0) / totalWeight : 0;
            }
            // uniform among entries in group — but for simplicity return 1/entries.length
            return entries.length > 0 ? 1 / entries.length : 0;
          } else {
            // multi mode uses probability field
            return typeof e.probability === 'number' ? e.probability : null;
          }
        })();

        return {
          id: e.id,
          itemId: e.itemId || null,
          itemName,
          amountMin: e.amountMin,
          amountMax: e.amountMax,
          probability: typeof e.probability === 'number' ? e.probability : null,
          weight: typeof e.weight === 'number' ? e.weight : null,
          guaranteed: !!e.guaranteed,
          groupKey: e.groupKey || null,
          displayRate,
        };
      }),
    );

    return {
      id: box.id,
      name: box.name,
      openMode: box.openMode,
      entries: formatted,
      metadata: (box as any).metadata || null,
    };
  }
  async deleteEntry(entryId: number) {
    await this.entryRepo.delete(entryId);
    return { success: true };
  }

  async createBox(payload: Partial<GachaBox>) {
    const box = this.boxRepo.create(payload as any);
    const saved = await this.boxRepo.save(box as any);

    // Ensure there is a catalog Item that maps to this gacha box (so the box
    // can be stored in inventory). If one already exists, do nothing.
    try {
      const existing = await this.itemRepo.findOne({
        where: { gachaBoxId: saved.id },
      });
      if (!existing) {
        const it = this.itemRepo.create({
          name: saved.name,
          type: ItemType.CONSUMABLE,
          rarity: 1,
          price: 0,
          tradable: true,
          stats: null,
          classRestrictions: null,
          setId: null,
          consumableValue: null,
          duration: null,
          consumableEffect: null,
          image: null,
          gachaBoxId: saved.id,
        } as any);
        await this.itemRepo.save(it as any);
      }
    } catch (err) {
      // Don't fail box creation if item creation fails; log and continue.
      console.error(
        '[GachaService] failed to auto-create catalog Item for box',
        saved.id,
        err,
      );
    }

    return saved;
  }

  async updateBox(id: number, payload: Partial<GachaBox>) {
    await this.boxRepo.update(id, payload as any);
    return this.boxRepo.findOne({ where: { id } });
  }

  async deleteBox(id: number) {
    // Delete box and its catalog Item mapping if present.
    const box = await this.boxRepo.findOne({ where: { id } });
    if (!box) return { success: false };

    try {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
      try {
        // Find items that map to this box
        const items = await queryRunner.manager.find(
          Item as any,
          { where: { gachaBoxId: id } } as any,
        );

        // Check ownership for each item; if any user owns it, abort
        for (const it of items) {
          const res = await queryRunner.query(
            'SELECT COUNT(*)::int AS cnt FROM user_item WHERE "itemId" = $1',
            [it.id],
          );
          const cnt =
            res &&
            res[0] &&
            (res[0].cnt ?? res[0].count ?? Object.values(res[0])[0]);
          const num =
            typeof cnt === 'string' ? parseInt(cnt, 10) : Number(cnt || 0);
          if (num > 0) {
            await queryRunner.rollbackTransaction();
            await queryRunner.release();
            return {
              success: false,
              message: 'Cannot delete box: its catalog item is owned by users',
            };
          }
        }

        // Safe to delete items and box
        if (items.length > 0) {
          await queryRunner.manager.delete('item', { gachaBoxId: id } as any);
        }
        await queryRunner.manager.delete('gacha_box', { id } as any);

        await queryRunner.commitTransaction();
        await queryRunner.release();
        return { success: true };
      } catch (err) {
        await queryRunner.rollbackTransaction();
        await queryRunner.release();
        throw err;
      }
    } catch (err) {
      console.error('[GachaService] deleteBox error:', err);
      return { success: false };
    }
  }

  // Create catalog Items for any existing GachaBox that doesn't have one.
  async backfillCatalogItems() {
    const boxes = await this.boxRepo.find();
    const created: { boxId: number; itemId: number }[] = [];
    for (const b of boxes) {
      const existing = await this.itemRepo.findOne({
        where: { gachaBoxId: b.id },
      });
      if (!existing) {
        const it = this.itemRepo.create({
          name: b.name,
          type: ItemType.CONSUMABLE,
          rarity: 1,
          price: 0,
          tradable: true,
          stats: null,
          classRestrictions: null,
          setId: null,
          consumableValue: null,
          duration: null,
          consumableEffect: null,
          image: null,
          gachaBoxId: b.id,
        } as any);
        const saved = await this.itemRepo.save(it as any);
        created.push({ boxId: b.id, itemId: saved.id });
      }
    }
    return { created };
  }

  // Admin read helpers
  async listBoxes() {
    return this.boxRepo.find({ relations: ['entries'] });
  }

  async getBox(id: number) {
    return this.boxRepo.findOne({ where: { id }, relations: ['entries'] });
  }
}

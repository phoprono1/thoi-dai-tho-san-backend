import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Donor, DonorStatus, DonorTier } from './donor.entity';
import { User } from '../users/user.entity';
import {
  CreateDonorDto,
  UpdateDonorDto,
  DonorResponseDto,
  DonorStatsDto,
} from './donor.dto';

@Injectable()
export class DonorService {
  constructor(
    @InjectRepository(Donor)
    private donorRepository: Repository<Donor>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async createDonor(dto: CreateDonorDto): Promise<DonorResponseDto> {
    // Verify user exists
    const user = await this.userRepository.findOne({
      where: { id: dto.userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Determine tier based on amount
    const tier = this.calculateTier(dto.amount);

    const donor = this.donorRepository.create({
      ...dto,
      tier,
      status: DonorStatus.ACTIVE,
    });

    const savedDonor = await this.donorRepository.save(donor);
    return this.mapToResponseDto(savedDonor);
  }

  async getAllDonors(): Promise<DonorResponseDto[]> {
    const donors = await this.donorRepository.find({
      relations: ['user'],
      order: { donationDate: 'DESC' },
    });

    return donors.map((donor) => this.mapToResponseDto(donor));
  }

  async getDonorById(id: number): Promise<DonorResponseDto> {
    const donor = await this.donorRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!donor) {
      throw new NotFoundException('Donor not found');
    }

    return this.mapToResponseDto(donor);
  }

  async getDonorsByUser(userId: number): Promise<DonorResponseDto[]> {
    const donors = await this.donorRepository.find({
      where: { userId },
      relations: ['user'],
      order: { donationDate: 'DESC' },
    });

    return donors.map((donor) => this.mapToResponseDto(donor));
  }

  async updateDonor(
    id: number,
    dto: UpdateDonorDto,
  ): Promise<DonorResponseDto> {
    const donor = await this.donorRepository.findOne({
      where: { id },
    });

    if (!donor) {
      throw new NotFoundException('Donor not found');
    }

    Object.assign(donor, dto);
    const updatedDonor = await this.donorRepository.save(donor);

    return this.mapToResponseDto(updatedDonor);
  }

  async deleteDonor(id: number): Promise<void> {
    const donor = await this.donorRepository.findOne({
      where: { id },
    });

    if (!donor) {
      throw new NotFoundException('Donor not found');
    }

    await this.donorRepository.remove(donor);
  }

  async getDonorStats(): Promise<DonorStatsDto> {
    const donors = await this.donorRepository.find({
      order: { donationDate: 'DESC' },
    });

    const totalDonors = donors.length;
    const totalAmount = donors.reduce(
      (sum, donor) => sum + Number(donor.amount),
      0,
    );

    const tierBreakdown = {
      [DonorTier.BRONZE]: 0,
      [DonorTier.SILVER]: 0,
      [DonorTier.GOLD]: 0,
      [DonorTier.PLATINUM]: 0,
      [DonorTier.DIAMOND]: 0,
    };

    donors.forEach((donor) => {
      tierBreakdown[donor.tier]++;
    });

    const recentDonations = donors
      .slice(0, 10)
      .map((donor) => this.mapToResponseDto(donor));

    return {
      totalDonors,
      totalAmount,
      tierBreakdown,
      recentDonations,
    };
  }

  async getTopDonors(limit: number = 10): Promise<DonorResponseDto[]> {
    const donors = await this.donorRepository
      .createQueryBuilder('donor')
      .leftJoinAndSelect('donor.user', 'user')
      .orderBy('donor.amount', 'DESC')
      .limit(limit)
      .getMany();

    return donors.map((donor) => this.mapToResponseDto(donor));
  }

  private calculateTier(amount: number): DonorTier {
    if (amount >= 500) return DonorTier.DIAMOND;
    if (amount >= 101) return DonorTier.PLATINUM;
    if (amount >= 51) return DonorTier.GOLD;
    if (amount >= 11) return DonorTier.SILVER;
    return DonorTier.BRONZE;
  }

  private mapToResponseDto(donor: Donor): DonorResponseDto {
    return {
      id: donor.id,
      userId: donor.userId,
      username: donor.username,
      amount: Number(donor.amount),
      currency: donor.currency,
      tier: donor.tier,
      message: donor.message,
      donationDate: donor.donationDate,
      status: donor.status,
      isAnonymous: donor.isAnonymous,
      metadata: donor.metadata,
      createdAt: donor.createdAt,
      updatedAt: donor.updatedAt,
    };
  }
}

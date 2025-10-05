import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';
import { PetBanner } from './pet-banner.entity';

@Entity('user_pet_banner_pity')
@Index(['userId', 'bannerId'], { unique: true })
export class UserPetBannerPity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  bannerId: number;

  @Column({ default: 0 })
  pullCount: number; // Count towards guaranteed (same as pityCount)

  @Column({ default: 0 })
  totalPulls: number; // Total pulls ever made

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastPullDate: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => PetBanner, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bannerId' })
  banner: PetBanner;

  // Helper methods
  isGuaranteedNext(banner: PetBanner): boolean {
    return this.pullCount >= banner.guaranteedPullCount;
  }

  getRemainingForGuaranteed(banner: PetBanner): number {
    return Math.max(0, banner.guaranteedPullCount - this.pullCount);
  }

  addPull(): void {
    this.pullCount++;
    this.totalPulls++;
    this.lastPullDate = new Date();
  }

  resetPity(): void {
    this.pullCount = 0;
    this.lastPullDate = new Date();
  }

  getPityProgress(banner: PetBanner): number {
    return Math.min(1, this.pullCount / banner.guaranteedPullCount);
  }

  getPityProgressPercentage(banner: PetBanner): number {
    return Math.round(this.getPityProgress(banner) * 100);
  }

  getDaysSinceLastPull(): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - this.lastPullDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  getStatsSummary(banner: PetBanner) {
    return {
      totalPulls: this.totalPulls,
      pityCount: this.pullCount,
      guaranteedNext: this.isGuaranteedNext(banner),
      remainingForGuaranteed: this.getRemainingForGuaranteed(banner),
      pityProgressPercentage: this.getPityProgressPercentage(banner),
      daysSinceLastPull: this.getDaysSinceLastPull(),
    };
  }
}

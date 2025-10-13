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

  // New: store per-threshold counters as jsonb
  // Example: { "4": 3, "5": 12 } meaning 3 pulls towards 4★ pity and 12 towards 5★ pity
  @Column({ type: 'jsonb', nullable: true })
  thresholdCounters: Record<string, number> | null;

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
  // Determine if the NEXT pull should be guaranteed.
  // Use pullCount + 1 >= guaranteedPullCount so that guarantee occurs on the Nth pull.
  isGuaranteedNext(banner: PetBanner): boolean {
    // Use the highest applicable threshold (legacy support)
    const thresholds = banner.getPityThresholds();
    // If thresholdCounters not set, fall back to legacy pullCount
    if (!this.thresholdCounters) {
      return this.pullCount + 1 >= thresholds[thresholds.length - 1].pullCount;
    }

    // Check each threshold to see if next pull would trigger any
    for (const t of thresholds) {
      const key = String(t.rarity);
      const current = this.thresholdCounters?.[key] ?? 0;
      if (current + 1 >= t.pullCount) {
        return true;
      }
    }

    return false;
  }

  getRemainingForGuaranteed(banner: PetBanner): number {
    const thresholds = banner.getPityThresholds();
    if (!this.thresholdCounters) {
      return Math.max(
        0,
        thresholds[thresholds.length - 1].pullCount - this.pullCount,
      );
    }
    // Return smallest remaining among thresholds
    let minRemaining = Number.MAX_SAFE_INTEGER;
    for (const t of thresholds) {
      const key = String(t.rarity);
      const current = this.thresholdCounters[key] ?? 0;
      const remaining = Math.max(0, t.pullCount - current);
      if (remaining < minRemaining) minRemaining = remaining;
    }
    return minRemaining === Number.MAX_SAFE_INTEGER ? 0 : minRemaining;
  }

  addPull(): void {
    this.pullCount++;
    this.totalPulls++;
    this.lastPullDate = new Date();
    // increment all threshold counters
    if (!this.thresholdCounters) this.thresholdCounters = {};
    for (const key of Object.keys(this.thresholdCounters)) {
      this.thresholdCounters[key] = (this.thresholdCounters[key] || 0) + 1;
    }
  }

  resetPity(): void {
    this.pullCount = 0;
    this.lastPullDate = new Date();
    if (this.thresholdCounters) {
      for (const key of Object.keys(this.thresholdCounters)) {
        this.thresholdCounters[key] = 0;
      }
    }
  }

  // Increment a specific rarity threshold counter (e.g., after a guarantee triggered)
  incrementThreshold(rarity: number): void {
    if (!this.thresholdCounters) this.thresholdCounters = {};
    const key = String(rarity);
    this.thresholdCounters[key] = (this.thresholdCounters[key] || 0) + 1;
  }

  // Reset a specific threshold counter
  resetThreshold(rarity: number): void {
    if (!this.thresholdCounters)
      this.thresholdCounters = this.thresholdCounters || {};
    const key = String(rarity);
    this.thresholdCounters[key] = 0;
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

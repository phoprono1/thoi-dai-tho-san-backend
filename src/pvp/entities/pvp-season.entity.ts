import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum HunterRank {
  APPRENTICE = 'APPRENTICE',        // Thợ Săn Tập Sự (0-999)
  AMATEUR = 'AMATEUR',              // Thợ Săn Nghiệp Dư (1000-1499)  
  PROFESSIONAL = 'PROFESSIONAL',    // Thợ Săn Chuyên Nghiệp (1500-1999)
  ELITE = 'ELITE',                  // Thợ Săn Tinh Anh (2000-2499)
  EPIC = 'EPIC',                    // Thợ Săn Sử Thi (2500-2999)
  LEGENDARY = 'LEGENDARY',          // Thợ Săn Truyền Thuyết (3000-3499)
  MYTHICAL = 'MYTHICAL',            // Thợ Săn Huyền Thoại (3500-3999)
  DIVINE = 'DIVINE',                // Thợ Săn Thần Thoại (4000+)
}

export const RANK_THRESHOLDS = {
  [HunterRank.APPRENTICE]: { min: 0, max: 999 },
  [HunterRank.AMATEUR]: { min: 1000, max: 1499 },
  [HunterRank.PROFESSIONAL]: { min: 1500, max: 1999 },
  [HunterRank.ELITE]: { min: 2000, max: 2499 },
  [HunterRank.EPIC]: { min: 2500, max: 2999 },
  [HunterRank.LEGENDARY]: { min: 3000, max: 3499 },
  [HunterRank.MYTHICAL]: { min: 3500, max: 3999 },
  [HunterRank.DIVINE]: { min: 4000, max: 999999 },
};

export const RANK_NAMES = {
  [HunterRank.APPRENTICE]: 'Thợ Săn Tập Sự',
  [HunterRank.AMATEUR]: 'Thợ Săn Nghiệp Dư',
  [HunterRank.PROFESSIONAL]: 'Thợ Săn Chuyên Nghiệp',
  [HunterRank.ELITE]: 'Thợ Săn Tinh Anh',
  [HunterRank.EPIC]: 'Thợ Săn Sử Thi',
  [HunterRank.LEGENDARY]: 'Thợ Săn Truyền Thuyết',
  [HunterRank.MYTHICAL]: 'Thợ Săn Huyền Thoại',
  [HunterRank.DIVINE]: 'Thợ Săn Thần Thoại',
};

@Entity('pvp_seasons')
export class PvpSeason {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'timestamp' })
  startDate: Date;

  @Column({ type: 'timestamp' })
  endDate: Date;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'json', nullable: true })
  rewards: {
    daily: {
      [key in HunterRank]: {
        gold: number;
        experience: number;
        items?: Array<{ itemId: number; quantity: number }>;
      };
    };
    seasonal: {
      top1: { gold: number; experience: number; items?: Array<{ itemId: number; quantity: number }> };
      top2to3: { gold: number; experience: number; items?: Array<{ itemId: number; quantity: number }> };
      top4to10: { gold: number; experience: number; items?: Array<{ itemId: number; quantity: number }> };
    };
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  get isCurrentSeason(): boolean {
    const now = new Date();
    return this.isActive && now >= this.startDate && now <= this.endDate;
  }

  get daysRemaining(): number {
    const now = new Date();
    const diff = this.endDate.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }
}

// Helper function to calculate rank from points
export function calculateRank(points: number): HunterRank {
  for (const [rank, threshold] of Object.entries(RANK_THRESHOLDS)) {
    if (points >= threshold.min && points <= threshold.max) {
      return rank as HunterRank;
    }
  }
  return HunterRank.DIVINE; // Default to highest rank if points exceed all thresholds
}

// ELO calculation function
export function calculateEloChange(
  playerRating: number,
  opponentRating: number,
  isWin: boolean,
  kFactor: number = 32
): number {
  const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  const actualScore = isWin ? 1 : 0;
  return Math.round(kFactor * (actualScore - expectedScore));
}

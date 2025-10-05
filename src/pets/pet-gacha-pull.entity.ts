import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';
import { PetBanner } from './pet-banner.entity';
import { PetDefinition } from './pet-definition.entity';

export type PullType = 'single' | 'multi_10' | 'guaranteed';

@Entity('pet_gacha_pulls')
@Index(['userId', 'bannerId'])
@Index(['userId', 'pulledAt'])
export class PetGachaPull {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  bannerId: number;

  @Column()
  petObtainedId: number;

  @Column({
    type: 'varchar',
  })
  pullType: PullType;

  @Column({ default: false })
  wasGuaranteed: boolean;

  @Column({ default: false })
  wasFeatured: boolean;

  @CreateDateColumn()
  pulledAt: Date;

  // Relations
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => PetBanner, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bannerId' })
  banner: PetBanner;

  @ManyToOne(() => PetDefinition)
  @JoinColumn({ name: 'petObtainedId' })
  pet: PetDefinition;

  // Helper methods
  isMultiPull(): boolean {
    return this.pullType === 'multi_10';
  }

  getPullSummary() {
    return {
      id: this.id,
      petObtainedId: this.petObtainedId,
      pullType: this.pullType,
      wasGuaranteed: this.wasGuaranteed,
      wasFeatured: this.wasFeatured,
      timestamp: this.pulledAt,
    };
  }
}

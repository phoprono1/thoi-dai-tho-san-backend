import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  AbilityType,
  TargetType,
  AbilityEffects,
} from '../interfaces/pet-ability.interface';

@Entity('pet_abilities')
export class PetAbility {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 20 })
  type: AbilityType;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb' })
  effects: AbilityEffects;

  @Column({ default: 0 })
  cooldown: number;

  @Column({ default: 0 })
  manaCost: number;

  @Column({ type: 'varchar', length: 20 })
  targetType: TargetType;

  @Column({ nullable: true })
  icon: string;

  @Column({ default: 1 })
  rarity: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

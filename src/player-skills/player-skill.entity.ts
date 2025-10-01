import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { SkillDefinition } from './skill-definition.entity';

export type SkillId = string; // Now dynamic, not enum

// Legacy interface for backward compatibility - will be removed
export interface SkillDefinitionLegacy {
  id: SkillId;
  name: string;
  description: string;
  maxLevel: number;
  requiredAttribute: 'STR' | 'INT' | 'DEX' | 'VIT' | 'LUK';
  requiredAttributeValue: number;
  requiredLevel: number;
  skillPointCost: number;
  effects: {
    [level: number]: {
      statBonuses?: {
        attack?: number;
        defense?: number;
        maxHp?: number;
        critRate?: number;
        critDamage?: number;
        dodgeRate?: number;
        accuracy?: number;
        lifesteal?: number;
        armorPen?: number;
        comboRate?: number;
      };
      specialEffects?: string[];
    };
  };
}

@Entity('player_skills')
export class PlayerSkill {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  @JoinColumn()
  user: User;

  @Column()
  userId: number;

  @ManyToOne(() => SkillDefinition)
  @JoinColumn()
  skillDefinition: SkillDefinition;

  @Column()
  skillDefinitionId: number;

  @Column({ default: 1 })
  level: number;

  @Column({ default: false })
  isEquipped: boolean;

  @CreateDateColumn()
  unlockedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper method to get skill definition data
  getSkillDefinition(): SkillDefinitionLegacy {
    return this.skillDefinition.toSkillDefinition();
  }

  // Helper method to check if can level up
  canLevelUp(): boolean {
    return this.level < this.skillDefinition.maxLevel;
  }

  // Helper method to get current effects
  getCurrentEffects() {
    return this.skillDefinition.getEffectForLevel(this.level);
  }
}

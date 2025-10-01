import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type SkillId = string; // Now dynamic, not enum

export interface SkillEffect {
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
  // For active skills
  damage?: number;
  healing?: number;
  buffDuration?: number;
  debuffDuration?: number;
}

export interface SkillDefinitionData {
  id: SkillId;
  name: string;
  description: string;
  maxLevel: number;
  requiredAttribute: 'STR' | 'INT' | 'DEX' | 'VIT' | 'LUK';
  requiredAttributeValue: number;
  requiredLevel: number;
  skillPointCost: number;
  effects: {
    [level: number]: SkillEffect;
  };
  isActive: boolean;
  sortOrder: number;
  category?: string; // e.g., 'Combat', 'Magic', 'Agility', 'Vitality', 'Luck'
  // Active skill properties
  skillType: 'passive' | 'active' | 'toggle';
  manaCost?: number;
  cooldown?: number;
  targetType?: 'self' | 'enemy' | 'ally' | 'aoe_enemies' | 'aoe_allies';
  damageType?: 'physical' | 'magical';
  damageFormula?: string; // e.g., "INT * 2 + level * 10"
  healingFormula?: string;
  image?: string; // Path to skill icon image
}

@Entity('skill_definitions')
export class SkillDefinition {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  skillId: SkillId; // Unique identifier like 'power_strike'

  @Column()
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ default: 5 })
  maxLevel: number;

  @Column({
    type: 'enum',
    enum: ['STR', 'INT', 'DEX', 'VIT', 'LUK'],
  })
  requiredAttribute: 'STR' | 'INT' | 'DEX' | 'VIT' | 'LUK';

  @Column({ default: 0 })
  requiredAttributeValue: number;

  @Column({ default: 1 })
  requiredLevel: number;

  @Column({ default: 1 })
  skillPointCost: number;

  @Column({ type: 'json' })
  effects: {
    [level: number]: SkillEffect;
  };

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ nullable: true })
  category: string;

  @Column({
    type: 'enum',
    enum: ['passive', 'active', 'toggle'],
    default: 'passive',
  })
  skillType: 'passive' | 'active' | 'toggle';

  @Column({ type: 'int', nullable: true })
  manaCost: number;

  @Column({ type: 'int', nullable: true })
  cooldown: number;

  @Column({
    type: 'enum',
    enum: ['self', 'enemy', 'ally', 'aoe_enemies', 'aoe_allies'],
    nullable: true,
  })
  targetType: 'self' | 'enemy' | 'ally' | 'aoe_enemies' | 'aoe_allies';

  @Column({
    type: 'enum',
    enum: ['physical', 'magical'],
    nullable: true,
  })
  damageType: 'physical' | 'magical';

  @Column({ nullable: true })
  damageFormula: string;

  @Column({ nullable: true })
  healingFormula: string;

  @Column({ nullable: true, type: 'varchar', length: 500 })
  image: string; // Path to skill icon image like /assets/skills/xxx.webp

  // Skill Prerequisites and Restrictions
  @Column({ type: 'json', default: () => "'[]'" })
  prerequisites: string[]; // Array of skillIds that must be unlocked first

  @Column({ type: 'json', default: () => "'{}'}" })
  requiredSkillLevels: Record<string, number>; // { "power_strike": 3 }

  @Column({ type: 'json', default: () => "'[]'" })
  classRestrictions: string[]; // Array of class names, empty = all classes

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper method to get effect for a specific level
  getEffectForLevel(level: number): SkillEffect | null {
    return this.effects[level] || null;
  }

  // Helper method to check if skill can be unlocked
  canBeUnlocked(userLevel: number, userAttributeValue: number): boolean {
    return (
      userLevel >= this.requiredLevel &&
      userAttributeValue >= this.requiredAttributeValue
    );
  }

  // Convert to the format expected by the skill system
  toSkillDefinition(): SkillDefinitionData {
    return {
      id: this.skillId,
      name: this.name,
      description: this.description,
      maxLevel: this.maxLevel,
      requiredAttribute: this.requiredAttribute,
      requiredAttributeValue: this.requiredAttributeValue,
      requiredLevel: this.requiredLevel,
      skillPointCost: this.skillPointCost,
      effects: this.effects,
      isActive: this.isActive,
      sortOrder: this.sortOrder,
      category: this.category,
      skillType: this.skillType,
      manaCost: this.manaCost,
      cooldown: this.cooldown,
      targetType: this.targetType,
      damageType: this.damageType,
      damageFormula: this.damageFormula,
      healingFormula: this.healingFormula,
    };
  }
}

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { PetDefinition } from './pet-definition.entity';
import { Item } from '../items/item.entity';

export interface StatIncrease {
  attack?: number;
  defense?: number;
  hp?: number;
  critRate?: number;
  critDamage?: number;
}

/**
 * Pet Upgrade Materials
 * Defines what materials are needed to upgrade a pet from one level to the next
 */
@Entity('pet_upgrade_materials')
@Index(['petDefinitionId', 'level'])
export class PetUpgradeMaterial {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => PetDefinition)
  @JoinColumn({ name: 'petDefinitionId' })
  petDefinition: PetDefinition;

  @Column()
  petDefinitionId: number;

  @Column({ type: 'int' })
  level: number; // Target level (e.g., materials needed to reach level 2)

  @ManyToOne(() => Item, { eager: true, nullable: true })
  @JoinColumn({ name: 'materialItemId' })
  materialItem: Item | null;

  @Column({ nullable: true })
  materialItemId: number | null;

  @Column({ type: 'int', nullable: true })
  quantity: number | null;

  @Column({ type: 'int', default: 0 })
  goldCost: number; // Additional gold cost for this upgrade

  @Column({ type: 'jsonb', nullable: true })
  statIncrease: StatIncrease | null; // Stat gains at this level

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  getSummary(): string {
    const parts: string[] = [];
    if (this.materialItem && this.quantity) {
      parts.push(`${this.materialItem.name} x${this.quantity}`);
    }
    if (this.goldCost > 0) {
      parts.push(`${this.goldCost.toLocaleString()} gold`);
    }
    return parts.join(' + ') || 'Free upgrade';
  }

  getStatIncreaseSummary(): string {
    if (!this.statIncrease) return 'No stat changes';

    const stats: string[] = [];
    if (this.statIncrease.attack)
      stats.push(`ATK +${this.statIncrease.attack}`);
    if (this.statIncrease.defense)
      stats.push(`DEF +${this.statIncrease.defense}`);
    if (this.statIncrease.hp) stats.push(`HP +${this.statIncrease.hp}`);
    if (this.statIncrease.critRate)
      stats.push(`CRIT +${this.statIncrease.critRate}%`);
    if (this.statIncrease.critDamage)
      stats.push(`CRIT DMG +${this.statIncrease.critDamage}%`);

    return stats.join(', ') || 'No stat changes';
  }
}

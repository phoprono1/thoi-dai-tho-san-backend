import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class Dungeon {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column('json', { default: [] })
  monsterIds: number[]; // Array of monster IDs from monsters table

  @Column('json', { default: [] })
  monsterCounts: { monsterId: number; count: number }[]; // How many of each monster type

  @Column({ default: 1 })
  levelRequirement: number;

  @Column({ default: false })
  isHidden: boolean;

  @Column({ nullable: true })
  requiredItem: number; // Item ID needed to unlock

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column('json', { nullable: true })
  dropItems: { itemId: number; dropRate: number }[]; // Items that can drop with their rates

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

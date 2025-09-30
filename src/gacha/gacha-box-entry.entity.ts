import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { GachaBox } from './gacha-box.entity';

@Entity()
export class GachaBoxEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => GachaBox, (b) => b.entries, { onDelete: 'CASCADE' })
  box: GachaBox;

  @Column({ type: 'int', nullable: true })
  itemId?: number; // FK to Item table (optional)

  @Column('json', { nullable: true })
  itemJson?: any; // ad-hoc item payload if not referencing Item

  @Column({ type: 'int', default: 1 })
  amountMin: number;

  @Column({ type: 'int', default: 1 })
  amountMax: number;

  @Column({ type: 'int', nullable: true })
  weight?: number; // used for single-pick weighted selection

  @Column({ type: 'double precision', nullable: true })
  probability?: number; // used for independent trials (0..1)

  @Column({ type: 'varchar', nullable: true })
  groupKey?: string; // grouping entries into exclusive or independent groups

  @Column({ default: false })
  guaranteed?: boolean; // reserved for pity/guarantee logic
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { GachaBoxEntry } from './gacha-box-entry.entity';

export type OpenMode = 'single' | 'multi';

@Entity()
export class GachaBox {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true })
  image?: string;

  @Column({ type: 'varchar', default: 'single' })
  openMode: OpenMode;

  @Column({ default: true })
  isActive: boolean;

  @Column('json', { nullable: true })
  metadata?: any;

  @OneToMany(() => GachaBoxEntry, (e) => e.box, { cascade: true })
  entries: GachaBoxEntry[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Title } from '../../titles/title.entity';

@Entity('title_tax_reductions')
export class TitleTaxReduction {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Title, { onDelete: 'CASCADE' })
  title: Title;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0.0,
    comment: 'Tax reduction as decimal (0.50 = 50% reduction)',
  })
  taxReductionPercentage: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}

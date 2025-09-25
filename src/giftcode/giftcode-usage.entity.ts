import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('giftcode_usage')
export class GiftCodeUsage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  giftcodeId: number;

  @Column()
  @Index()
  userId: number;

  @CreateDateColumn()
  redeemedAt: Date;
}

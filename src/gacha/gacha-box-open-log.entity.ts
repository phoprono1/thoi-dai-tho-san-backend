import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { UserGachaBox } from './user-gacha-box.entity';

@Entity()
export class GachaBoxOpenLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  playerId: number;

  @Column({ type: 'int' })
  boxId: number;

  @Column('json')
  awarded: any;

  @Column({ type: 'text', nullable: true })
  usedKey?: string;

  @Column({ type: 'bigint', nullable: true })
  seed?: number;

  @Column({ type: 'int', nullable: true })
  userGachaBoxId?: number;

  @CreateDateColumn()
  createdAt: Date;
}

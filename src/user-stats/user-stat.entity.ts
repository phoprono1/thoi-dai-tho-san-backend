import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity()
export class UserStat {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => User)
  @JoinColumn()
  user: User;

  @Column({ default: 0 })
  userId: number;

  // Current HP (persisted for gameplay)
  @Column({ default: 100 })
  currentHp: number;

  // Core attributes - only these are persisted
  @Column({ default: 10 })
  strength: number; // Sức mạnh

  @Column({ default: 10 })
  intelligence: number; // Trí tuệ

  @Column({ default: 10 })
  dexterity: number; // Nhanh nhẹn

  @Column({ default: 10 })
  vitality: number; // Sinh lực

  @Column({ default: 10 })
  luck: number; // May mắn

  // Free attribute points system
  @Column({ default: 0 })
  unspentAttributePoints: number; // Điểm thuộc tính chưa phân phối

  // Points allocated by player into each attribute
  @Column({ default: 0 })
  strengthPoints: number; // Điểm STR đã invest

  @Column({ default: 0 })
  intelligencePoints: number; // Điểm INT đã invest

  @Column({ default: 0 })
  dexterityPoints: number; // Điểm DEX đã invest

  @Column({ default: 0 })
  vitalityPoints: number; // Điểm VIT đã invest

  @Column({ default: 0 })
  luckPoints: number; // Điểm LUK đã invest

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

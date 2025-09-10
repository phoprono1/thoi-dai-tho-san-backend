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

  // Base stats
  @Column({ default: 100 })
  maxHp: number;

  @Column({ default: 100 })
  currentHp: number;

  @Column({ default: 10 })
  attack: number;

  @Column({ default: 5 })
  defense: number;

  // Core attributes
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

  // Advanced stats
  @Column({ default: 0 })
  critRate: number; // Bạo kích (%)

  @Column({ default: 150 })
  critDamage: number; // Sát thương bạo kích (%)

  @Column({ default: 0 })
  comboRate: number; // Liên kích (%)

  @Column({ default: 0 })
  counterRate: number; // Phản kích (%)

  @Column({ default: 0 })
  lifesteal: number; // Hút máu (%)

  @Column({ default: 0 })
  armorPen: number; // Xuyên giáp (%)

  @Column({ default: 0 })
  dodgeRate: number; // Né tránh (%)

  @Column({ default: 0 })
  accuracy: number; // Chính xác (%)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

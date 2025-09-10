import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Item } from '../items/item.entity';

@Entity()
export class UserItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  @JoinColumn()
  user: User;

  @Column()
  userId: number;

  @ManyToOne(() => Item)
  @JoinColumn()
  item: Item;

  @Column()
  itemId: number;

  @Column({ default: 1 })
  quantity: number;

  @Column({ default: 0 })
  upgradeLevel: number;

  @Column({ default: 10 })
  maxUpgradeLevel: number;

  @Column('json', { nullable: true })
  upgradeStats: {
    attack?: number;
    defense?: number;
    critRate?: number;
    critDamage?: number;
    comboRate?: number;
    counterRate?: number;
    lifesteal?: number;
    armorPen?: number;
    dodgeRate?: number;
    accuracy?: number;
  };

  @Column({ default: false })
  isEquipped: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

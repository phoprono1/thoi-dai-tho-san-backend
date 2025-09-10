import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
} from 'typeorm';
import { Guild } from '../guilds/guild.entity';
import { UserStat } from '../user-stats/user-stat.entity';
import { CharacterClass } from '../character-classes/character-class.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  username: string;

  @Column()
  password: string;

  @Column({ default: 1 })
  level: number;

  @Column({ default: 0 })
  experience: number;

  @ManyToOne(() => CharacterClass, { nullable: true })
  characterClass: CharacterClass;

  @Column({ default: 0 })
  gold: number;

  @ManyToOne(() => Guild, { nullable: true })
  guild: Guild;

  @OneToOne(() => UserStat, (userStat) => userStat.user, { nullable: true })
  stats: UserStat;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ default: false })
  isBanned: boolean;

  @Column({ default: false })
  isAdmin: boolean;

  @Column({ default: false })
  isDonor: boolean;
}

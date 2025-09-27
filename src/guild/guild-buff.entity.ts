import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Guild } from './guild.entity';

@Entity('guild_buffs')
export class GuildBuff {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Guild, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'guildId' })
  guild: Guild;

  @Column()
  guildId: number;

  @Column({ type: 'int' })
  guildLevel: number; // Level của guild mà buff này áp dụng

  @Column({ type: 'jsonb' })
  statBuffs: {
    strength: number; // Buff STR
    intelligence: number; // Buff INT
    dexterity: number; // Buff DEX
    vitality: number; // Buff VIT
    luck: number; // Buff LUK
  };

  @Column({ type: 'text', nullable: true })
  description?: string; // Mô tả buff

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// Default guild buff configurations
export const DEFAULT_GUILD_BUFFS = [
  {
    guildLevel: 1,
    statBuffs: {
      strength: 5,
      intelligence: 5,
      dexterity: 5,
      vitality: 5,
      luck: 5,
    },
    description: 'Guild Level 1 - Basic member benefits',
  },
  {
    guildLevel: 2,
    statBuffs: {
      strength: 10,
      intelligence: 10,
      dexterity: 10,
      vitality: 10,
      luck: 10,
    },
    description: 'Guild Level 2 - Enhanced member benefits',
  },
  {
    guildLevel: 3,
    statBuffs: {
      strength: 15,
      intelligence: 15,
      dexterity: 15,
      vitality: 15,
      luck: 15,
    },
    description: 'Guild Level 3 - Advanced member benefits',
  },
  {
    guildLevel: 4,
    statBuffs: {
      strength: 25,
      intelligence: 25,
      dexterity: 25,
      vitality: 25,
      luck: 25,
    },
    description: 'Guild Level 4 - Expert member benefits',
  },
  {
    guildLevel: 5,
    statBuffs: {
      strength: 40,
      intelligence: 40,
      dexterity: 40,
      vitality: 40,
      luck: 40,
    },
    description: 'Guild Level 5 - Master member benefits',
  },
  {
    guildLevel: 6,
    statBuffs: {
      strength: 60,
      intelligence: 60,
      dexterity: 60,
      vitality: 60,
      luck: 60,
    },
    description: 'Guild Level 6 - Elite member benefits',
  },
  {
    guildLevel: 7,
    statBuffs: {
      strength: 85,
      intelligence: 85,
      dexterity: 85,
      vitality: 85,
      luck: 85,
    },
    description: 'Guild Level 7 - Champion member benefits',
  },
  {
    guildLevel: 8,
    statBuffs: {
      strength: 115,
      intelligence: 115,
      dexterity: 115,
      vitality: 115,
      luck: 115,
    },
    description: 'Guild Level 8 - Legendary member benefits',
  },
  {
    guildLevel: 9,
    statBuffs: {
      strength: 150,
      intelligence: 150,
      dexterity: 150,
      vitality: 150,
      luck: 150,
    },
    description: 'Guild Level 9 - Mythical member benefits',
  },
  {
    guildLevel: 10,
    statBuffs: {
      strength: 200,
      intelligence: 200,
      dexterity: 200,
      vitality: 200,
      luck: 200,
    },
    description: 'Guild Level 10 - Divine member benefits',
  },
];

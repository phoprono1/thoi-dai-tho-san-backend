import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('global_guild_buffs')
export class GlobalGuildBuff {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', unique: true })
  guildLevel: number; // Level của guild (1-20)

  @Column({ type: 'jsonb' })
  statBuffs: {
    strength: number; // Buff STR
    intelligence: number; // Buff INT
    dexterity: number; // Buff DEX
    vitality: number; // Buff VIT
    luck: number; // Buff LUK
  };

  @Column({ type: 'text', nullable: true })
  description?: string; // Mô tả buff cho level này

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// Default global guild buff configurations
export const DEFAULT_GLOBAL_GUILD_BUFFS = [
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
  {
    guildLevel: 11,
    statBuffs: {
      strength: 260,
      intelligence: 260,
      dexterity: 260,
      vitality: 260,
      luck: 260,
    },
    description: 'Guild Level 11 - Transcendent member benefits',
  },
  {
    guildLevel: 12,
    statBuffs: {
      strength: 330,
      intelligence: 330,
      dexterity: 330,
      vitality: 330,
      luck: 330,
    },
    description: 'Guild Level 12 - Celestial member benefits',
  },
  {
    guildLevel: 13,
    statBuffs: {
      strength: 410,
      intelligence: 410,
      dexterity: 410,
      vitality: 410,
      luck: 410,
    },
    description: 'Guild Level 13 - Immortal member benefits',
  },
  {
    guildLevel: 14,
    statBuffs: {
      strength: 500,
      intelligence: 500,
      dexterity: 500,
      vitality: 500,
      luck: 500,
    },
    description: 'Guild Level 14 - Eternal member benefits',
  },
  {
    guildLevel: 15,
    statBuffs: {
      strength: 600,
      intelligence: 600,
      dexterity: 600,
      vitality: 600,
      luck: 600,
    },
    description: 'Guild Level 15 - Omnipotent member benefits',
  },
  {
    guildLevel: 16,
    statBuffs: {
      strength: 720,
      intelligence: 720,
      dexterity: 720,
      vitality: 720,
      luck: 720,
    },
    description: 'Guild Level 16 - Supreme member benefits',
  },
  {
    guildLevel: 17,
    statBuffs: {
      strength: 860,
      intelligence: 860,
      dexterity: 860,
      vitality: 860,
      luck: 860,
    },
    description: 'Guild Level 17 - Ultimate member benefits',
  },
  {
    guildLevel: 18,
    statBuffs: {
      strength: 1020,
      intelligence: 1020,
      dexterity: 1020,
      vitality: 1020,
      luck: 1020,
    },
    description: 'Guild Level 18 - Absolute member benefits',
  },
  {
    guildLevel: 19,
    statBuffs: {
      strength: 1200,
      intelligence: 1200,
      dexterity: 1200,
      vitality: 1200,
      luck: 1200,
    },
    description: 'Guild Level 19 - Infinite member benefits',
  },
  {
    guildLevel: 20,
    statBuffs: {
      strength: 1500,
      intelligence: 1500,
      dexterity: 1500,
      vitality: 1500,
      luck: 1500,
    },
    description: 'Guild Level 20 - Omniversal member benefits',
  },
];

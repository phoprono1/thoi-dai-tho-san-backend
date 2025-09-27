import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GuildBuff, DEFAULT_GUILD_BUFFS } from './guild-buff.entity';
import { Guild } from './guild.entity';

export interface GuildBuffDto {
  guildLevel: number;
  statBuffs: {
    strength: number;
    intelligence: number;
    dexterity: number;
    vitality: number;
    luck: number;
  };
  description?: string;
  isActive?: boolean;
}

export interface UpdateGuildBuffDto {
  statBuffs?: {
    strength?: number;
    intelligence?: number;
    dexterity?: number;
    vitality?: number;
    luck?: number;
  };
  description?: string;
  isActive?: boolean;
}

@Injectable()
export class GuildBuffService {
  constructor(
    @InjectRepository(GuildBuff)
    private guildBuffRepository: Repository<GuildBuff>,
    @InjectRepository(Guild)
    private guildRepository: Repository<Guild>,
  ) {}

  // Get all buffs for a specific guild
  async getGuildBuffs(guildId: number): Promise<GuildBuff[]> {
    return this.guildBuffRepository.find({
      where: { guildId },
      order: { guildLevel: 'ASC' },
    });
  }

  // Get active buff for a guild's current level
  async getActiveGuildBuff(guildId: number): Promise<GuildBuff | null> {
    const guild = await this.guildRepository.findOne({
      where: { id: guildId },
    });

    if (!guild) {
      throw new NotFoundException('Guild not found');
    }

    return this.guildBuffRepository.findOne({
      where: {
        guildId,
        guildLevel: guild.level,
        isActive: true,
      },
    });
  }

  // Get buff stats for a user's guild
  async getUserGuildBuffs(
    userId: number,
  ): Promise<GuildBuff['statBuffs'] | null> {
    const guild = await this.guildRepository
      .createQueryBuilder('guild')
      .innerJoin('guild.members', 'member')
      .where('member.userId = :userId', { userId })
      .andWhere('member.isApproved = true')
      .getOne();

    if (!guild) {
      return null; // User is not in any guild
    }

    const buff = await this.getActiveGuildBuff(guild.id);
    return buff ? buff.statBuffs : null;
  }

  // Update a specific guild buff
  async updateGuildBuff(
    guildId: number,
    guildLevel: number,
    updateData: UpdateGuildBuffDto,
  ): Promise<GuildBuff> {
    const buff = await this.guildBuffRepository.findOne({
      where: { guildId, guildLevel },
    });

    if (!buff) {
      throw new NotFoundException('Guild buff not found');
    }

    // Merge stat buffs if provided
    if (updateData.statBuffs) {
      buff.statBuffs = {
        ...buff.statBuffs,
        ...updateData.statBuffs,
      };
    }

    if (updateData.description !== undefined) {
      buff.description = updateData.description;
    }

    if (updateData.isActive !== undefined) {
      buff.isActive = updateData.isActive;
    }

    return this.guildBuffRepository.save(buff);
  }

  // Initialize default buffs for a new guild
  async initializeGuildBuffs(guildId: number): Promise<GuildBuff[]> {
    const existingBuffs = await this.getGuildBuffs(guildId);
    if (existingBuffs.length > 0) {
      return existingBuffs; // Already initialized
    }

    const buffs: GuildBuff[] = [];
    for (const defaultBuff of DEFAULT_GUILD_BUFFS) {
      const buff = this.guildBuffRepository.create({
        guildId,
        guildLevel: defaultBuff.guildLevel,
        statBuffs: defaultBuff.statBuffs,
        description: defaultBuff.description,
        isActive: true,
      });
      buffs.push(await this.guildBuffRepository.save(buff));
    }

    return buffs;
  }

  // Get all guild buffs for admin management
  async getAllGuildBuffs(): Promise<GuildBuff[]> {
    return this.guildBuffRepository.find({
      relations: ['guild'],
      order: { guildId: 'ASC', guildLevel: 'ASC' },
    });
  }

  // Reset guild buffs to default values
  async resetGuildBuffsToDefault(guildId: number): Promise<GuildBuff[]> {
    // Delete existing buffs
    await this.guildBuffRepository.delete({ guildId });

    // Recreate with default values
    return this.initializeGuildBuffs(guildId);
  }

  // Bulk update multiple guild buffs
  async bulkUpdateGuildBuffs(
    guildId: number,
    updates: Array<{ guildLevel: number } & UpdateGuildBuffDto>,
  ): Promise<GuildBuff[]> {
    const results: GuildBuff[] = [];

    for (const update of updates) {
      const { guildLevel, ...updateData } = update;
      const buff = await this.updateGuildBuff(guildId, guildLevel, updateData);
      results.push(buff);
    }

    return results;
  }

  // Initialize buffs for all existing guilds that don't have buffs yet
  async initializeAllExistingGuilds(): Promise<number> {
    const allGuilds = await this.guildRepository.find();
    let initializedCount = 0;

    for (const guild of allGuilds) {
      const existingBuffs = await this.getGuildBuffs(guild.id);
      if (existingBuffs.length === 0) {
        await this.initializeGuildBuffs(guild.id);
        initializedCount++;
      }
    }

    return initializedCount;
  }
}

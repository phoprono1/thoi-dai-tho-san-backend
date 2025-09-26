import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GlobalGuildBuff, DEFAULT_GLOBAL_GUILD_BUFFS } from './global-guild-buff.entity';
import { Guild } from './guild.entity';

export interface UpdateGlobalGuildBuffDto {
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
export class GlobalGuildBuffService {
  constructor(
    @InjectRepository(GlobalGuildBuff)
    private globalGuildBuffRepository: Repository<GlobalGuildBuff>,
    @InjectRepository(Guild)
    private guildRepository: Repository<Guild>,
  ) {}

  // Get all global guild buffs (for all levels)
  async getAllGlobalBuffs(): Promise<GlobalGuildBuff[]> {
    return this.globalGuildBuffRepository.find({
      order: { guildLevel: 'ASC' },
    });
  }

  // Get buff for a specific guild level
  async getBuffForLevel(guildLevel: number): Promise<GlobalGuildBuff | null> {
    return this.globalGuildBuffRepository.findOne({
      where: { guildLevel, isActive: true },
    });
  }

  // Get buff stats for a user's guild (based on guild level)
  async getUserGuildBuffs(userId: number): Promise<GlobalGuildBuff['statBuffs'] | null> {
    const guild = await this.guildRepository
      .createQueryBuilder('guild')
      .innerJoin('guild.members', 'member')
      .where('member.userId = :userId', { userId })
      .andWhere('member.isApproved = true')
      .getOne();

    if (!guild) {
      return null; // User is not in any guild
    }

    const buff = await this.getBuffForLevel(guild.level);
    return buff ? buff.statBuffs : null;
  }

  // Update a specific level's buff (Admin only)
  async updateGlobalBuff(
    guildLevel: number, 
    updateData: UpdateGlobalGuildBuffDto
  ): Promise<GlobalGuildBuff> {
    const buff = await this.globalGuildBuffRepository.findOne({
      where: { guildLevel },
    });

    if (!buff) {
      throw new NotFoundException(`Global guild buff for level ${guildLevel} not found`);
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

    return this.globalGuildBuffRepository.save(buff);
  }

  // Initialize default global buffs (run once)
  async initializeGlobalBuffs(): Promise<GlobalGuildBuff[]> {
    const existingBuffs = await this.getAllGlobalBuffs();
    if (existingBuffs.length > 0) {
      return existingBuffs; // Already initialized
    }

    const buffs: GlobalGuildBuff[] = [];
    for (const defaultBuff of DEFAULT_GLOBAL_GUILD_BUFFS) {
      const buff = this.globalGuildBuffRepository.create({
        guildLevel: defaultBuff.guildLevel,
        statBuffs: defaultBuff.statBuffs,
        description: defaultBuff.description,
        isActive: true,
      });
      buffs.push(await this.globalGuildBuffRepository.save(buff));
    }

    return buffs;
  }

  // Reset all global buffs to default values
  async resetToDefaults(): Promise<GlobalGuildBuff[]> {
    // Delete existing buffs
    await this.globalGuildBuffRepository.clear();
    
    // Recreate with default values
    return this.initializeGlobalBuffs();
  }

  // Bulk update multiple levels
  async bulkUpdateGlobalBuffs(
    updates: Array<{ guildLevel: number } & UpdateGlobalGuildBuffDto>
  ): Promise<GlobalGuildBuff[]> {
    const results: GlobalGuildBuff[] = [];
    
    for (const update of updates) {
      const { guildLevel, ...updateData } = update;
      const buff = await this.updateGlobalBuff(guildLevel, updateData);
      results.push(buff);
    }
    
    return results;
  }

  // Get stats summary for all levels
  async getBuffsSummary(): Promise<any> {
    const buffs = await this.getAllGlobalBuffs();
    return {
      totalLevels: buffs.length,
      buffs: buffs.map(buff => ({
        level: buff.guildLevel,
        totalStats: Object.values(buff.statBuffs).reduce((sum, val) => sum + val, 0),
        isActive: buff.isActive,
        description: buff.description
      }))
    };
  }
}

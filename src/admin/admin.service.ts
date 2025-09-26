import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { UserStat } from '../user-stats/user-stat.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(UserStat)
    private userStatsRepository: Repository<UserStat>,
  ) {}

  async resetAllUsers(): Promise<{ ok: boolean; count: number }> {
    const users = await this.usersRepository.find();
    let count = 0;
    for (const user of users) {
      // Reset level and exp
      user.level = 1;
      user.experience = 0;
      await this.usersRepository.save(user);
      // Reset stats
      const stat = await this.userStatsRepository.findOne({
        where: { userId: user.id },
      });
      if (stat) {
        stat.currentHp = 100;
        stat.strength = 10;
        stat.intelligence = 10;
        stat.dexterity = 10;
        stat.vitality = 10;
        stat.luck = 10;
        stat.unspentAttributePoints = 0;
        stat.strengthPoints = 0;
        stat.intelligencePoints = 0;
        stat.dexterityPoints = 0;
        stat.vitalityPoints = 0;
        stat.luckPoints = 0;
        await this.userStatsRepository.save(stat);
      }
      count++;
    }
    return { ok: true, count };
  }
}

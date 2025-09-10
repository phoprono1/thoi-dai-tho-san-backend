import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { LevelsService } from '../levels/levels.service';
import { UserStatsService } from '../user-stats/user-stats.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private readonly levelsService: LevelsService,
    private readonly userStatsService: UserStatsService,
  ) {}

  findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  findOne(id: number): Promise<User | null> {
    return this.usersRepository.findOneBy({ id });
  }

  findByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ username });
  }

  async create(user: Partial<User>): Promise<User> {
    const newUser = this.usersRepository.create(user);
    return this.usersRepository.save(newUser);
  }

  async update(id: number, user: Partial<User>): Promise<User | null> {
    await this.usersRepository.update(id, user);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.usersRepository.delete(id);
  }

  async banUser(id: number): Promise<User> {
    await this.usersRepository.update(id, { isBanned: true });
    const user = await this.findOne(id);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  async unbanUser(id: number): Promise<User> {
    await this.usersRepository.update(id, { isBanned: false });
    const user = await this.findOne(id);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  async promoteUser(id: number, type: 'admin' | 'donor'): Promise<User> {
    const updateData = type === 'admin' ? { isAdmin: true } : { isDonor: true };
    await this.usersRepository.update(id, updateData);
    const user = await this.findOne(id);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  async demoteUser(id: number, type: 'admin' | 'donor'): Promise<User> {
    const updateData =
      type === 'admin' ? { isAdmin: false } : { isDonor: false };
    await this.usersRepository.update(id, updateData);
    const user = await this.findOne(id);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  async levelUpUser(id: number): Promise<User> {
    const user = await this.findOne(id);
    if (!user) {
      throw new Error('User not found');
    }

    // Lấy thông tin level tiếp theo
    const nextLevel = await this.levelsService.getNextLevel(user.level);
    if (!nextLevel) {
      throw new Error('Max level reached');
    }

    // Kiểm tra có đủ kinh nghiệm không
    if (user.experience < nextLevel.experienceRequired) {
      throw new Error('Not enough experience to level up');
    }

    // Tăng level và reset experience
    user.level += 1;
    user.experience = 0; // Reset experience về 0

    // Lấy stats của level mới
    const levelStats = await this.levelsService.getLevelStats(user.level);
    if (levelStats) {
      // Áp dụng stats level up (bao gồm hồi đầy HP)
      await this.userStatsService.applyLevelUpStats(id, levelStats);
    }

    // Lưu user
    await this.usersRepository.save(user);

    return user;
  }
}

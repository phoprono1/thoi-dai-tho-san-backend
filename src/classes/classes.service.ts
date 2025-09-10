import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Class, ClassTier, ClassCategory } from './class.entity';
import { UserClass } from './user-class.entity';

@Injectable()
export class ClassesService {
  constructor(
    @InjectRepository(Class)
    private classesRepository: Repository<Class>,
    @InjectRepository(UserClass)
    private userClassesRepository: Repository<UserClass>,
  ) {}

  // Create sample classes
  async createSampleClasses() {
    const sampleClasses = [
      {
        name: 'Kiếm Sĩ',
        tier: ClassTier.C,
        category: ClassCategory.WARRIOR,
        description: 'Chiến binh cận chiến với sức mạnh và phòng thủ cân bằng',
        baseStats: {
          atk: 10, // +10% ATK
          def: 15, // +15% DEF
          hp: 20, // +20% HP
        },
        requirements: {
          level: 10,
        },
      },
      {
        name: 'Võ Sư',
        tier: ClassTier.C,
        category: ClassCategory.WARRIOR,
        description: 'Võ sĩ nhanh nhẹn với khả năng phản kích và liên kích',
        baseStats: {
          atk: 15, // +15% ATK
          critRate: 10, // +10% Crit Rate
          critDamage: 20, // +20% Crit Damage
        },
        requirements: {
          level: 10,
        },
      },
      {
        name: 'Pháp Sư',
        tier: ClassTier.C,
        category: ClassCategory.MAGE,
        description: 'Pháp sư với sức mạnh phép thuật và khả năng kiểm soát',
        baseStats: {
          atk: 25, // +25% ATK (magic damage)
          critRate: 15, // +15% Crit Rate
          penetration: 10, // +10% Penetration
        },
        requirements: {
          level: 10,
        },
      },
    ];

    for (const classData of sampleClasses) {
      const existingClass = await this.classesRepository.findOne({
        where: { name: classData.name },
      });

      if (!existingClass) {
        await this.classesRepository.save(classData);
      }
    }

    return { message: 'Sample classes created successfully' };
  }

  // Get all classes
  async findAll(): Promise<Class[]> {
    return this.classesRepository.find({
      where: { isActive: true },
      order: { tier: 'ASC', name: 'ASC' },
    });
  }

  // Get class by ID
  async findOne(id: number): Promise<Class | null> {
    return this.classesRepository.findOne({
      where: { id, isActive: true },
    });
  }

  // Get user's classes
  async getUserClasses(userId: number): Promise<UserClass[]> {
    return this.userClassesRepository.find({
      where: { userId },
      relations: ['class'],
      order: { createdAt: 'DESC' },
    });
  }

  // Unlock class for user
  async unlockClass(userId: number, classId: number) {
    // Check if user already has this class
    const existingUserClass = await this.userClassesRepository.findOne({
      where: { userId, classId },
    });

    if (existingUserClass) {
      throw new Error('User already has this class');
    }

    // Check if class exists and is active
    const classEntity = await this.findOne(classId);
    if (!classEntity) {
      throw new Error('Class not found');
    }

    // Create user class
    const userClass = this.userClassesRepository.create({
      userId,
      classId,
      level: 1,
      experience: 0,
      isActive: false,
      unlockedAt: new Date(),
    });

    return this.userClassesRepository.save(userClass);
  }

  // Set active class for user
  async setActiveClass(userId: number, userClassId: number) {
    // First, deactivate all user's classes
    await this.userClassesRepository.update({ userId }, { isActive: false });

    // Then activate the selected class
    const result = await this.userClassesRepository.update(
      { id: userClassId, userId },
      { isActive: true },
    );

    if (result.affected === 0) {
      throw new Error('User class not found or does not belong to user');
    }

    return { message: 'Active class updated successfully' };
  }

  // Get user's active class
  async getUserActiveClass(userId: number): Promise<UserClass | null> {
    return this.userClassesRepository.findOne({
      where: { userId, isActive: true },
      relations: ['class'],
    });
  }

  // Calculate class bonuses for user stats
  async getClassBonuses(userId: number) {
    const activeClass = await this.getUserActiveClass(userId);

    if (!activeClass) {
      return {}; // No bonuses if no active class
    }

    // Get class data
    const classData = await this.findOne(activeClass.classId);
    if (!classData) {
      return {};
    }

    const levelMultiplier = activeClass.level * 0.1; // 10% bonus per level

    // Apply level scaling to base stats
    const bonuses = {};
    for (const [stat, value] of Object.entries(classData.baseStats || {})) {
      bonuses[stat] = Math.floor(value * (1 + levelMultiplier));
    }

    return bonuses;
  }
}

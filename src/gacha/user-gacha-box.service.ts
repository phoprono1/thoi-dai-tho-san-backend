import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { UserGachaBox } from './user-gacha-box.entity';
import { GachaService } from './gacha.service';
import * as crypto from 'crypto';

@Injectable()
export class UserGachaBoxService {
  constructor(
    @InjectRepository(UserGachaBox)
    private readonly repo: Repository<UserGachaBox>,
    private readonly dataSource: DataSource,
    private readonly gachaService: GachaService,
  ) {}

  async awardInstance(
    userId: number,
    boxId: number,
    opts?: { itemId?: number; expiresAt?: Date; metadata?: any },
  ) {
    const seed = crypto.randomBytes(16).toString('hex');
    const inst = this.repo.create({
      userId,
      boxId,
      itemId: opts?.itemId,
      seed,
      metadata: opts?.metadata || null,
      expiresAt: opts?.expiresAt || null,
    });
    return this.repo.save(inst as any);
  }

  async listForUser(userId: number) {
    return this.repo.find({ where: { userId, consumed: false } });
  }

  // Open an instance (consumes it and calls GachaService.openBox with seed)
  async openInstance(userId: number, instanceId: number) {
    return this.dataSource.transaction(async (manager) => {
      const inst = (await manager.findOne(UserGachaBox as any, {
        where: { id: instanceId, userId },
      })) as unknown as UserGachaBox | null;
      if (!inst) throw new BadRequestException('Instance không tồn tại');
      if (inst.consumed) throw new BadRequestException('Instance đã được mở');
      if (inst.expiresAt && new Date(inst.expiresAt) < new Date())
        throw new BadRequestException('Instance đã hết hạn');

      // mark consumed
      await manager.update(UserGachaBox as any, { id: instanceId }, {
        consumed: true,
        consumedAt: new Date(),
      } as any);

      // call gacha open with seed — pass seed and userGachaBoxId so log is linked and deterministic
      const result = await this.gachaService.openBox(userId, inst.boxId, 1, {
        seed: inst.seed,
        userGachaBoxId: inst.id,
      });
      return result;
    });
  }
}

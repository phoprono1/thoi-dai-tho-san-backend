import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { UserStatsService } from '../user-stats/user-stats.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private userStatsService: UserStatsService,
    private jwtService: JwtService,
  ) {}

  async validateUser(username: string, password: string): Promise<any> {
    try {
      const user = await this.usersService.findByUsername(username);
      if (user && (await bcrypt.compare(password, user.password))) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: _, ...result } = user;
        return result;
      }
      return null;
    } catch (error) {
      console.error('Validate user error:', error);
      throw error;
    }
  }

  login(user: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const payload = { username: user.username, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload, { expiresIn: '7d' }),
    };
  }

  async register(username: string, password: string) {
    try {
      console.log('Starting user registration for:', username);
      const hashedPassword = await bcrypt.hash(password, 10);
      console.log('Password hashed successfully');

      const user = await this.usersService.create({
        username,
        password: hashedPassword,
      });
      console.log('User created successfully:', user.id);

      // Tự động tạo UserStat với base stats cho tân thủ
      await this.userStatsService.create({
        userId: user.id,
        maxHp: 100,
        currentHp: 100,
        attack: 10,
        defense: 5,
        critRate: 0,
        critDamage: 150,
        comboRate: 0,
        counterRate: 0,
        lifesteal: 0,
        armorPen: 0,
        dodgeRate: 0,
        accuracy: 0,
      });
      console.log('UserStat created successfully');

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _, ...result } = user;
      console.log('Registration completed successfully');
      return result;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  // Change password for authenticated user. Verifies current password.
  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.usersService.findOne(userId);
    if (!user) throw new Error('User not found');

    const matches = await bcrypt.compare(currentPassword, user.password);
    if (!matches) throw new Error('Current password is incorrect');

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.usersService.update(userId, {
      password: hashed,
    } as Partial<any>);
    return { message: 'Password changed' };
  }
}

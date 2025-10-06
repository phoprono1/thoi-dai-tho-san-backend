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

  async login(user: any, loginIp: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const payload = { username: user.username, sub: user.id };

    // 🛡️ UPDATE LAST LOGIN IP & DATE
    await this.usersService.update(user.id, {
      lastLoginIp: loginIp,
      lastLoginDate: new Date(),
    } as Partial<any>);

    return {
      access_token: this.jwtService.sign(payload, { expiresIn: '7d' }),
    };
  }

  async register(
    username: string,
    password: string,
    registrationIp: string,
    deviceFingerprint?: string,
  ) {
    try {
      console.log('Starting user registration for:', username);
      const hashedPassword = await bcrypt.hash(password, 10);
      console.log('Password hashed successfully');

      // 🛡️ Prepare device fingerprints array
      const deviceFingerprints = deviceFingerprint ? [deviceFingerprint] : [];

      const user = await this.usersService.create({
        username,
        password: hashedPassword,
        registrationIp, // 🛡️ SAVE REGISTRATION IP
        registrationSource: 'web',
        accountFlags: {},
        deviceFingerprints, // 🛡️ SAVE DEVICE FINGERPRINT
      });
      console.log('User created successfully:', user.id);

      // Tự động tạo UserStat với base stats mặc định
      await this.userStatsService.create({
        userId: user.id,
        strength: 10,
        intelligence: 10,
        dexterity: 10,
        vitality: 10,
        luck: 10,
        currentHp: 100, // Temporary value, will be updated to max HP
      });
      console.log('UserStat created successfully');

      // Update HP to max HP based on current stats
      await this.userStatsService.updateHpToMax(user.id);
      console.log('User HP updated to max');

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

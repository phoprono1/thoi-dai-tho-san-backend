import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { IpTrackingService } from '../common/services/ip-tracking.service';
import { UsersService } from '../users/users.service';

@ApiTags('admin-security')
@Controller('admin/security')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminSecurityController {
  constructor(
    private ipTrackingService: IpTrackingService,
    private usersService: UsersService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: '📊 Tổng quan bảo mật' })
  async getDashboard() {
    const suspiciousAccounts = await this.usersService.findSuspiciousAccounts();
    const topSuspiciousIPs = await this.ipTrackingService.getTopSuspiciousIPs();
    const rapidLevelers = await this.usersService.findRapidLevelers();
    const inactiveAlts = await this.usersService.findInactiveAlts();
    const suspiciousUsernames =
      await this.usersService.findSuspiciousUsernamePatterns();

    return {
      suspiciousAccounts,
      topIps: topSuspiciousIPs,
      rapidLevelers,
      inactiveAlts,
      suspiciousUsernames,
      stats: {
        suspiciousCount: suspiciousAccounts.length,
        recentRegistrations: 0, // TODO: Track in Redis
        behavioralFlags: 0, // TODO: Count Redis behavioral_flags
      },
    };
  }

  @Get('ip-accounts')
  @ApiOperation({ summary: '🔍 Xem tất cả accounts từ 1 IP' })
  async getAccountsByIP(@Query('ip') ip: string) {
    if (!ip) {
      throw new HttpException('IP is required', HttpStatus.BAD_REQUEST);
    }

    const multiAccInfo = await this.ipTrackingService.detectMultiAccounts(ip);
    return {
      ip,
      accountCount: multiAccInfo.accountCount,
      accounts: multiAccInfo.accounts,
    };
  }

  @Post('temp-ban')
  @ApiOperation({ summary: '🚫 Tạm cấm 1 user (1 ngày)' })
  async tempBan(@Body() body: { userId: number; reason: string }) {
    const { userId, reason } = body;

    const tempBanUntil = new Date();
    tempBanUntil.setDate(tempBanUntil.getDate() + 1); // 1 day

    await this.usersService.update(userId, {
      tempBanUntil,
      banReason: reason,
      isSuspicious: true,
    } as any);

    return {
      message: 'User temporarily banned',
      userId,
      tempBanUntil,
    };
  }

  @Post('ban-ip')
  @ApiOperation({ summary: '🔨 Cấm tất cả accounts từ 1 IP' })
  async banIP(@Body() body: { ip: string; reason: string }) {
    const { ip, reason } = body;

    const multiAccInfo = await this.ipTrackingService.detectMultiAccounts(ip);

    const tempBanUntil = new Date();
    tempBanUntil.setDate(tempBanUntil.getDate() + 7); // 7 days

    for (const account of multiAccInfo.accounts) {
      await this.usersService.update(account.id, {
        tempBanUntil,
        banReason: reason,
        isSuspicious: true,
      } as any);
    }

    return {
      message: `Banned ${multiAccInfo.accounts.length} accounts from IP ${ip}`,
      bannedAccounts: multiAccInfo.accounts.length,
    };
  }

  @Get('behavior-analysis')
  @ApiOperation({ summary: '📈 Phân tích hành vi đáng ngờ' })
  async getBehaviorAnalysis() {
    const rapidLevelers = await this.usersService.findRapidLevelers();
    const inactiveAlts = await this.usersService.findInactiveAlts();
    const suspiciousPatterns =
      await this.usersService.findSuspiciousUsernamePatterns();

    return {
      rapidLevelers,
      inactiveAlts,
      suspiciousPatterns,
    };
  }

  @Post('unban')
  @ApiOperation({ summary: '✅ Gỡ ban cho user' })
  async unban(@Body() body: { userId: number }) {
    const { userId } = body;

    await this.usersService.update(userId, {
      tempBanUntil: null,
      banReason: null,
    } as any);

    return {
      message: 'User unbanned successfully',
      userId,
    };
  }
}

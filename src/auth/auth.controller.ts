import {
  Controller,
  Post,
  UseGuards,
  Body,
  Get,
  HttpException,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './local-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * 🛡️ EXTRACT REAL IP (behind Cloudflare/proxy)
   */
  private getIP(req: Request): string {
    return (
      (req.headers['cf-connecting-ip'] as string) ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      (req.headers['x-real-ip'] as string) ||
      req.ip ||
      '127.0.0.1'
    );
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Đăng nhập tài khoản' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        username: { type: 'string', example: 'player1' },
        password: { type: 'string', example: 'password123' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Đăng nhập thành công, trả về JWT token',
  })
  @ApiResponse({
    status: 401,
    description: 'Sai thông tin đăng nhập',
  })
  async login(@Req() req: Request) {
    const loginIp = this.getIP(req);

    return this.authService.login(req.user, loginIp);
  }
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @ApiOperation({ summary: 'Đổi mật khẩu của user hiện tại' })
  async changePassword(
    @Req() req: Request,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    const user = (req as any).user;
    return this.authService.changePassword(
      user.id,
      body.currentPassword,
      body.newPassword,
    );
  }

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @ApiOperation({ summary: 'Đăng ký tài khoản mới' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        username: { type: 'string', example: 'newplayer' },
        password: { type: 'string', example: 'securepass123' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Đăng ký thành công',
  })
  @ApiResponse({
    status: 400,
    description: 'Username đã tồn tại hoặc dữ liệu không hợp lệ',
  })
  async register(@Req() req: Request) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { username, password, deviceFingerprint } = req.body;
    const registrationIp = this.getIP(req);

    // 🛡️ VALIDATION
    if (!username || username.length < 4 || username.length > 20) {
      throw new HttpException(
        'Username must be 4-20 characters',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!password || password.length < 6) {
      throw new HttpException(
        'Password must be at least 6 characters',
        HttpStatus.BAD_REQUEST,
      );
    }

    // 🚨 DETECT CLONE PATTERNS: "name_1", "name_2", etc.
    const clonePattern = /^(.+?)(_\d+)$/;
    if (clonePattern.test(username)) {
      throw new HttpException(
        'Username format not allowed (suspected multi-accounting)',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.authService.register(
      username as string,
      password as string,
      registrationIp,
      deviceFingerprint as string | undefined,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Lấy thông tin user hiện tại' })
  @ApiResponse({
    status: 200,
    description: 'Thông tin user hiện tại',
  })
  @ApiResponse({
    status: 401,
    description: 'Token không hợp lệ',
  })
  getProfile(@Req() req: Request): any {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return (req as any).user;
  }
}

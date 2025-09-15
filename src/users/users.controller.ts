import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UserPowerService } from '../user-power/user-power.service';
import { User } from './user.entity';
import { LevelsService } from '../levels/levels.service';
import { UserStatsService } from '../user-stats/user-stats.service';
import { UseGuards, Request } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly levelsService: LevelsService,
    private readonly userStatsService: UserStatsService,
    private readonly userPowerService: UserPowerService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Delete('me')
  @ApiOperation({
    summary: 'Xóa tài khoản hiện tại (yêu cầu xác thực mật khẩu)',
  })
  async removeMe(@Request() req, @Body() body: { currentPassword: string }) {
    // req.user is populated by JwtStrategy
    const user = req.user as User | null;
    // Verify password via UsersService? We'll delegate to UsersService.removeAccount after verifying
    // For simplicity, require that caller provides password and we verify against stored hash here.
    const { currentPassword } = body;
    if (!currentPassword) {
      throw new Error('Current password required');
    }

    // Verify current password using UsersService.findOne
    const existing = await this.usersService.findOne(user.id);
    if (!existing) throw new Error('User not found');

    // bcrypt compare
    const ok = await bcrypt.compare(currentPassword, existing.password);
    if (!ok) throw new Error('Password incorrect');

    await this.usersService.removeAccount(existing.id);
    return { message: 'Account deleted' };
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả người dùng' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách người dùng',
  })
  findAll(): Promise<User[]> {
    return this.usersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin người dùng theo ID' })
  @ApiParam({ name: 'id', description: 'ID của người dùng' })
  @ApiResponse({
    status: 200,
    description: 'Thông tin người dùng',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy người dùng',
  })
  async findOne(@Param('id') id: string): Promise<any> {
    const user = await this.usersService.findOne(+id);
    if (!user) return null;

    // Try to get authoritative power (compute if missing) and return a plain object
    try {
      const power = await this.userPowerService.computeAndSaveForUser(user.id);
      // return a plain object so serialization includes dynamic fields
      return { ...user, combatPower: power };
    } catch {
      // fallback to returning the user object as-is
      return user;
    }
  }

  @Post()
  @ApiOperation({ summary: 'Tạo người dùng mới' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        username: { type: 'string', example: 'player1' },
        email: { type: 'string', example: 'player1@example.com' },
        level: { type: 'number', example: 1 },
        experience: { type: 'number', example: 0 },
        gold: { type: 'number', example: 100 },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Người dùng đã được tạo',
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu không hợp lệ',
  })
  create(@Body() user: Partial<User>): Promise<User> {
    return this.usersService.create(user);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin người dùng' })
  @ApiParam({ name: 'id', description: 'ID của người dùng' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        username: { type: 'string', example: 'updated_player' },
        email: { type: 'string', example: 'updated@example.com' },
        level: { type: 'number', example: 5 },
        experience: { type: 'number', example: 1000 },
        gold: { type: 'number', example: 500 },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Người dùng đã được cập nhật',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy người dùng',
  })
  update(
    @Param('id') id: string,
    @Body() user: Partial<User>,
  ): Promise<User | null> {
    return this.usersService.update(+id, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa người dùng' })
  @ApiParam({ name: 'id', description: 'ID của người dùng' })
  @ApiResponse({
    status: 200,
    description: 'Người dùng đã được xóa',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy người dùng',
  })
  remove(@Param('id') id: string): Promise<void> {
    return this.usersService.remove(+id);
  }

  @Post(':id/ban')
  @ApiOperation({ summary: 'Ban người dùng' })
  @ApiParam({ name: 'id', description: 'ID của người dùng' })
  @ApiResponse({
    status: 200,
    description: 'Người dùng đã được ban',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy người dùng',
  })
  banUser(@Param('id') id: string): Promise<User> {
    return this.usersService.banUser(+id);
  }

  @Post(':id/unban')
  @ApiOperation({ summary: 'Unban người dùng' })
  @ApiParam({ name: 'id', description: 'ID của người dùng' })
  @ApiResponse({
    status: 200,
    description: 'Người dùng đã được unban',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy người dùng',
  })
  unbanUser(@Param('id') id: string): Promise<User> {
    return this.usersService.unbanUser(+id);
  }

  @Post(':id/promote')
  @ApiOperation({ summary: 'Promote người dùng thành admin/donor' })
  @ApiParam({ name: 'id', description: 'ID của người dùng' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['admin', 'donor'], example: 'admin' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Người dùng đã được promote',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy người dùng',
  })
  promoteUser(
    @Param('id') id: string,
    @Body('type') type: 'admin' | 'donor',
  ): Promise<User> {
    return this.usersService.promoteUser(+id, type);
  }

  @Post(':id/demote')
  @ApiOperation({ summary: 'Demote người dùng từ admin/donor' })
  @ApiParam({ name: 'id', description: 'ID của người dùng' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['admin', 'donor'], example: 'admin' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Người dùng đã được demote',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy người dùng',
  })
  demoteUser(
    @Param('id') id: string,
    @Body('type') type: 'admin' | 'donor',
  ): Promise<User> {
    return this.usersService.demoteUser(+id, type);
  }

  @Post(':id/level-up')
  @ApiOperation({ summary: 'Level up người dùng' })
  @ApiParam({ name: 'id', description: 'ID của người dùng' })
  @ApiResponse({
    status: 200,
    description: 'Người dùng đã level up thành công',
  })
  @ApiResponse({
    status: 400,
    description: 'Không đủ kinh nghiệm để level up',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy người dùng',
  })
  async levelUpUser(@Param('id') id: string): Promise<User> {
    return this.usersService.levelUpUser(+id);
  }
}

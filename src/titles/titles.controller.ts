import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { TitlesService } from './titles.service';
import { Title } from './title.entity';
import { UserTitle } from './user-title.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@ApiTags('Danh hiệu - Titles')
@ApiBearerAuth()
@Controller('titles')
@UseGuards(JwtAuthGuard)
export class TitlesController {
  constructor(private readonly titlesService: TitlesService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy tất cả danh hiệu có sẵn' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách tất cả danh hiệu',
    type: [Title],
  })
  async getAllTitles(): Promise<Title[]> {
    return this.titlesService.getAllTitles();
  }

  @Get('my-titles')
  @ApiOperation({ summary: 'Lấy danh hiệu của user hiện tại' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách danh hiệu đã mở khóa',
    type: [UserTitle],
  })
  async getMyTitles(@Request() req): Promise<UserTitle[]> {
    return this.titlesService.getUserTitles(req.user.id);
  }

  @Get('equipped')
  @ApiOperation({ summary: 'Lấy danh hiệu đang trang bị' })
  @ApiResponse({
    status: 200,
    description: 'Danh hiệu đang trang bị',
    type: UserTitle,
  })
  async getEquippedTitle(@Request() req): Promise<UserTitle | null> {
    return this.titlesService.getEquippedTitle(req.user.id);
  }

  @Post('equip/:titleId')
  @ApiOperation({ summary: 'Trang bị danh hiệu' })
  @ApiResponse({
    status: 200,
    description: 'Danh hiệu đã được trang bị',
    type: UserTitle,
  })
  async equipTitle(
    @Request() req,
    @Param('titleId') titleId: number,
  ): Promise<UserTitle> {
    return this.titlesService.equipTitle(req.user.id, titleId);
  }

  @Post('unequip')
  @ApiOperation({ summary: 'Tháo danh hiệu' })
  @ApiResponse({
    status: 200,
    description: 'Danh hiệu đã được tháo',
  })
  async unequipTitle(@Request() req): Promise<void> {
    return this.titlesService.unequipTitle(req.user.id);
  }

  @Get('check-requirements/:titleId')
  @ApiOperation({ summary: 'Kiểm tra điều kiện mở khóa danh hiệu' })
  @ApiResponse({
    status: 200,
    description: 'Kết quả kiểm tra điều kiện',
  })
  async checkRequirements(
    @Request() req,
    @Param('titleId') titleId: number,
  ): Promise<{ eligible: boolean; missingRequirements: string[] }> {
    return this.titlesService.checkTitleRequirements(req.user.id, titleId);
  }

  @Post('check-and-unlock')
  @ApiOperation({ summary: 'Kiểm tra và mở khóa tất cả danh hiệu đủ điều kiện' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách danh hiệu mới được mở khóa',
    type: [UserTitle],
  })
  async checkAndUnlock(@Request() req): Promise<UserTitle[]> {
    return this.titlesService.checkAndUnlockEligibleTitles(req.user.id);
  }

  // Admin endpoints
  @Get('admin')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Admin: Lấy tất cả danh hiệu' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách tất cả danh hiệu cho admin',
    type: [Title],
  })
  async getAdminTitles(): Promise<Title[]> {
    return this.titlesService.getAllTitles(true); // Include hidden titles for admin
  }

  @Post('admin/create')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Admin: Tạo danh hiệu mới' })
  @ApiResponse({
    status: 201,
    description: 'Danh hiệu đã được tạo',
    type: Title,
  })
  async createTitle(@Body() titleData: Partial<Title>): Promise<Title> {
    return this.titlesService.createTitle(titleData);
  }

  @Put('admin/:titleId')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Admin: Cập nhật danh hiệu' })
  @ApiResponse({
    status: 200,
    description: 'Danh hiệu đã được cập nhật',
    type: Title,
  })
  async updateTitle(
    @Param('titleId') titleId: number,
    @Body() titleData: Partial<Title>,
  ): Promise<Title> {
    return this.titlesService.updateTitle(titleId, titleData);
  }

  @Delete('admin/:titleId')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Admin: Xóa danh hiệu' })
  @ApiResponse({
    status: 200,
    description: 'Danh hiệu đã được xóa',
  })
  async deleteTitle(@Param('titleId') titleId: number): Promise<void> {
    return this.titlesService.deleteTitle(titleId);
  }

  @Post('admin/unlock/:userId/:titleId')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Admin: Mở khóa danh hiệu cho user' })
  @ApiResponse({
    status: 201,
    description: 'Danh hiệu đã được mở khóa cho user',
    type: UserTitle,
  })
  async unlockTitleForUser(
    @Param('userId') userId: number,
    @Param('titleId') titleId: number,
    @Body() body: { source?: string },
  ): Promise<UserTitle> {
    return this.titlesService.unlockTitle(userId, titleId, body.source || 'Admin grant');
  }

  @Post('admin/send-to-user')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Admin: Gửi danh hiệu cho user cụ thể' })
  @ApiResponse({
    status: 201,
    description: 'Danh hiệu đã được gửi cho user',
    type: UserTitle,
  })
  async sendTitleToUser(
    @Body() body: { titleId: number; username: string; reason?: string },
  ): Promise<UserTitle> {
    return this.titlesService.sendTitleToUser(body.titleId, body.username, body.reason);
  }

  @Post('admin/initialize')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Admin: Khởi tạo danh hiệu mặc định' })
  @ApiResponse({
    status: 200,
    description: 'Danh hiệu mặc định đã được khởi tạo',
  })
  async initializeDefaultTitles(): Promise<void> {
    return this.titlesService.initializeDefaultTitles();
  }
}

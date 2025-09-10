import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DonorService } from './donor.service';
import {
  CreateDonorDto,
  UpdateDonorDto,
  DonorResponseDto,
  DonorStatsDto,
} from './donor.dto';

@Controller('donors')
@UseGuards(JwtAuthGuard)
export class DonorController {
  constructor(private readonly donorService: DonorService) {}

  @Post()
  async createDonor(@Body() dto: CreateDonorDto): Promise<DonorResponseDto> {
    return this.donorService.createDonor(dto);
  }

  @Get()
  async getAllDonors(): Promise<DonorResponseDto[]> {
    return this.donorService.getAllDonors();
  }

  @Get('stats')
  async getDonorStats(): Promise<DonorStatsDto> {
    return this.donorService.getDonorStats();
  }

  @Get('top')
  async getTopDonors(
    @Query('limit') limit?: number,
  ): Promise<DonorResponseDto[]> {
    return this.donorService.getTopDonors(limit);
  }

  @Get(':id')
  async getDonorById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DonorResponseDto> {
    return this.donorService.getDonorById(id);
  }

  @Get('user/:userId')
  async getDonorsByUser(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<DonorResponseDto[]> {
    return this.donorService.getDonorsByUser(userId);
  }

  @Put(':id')
  async updateDonor(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDonorDto,
  ): Promise<DonorResponseDto> {
    return this.donorService.updateDonor(id, dto);
  }

  @Delete(':id')
  async deleteDonor(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.donorService.deleteDonor(id);
  }
}

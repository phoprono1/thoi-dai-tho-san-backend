/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { QuestService } from './quest.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@Controller('quests')
export class QuestController {
  constructor(private readonly questService: QuestService) {}

  @Post()
  async createQuest(@Body() questData: any) {
    return this.questService.createQuest(questData);
  }

  @Get()
  async getAllQuests() {
    return this.questService.getAllQuests();
  }

  @Put(':id')
  async updateQuest(
    @Param('id', ParseIntPipe) id: number,
    @Body() questData: any,
  ) {
    return await this.questService.updateQuest(id, questData);
  }

  @Delete(':id')
  async deleteQuest(
    @Param('id', ParseIntPipe) id: number,
    @Query('force') forceQuery?: string,
  ) {
    // Allow force deletion via query param `?force=true`
    const force = forceQuery === 'true';
    await this.questService.deleteQuest(id, force);
    return { message: 'Quest deleted successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('user/my-quests')
  async getUserQuests(@Request() req) {
    return this.questService.getUserQuests(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/start')
  async startQuest(@Request() req, @Param('id', ParseIntPipe) questId: number) {
    return this.questService.startQuest(req.user.id, questId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/check-completion')
  async checkQuestCompletion(
    @Request() req,
    @Param('id', ParseIntPipe) questId: number,
  ) {
    // Return authoritative updated objects so frontend can update UI immediately
    const result = await this.questService.checkQuestCompletionForApi(
      req.user.id,
      questId,
    );
    return result;
  }

  // Public endpoint to fetch a single quest by id (useful for resolving names)
  @Get(':id')
  async getQuestById(@Param('id', ParseIntPipe) id: number) {
    const q = await this.questService.getQuestById(id);
    if (!q) {
      return { status: 404, message: 'Quest not found' };
    }
    return q;
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/update-progress')
  async updateQuestProgress(
    @Request() req,
    @Param('id', ParseIntPipe) questId: number,
    @Body() progressUpdate: any,
  ) {
    return this.questService.updateQuestProgress(
      req.user.id,
      questId,
      progressUpdate,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/claim')
  async claimQuestReward(
    @Request() req,
    @Param('id', ParseIntPipe) userQuestId: number,
  ) {
    // userQuestId is the id of the UserQuest row
    return this.questService.claimQuestReward(req.user.id, userQuestId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('user/available')
  async getAvailableQuests(@Request() req) {
    return this.questService.getAvailableQuestsForUser(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('daily/reset')
  async resetDailyQuests(@Request() req) {
    await this.questService.resetAllDailyQuestsForUser(req.user.id);
    return { message: 'Daily quests reset successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('combat-progress')
  async updateQuestProgressFromCombat(
    @Request() req,
    @Body()
    combatData: {
      combatResultId: number;
      dungeonId?: number;
      enemyKills?: { enemyType: string; count: number }[];
      bossDefeated?: boolean;
    },
  ) {
    await this.questService.updateQuestProgressFromCombat(
      req.user.id,
      combatData.combatResultId,
      combatData,
    );
    return { message: 'Quest progress updated from combat' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('user/progress-summary')
  async getQuestProgressSummary(@Request() req) {
    return this.questService.getQuestProgressSummary(req.user.id);
  }

  // Admin endpoints
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin')
  async adminCreateQuest(@Body() questData: any) {
    return this.questService.createQuest(questData);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin')
  async adminGetAllQuests() {
    return this.questService.getAllQuests();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put('admin/:id')
  async adminUpdateQuest(
    @Param('id', ParseIntPipe) id: number,
    @Body() questData: any,
  ) {
    return await this.questService.updateQuest(id, questData);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('admin/:id')
  async adminDeleteQuest(
    @Param('id', ParseIntPipe) id: number,
    @Query('force') forceQuery?: string,
  ) {
    // Allow force deletion via query param `?force=true`
    const force = forceQuery === 'true';
    await this.questService.deleteQuest(id, force);
    return { message: 'Quest deleted successfully' };
  }
}

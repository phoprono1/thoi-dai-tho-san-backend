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
} from '@nestjs/common';
import { QuestService } from './quest.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

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
  async deleteQuest(@Param('id', ParseIntPipe) id: number) {
    await this.questService.deleteQuest(id);
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
    const isCompleted = await this.questService.checkQuestCompletion(
      req.user.id,
      questId,
    );
    return { completed: isCompleted };
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
}

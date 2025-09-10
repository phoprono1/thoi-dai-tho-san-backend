/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { SendMessageDto, ChatMessageResponseDto } from './chat.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Post('send')
  async sendMessage(
    @Body() dto: SendMessageDto,
    @Request() req: any,
  ): Promise<ChatMessageResponseDto> {
    return this.chatService.sendMessage(req.user.id, dto);
  }

  @Get('world')
  async getWorldMessages(
    @Query('limit') limit?: string,
  ): Promise<ChatMessageResponseDto[]> {
    const limitNum = limit ? parseInt(limit) : 50;
    return this.chatService.getWorldMessages(limitNum);
  }

  @Get('guild/:guildId')
  async getGuildMessages(
    @Param('guildId') guildId: string,
    @Query('limit') limit?: string,
  ): Promise<ChatMessageResponseDto[]> {
    const limitNum = limit ? parseInt(limit) : 50;
    return this.chatService.getGuildMessages(parseInt(guildId), limitNum);
  }

  @Delete('message/:messageId')
  async deleteMessage(
    @Param('messageId') messageId: string,
    @Request() req: any,
  ): Promise<{ message: string }> {
    await this.chatService.deleteMessage(parseInt(messageId), req.user.id);
    return { message: 'Message deleted successfully' };
  }
}

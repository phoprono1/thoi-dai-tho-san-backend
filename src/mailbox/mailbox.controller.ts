import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { MailboxService } from './mailbox.service';
import { SendMailDto } from './mailbox.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('mailbox')
@UseGuards(JwtAuthGuard)
export class MailboxController {
  constructor(private readonly mailboxService: MailboxService) {}

  @Get()
  async getUserMails(@Request() req: any) {
    return this.mailboxService.getUserMails(req.user.id);
  }

  @Get('unread-count')
  async getUnreadCount(@Request() req: any) {
    const count = await this.mailboxService.getUnreadCount(req.user.id);
    return { unreadCount: count };
  }

  @Post('send')
  async sendMail(@Body() dto: SendMailDto) {
    return this.mailboxService.sendMail(dto);
  }

  @Post(':mailId/read')
  async markAsRead(@Param('mailId') mailId: string, @Request() req: any) {
    return this.mailboxService.markAsRead(parseInt(mailId), req.user.id);
  }

  @Post(':mailId/claim')
  async claimRewards(@Param('mailId') mailId: string, @Request() req: any) {
    return this.mailboxService.claimRewards(parseInt(mailId), req.user.id);
  }

  @Delete(':mailId')
  async deleteMail(@Param('mailId') mailId: string, @Request() req: any) {
    await this.mailboxService.deleteMail(parseInt(mailId), req.user.id);
    return { message: 'Mail deleted successfully' };
  }
}

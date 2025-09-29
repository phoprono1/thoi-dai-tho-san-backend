import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { ChatMessage } from './chat-message.entity';
import { GuildMember } from '../guild/guild.entity';
import { UsersModule } from '../users/users.module';
import { GuildModule } from '../guild/guild.module';
import { User } from '../users/user.entity';
import { CommonModule } from '../common/common.module';
import { UserTitle } from '../titles/user-title.entity';
import { Title } from '../titles/title.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChatMessage,
      User,
      GuildMember,
      UserTitle,
      Title,
    ]),
    UsersModule,
    GuildModule,
    CommonModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: configService.get<string>('JWT_EXPIRES_IN') },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}

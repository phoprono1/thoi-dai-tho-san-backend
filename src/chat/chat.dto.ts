import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  Length,
} from 'class-validator';
import { ChatType } from './chat-message.entity';

export class SendMessageDto {
  @IsString()
  @Length(1, 500)
  message: string;

  @IsEnum(ChatType)
  type: ChatType;

  @IsOptional()
  @IsNumber()
  guildId?: number;
}

export class ChatMessageResponseDto {
  id: number;
  userId: number;
  username: string;
  message: string;
  type: ChatType;
  guildId?: number;
  createdAt: Date;
  userTitle?: {
    name: string;
    prefix?: string;
    displayEffects?: {
      color?: string;
      backgroundColor?: string;
      borderColor?: string;
      glow?: boolean;
      animation?: string;
    };
  };
}

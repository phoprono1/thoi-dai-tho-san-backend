import { IsEnum } from 'class-validator';
import { GuildMemberRole } from '../guild.entity';

export class AssignRoleDto {
  @IsEnum(GuildMemberRole)
  role: GuildMemberRole;
}

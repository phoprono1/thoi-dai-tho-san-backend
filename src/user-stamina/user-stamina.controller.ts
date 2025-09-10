import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { UserStaminaService } from './user-stamina.service';

@ApiTags('user-stamina')
@Controller('user-stamina')
export class UserStaminaController {
  constructor(private readonly userStaminaService: UserStaminaService) {}

  @Get(':userId')
  @ApiOperation({ summary: 'Lấy thông tin stamina của người chơi' })
  @ApiParam({ name: 'userId', description: 'ID của người chơi' })
  @ApiResponse({
    status: 200,
    description: 'Thông tin stamina của người chơi',
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'number', example: 1 },
        currentStamina: { type: 'number', example: 8 },
        maxStamina: { type: 'number', example: 10 },
        lastRegeneration: {
          type: 'string',
          format: 'date-time',
          example: '2024-01-01T12:00:00Z',
        },
        nextRegeneration: {
          type: 'string',
          format: 'date-time',
          example: '2024-01-01T12:05:00Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy thông tin stamina của người chơi',
  })
  async getUserStamina(@Param('userId') userId: string) {
    return this.userStaminaService.getUserStamina(+userId);
  }
}

import {
  IsInt,
  IsPositive,
  IsOptional,
  IsObject,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MaterialRequirementDto {
  @ApiProperty({ description: 'Item ID của vật phẩm nguyên liệu' })
  @IsInt()
  @IsPositive()
  itemId: number;

  @ApiProperty({ description: 'Số lượng cần thiết' })
  @IsInt()
  @IsPositive()
  quantity: number;
}

export class UpgradePetDto {
  @ApiProperty({ description: 'ID của user pet cần nâng cấp' })
  @IsInt()
  @IsPositive()
  userPetId: number;

  @ApiPropertyOptional({
    description: 'Danh sách nguyên liệu người dùng muốn sử dụng',
    type: [MaterialRequirementDto],
  })
  @IsOptional()
  materials?: MaterialRequirementDto[];
}

export class CreateUpgradeMaterialDto {
  @ApiProperty({ description: 'ID của pet definition' })
  @IsInt()
  @IsPositive()
  petDefinitionId: number;

  @ApiProperty({
    description: 'Level đích (level mà pet sẽ đạt được sau khi nâng cấp)',
  })
  @IsInt()
  @Min(2)
  level: number;

  @ApiPropertyOptional({
    description:
      'ID của item nguyên liệu (không bắt buộc cho gold-only upgrade)',
  })
  @ValidateIf(
    (o: CreateUpgradeMaterialDto) =>
      o.quantity !== undefined && o.quantity !== null,
  )
  @IsInt()
  @IsPositive()
  materialItemId?: number | null;

  @ApiPropertyOptional({
    description:
      'Số lượng nguyên liệu cần thiết (không bắt buộc cho gold-only upgrade)',
  })
  @ValidateIf(
    (o: CreateUpgradeMaterialDto) =>
      o.materialItemId !== undefined && o.materialItemId !== null,
  )
  @IsInt()
  @IsPositive()
  quantity?: number | null;

  @ApiProperty({ description: 'Chi phí vàng', default: 0 })
  @IsInt()
  @Min(0)
  goldCost: number;

  @ApiPropertyOptional({
    description: 'Chỉ số tăng thêm khi đạt level này',
    example: { attack: 10, defense: 5, hp: 50 },
  })
  @IsOptional()
  @IsObject()
  statIncrease?: {
    attack?: number;
    defense?: number;
    hp?: number;
    critRate?: number;
    critDamage?: number;
  };
}

export class UpdateUpgradeMaterialDto {
  @ApiPropertyOptional({ description: 'Số lượng nguyên liệu cần thiết' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  quantity?: number;

  @ApiPropertyOptional({ description: 'Chi phí vàng' })
  @IsOptional()
  @IsInt()
  @Min(0)
  goldCost?: number;

  @ApiPropertyOptional({
    description: 'Chỉ số tăng thêm khi đạt level này',
    example: { attack: 10, defense: 5, hp: 50 },
  })
  @IsOptional()
  @IsObject()
  statIncrease?: {
    attack?: number;
    defense?: number;
    hp?: number;
    critRate?: number;
    critDamage?: number;
  };
}

export class UpgradeRequirementResponseDto {
  @ApiProperty()
  level: number;

  @ApiProperty({ type: [Object] })
  materials: Array<{
    itemId: number;
    itemName: string;
    quantity: number;
    playerHas: number;
    hasEnough: boolean;
  }>;

  @ApiProperty()
  goldCost: number;

  @ApiProperty()
  playerGold: number;

  @ApiProperty()
  hasEnoughGold: boolean;

  @ApiProperty()
  canUpgrade: boolean;

  @ApiProperty({ required: false })
  statIncrease?: {
    attack?: number;
    defense?: number;
    hp?: number;
    critRate?: number;
    critDamage?: number;
  };
}

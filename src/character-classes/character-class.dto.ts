import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsObject,
  IsArray,
} from 'class-validator';
import {
  ClassType,
  ClassTier,
  AdvancementStatus,
} from './character-class.entity';

export class CreateCharacterClassDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsEnum(ClassType)
  type: ClassType;

  @IsEnum(ClassTier)
  tier: ClassTier;

  @IsNumber()
  requiredLevel: number;

  @IsObject()
  statBonuses: {
    strength?: number;
    intelligence?: number;
    dexterity?: number;
    vitality?: number;
    luck?: number;
    // Advanced stats
    critRate?: number;
    critDamage?: number;
    comboRate?: number;
    counterRate?: number;
    lifesteal?: number;
    armorPen?: number;
    dodgeRate?: number;
    accuracy?: number;
  };

  @IsArray()
  skillUnlocks: Array<{
    skillId: number;
    skillName: string;
    description: string;
  }>;

  @IsOptional()
  @IsObject()
  advancementRequirements?: {
    dungeons: Array<{
      dungeonId: number;
      dungeonName: string;
      requiredCompletions: number;
    }>;
    quests: Array<{
      questId: number;
      questName: string;
    }>;
    items: Array<{
      itemId: number;
      itemName: string;
      quantity: number;
    }>;
  };

  @IsOptional()
  @IsNumber()
  previousClassId?: number;
}

export class UpdateCharacterClassDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ClassType)
  type?: ClassType;

  @IsOptional()
  @IsEnum(ClassTier)
  tier?: ClassTier;

  @IsOptional()
  @IsNumber()
  requiredLevel?: number;

  @IsOptional()
  @IsObject()
  statBonuses?: {
    strength?: number;
    intelligence?: number;
    dexterity?: number;
    vitality?: number;
    luck?: number;
    // Advanced stats
    critRate?: number;
    critDamage?: number;
    comboRate?: number;
    counterRate?: number;
    lifesteal?: number;
    armorPen?: number;
    dodgeRate?: number;
    accuracy?: number;
  };

  @IsOptional()
  @IsArray()
  skillUnlocks?: Array<{
    skillId: number;
    skillName: string;
    description: string;
  }>;

  @IsOptional()
  @IsObject()
  advancementRequirements?: {
    dungeons: Array<{
      dungeonId: number;
      dungeonName: string;
      requiredCompletions: number;
    }>;
    quests: Array<{
      questId: number;
      questName: string;
    }>;
    items: Array<{
      itemId: number;
      itemName: string;
      quantity: number;
    }>;
  };

  @IsOptional()
  @IsNumber()
  previousClassId?: number;
}

export class CharacterClassResponseDto {
  id: number;
  name: string;
  description: string;
  type: ClassType;
  tier: ClassTier;
  requiredLevel: number;
  statBonuses: any;
  skillUnlocks: any[];
  advancementRequirements?: any;
  previousClassId?: number;
  previousClass?: CharacterClassResponseDto;
  createdAt: Date;
  updatedAt: Date;
}

export class AdvancementRequirementDto {
  @IsNumber()
  userId: number;

  @IsNumber()
  targetClassId: number;
}

export class AdvancementCheckResultDto {
  canAdvance: boolean;
  missingRequirements: {
    level?: number;
    dungeons?: Array<{
      dungeonId: number;
      dungeonName: string;
      required: number;
      current: number;
    }>;
    quests?: Array<{
      questId: number;
      questName: string;
    }>;
    items?: Array<{
      itemId: number;
      itemName: string;
      required: number;
      current: number;
    }>;
  };
  availableClasses: CharacterClassResponseDto[];
}

export class PerformAdvancementDto {
  @IsNumber()
  userId: number;

  @IsNumber()
  targetClassId: number;
}

export class AdvancementResultDto {
  success: boolean;
  newClass: CharacterClassResponseDto;
  statChanges: {
    strength?: number;
    intelligence?: number;
    dexterity?: number;
    vitality?: number;
    luck?: number;
  };
  unlockedSkills: Array<{
    skillId: number;
    skillName: string;
    description: string;
  }>;
  message: string;
  // IDs of items that were auto-unequipped because they are incompatible with the
  // newly-assigned class. Optional and provided for the client to update caches/UI.
  unequippedItemIds?: number[];
}

export class CharacterAdvancementResponseDto {
  id: number;
  userId: number;
  currentClass: CharacterClassResponseDto;
  advancementStatus: AdvancementStatus;
  completedRequirements?: any;
  advancementDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class CreateMappingDto {
  toClassId: number;
  levelRequired: number;
  weight?: number;
  allowPlayerChoice?: boolean;
  isAwakening?: boolean;
  requirements?: any;
}

export class UpdateMappingDto {
  toClassId?: number;
  levelRequired?: number;
  weight?: number;
  allowPlayerChoice?: boolean;
  isAwakening?: boolean;
  requirements?: any;
}

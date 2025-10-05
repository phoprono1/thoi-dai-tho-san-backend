import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { PetDefinition } from './pet-definition.entity';
import { PetEvolution } from './pet-evolution.entity';
import { UserPet } from './user-pet.entity';
import { PetAbility } from './entities/pet-ability.entity';
import { PetEquipment } from './pet-equipment.entity';
import { PetFeedingItem } from './pet-feeding-item.entity';
import { PetBanner } from './pet-banner.entity';
import { UserPetBannerPity } from './user-pet-banner-pity.entity';
import { PetGachaPull } from './pet-gacha-pull.entity';
import { PetUpgradeMaterial } from './pet-upgrade-material.entity';

// Services
import { PetService } from './pet.service';
import { PetGachaService } from './pet-gacha.service';
import { PetAbilityService } from './pet-ability.service';

// Controllers
import { PetController } from './pet.controller';
import { AdminPetController } from './admin-pet.controller';
import { PetAbilityController } from './pet-ability.controller';

// External dependencies
import { User } from '../users/user.entity';
import { UserItem } from '../user-items/user-item.entity';
import { Item } from '../items/item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      // Pet System Entities
      PetDefinition,
      PetEvolution,
      UserPet,
      PetAbility,
      PetEquipment,
      PetFeedingItem,
      PetBanner,
      UserPetBannerPity,
      PetGachaPull,
      PetUpgradeMaterial,
      // External Entities
      User,
      UserItem,
      Item,
    ]),
  ],
  providers: [PetService, PetGachaService, PetAbilityService],
  controllers: [PetController, AdminPetController, PetAbilityController],
  exports: [PetService, PetGachaService, PetAbilityService],
})
export class PetsModule {}

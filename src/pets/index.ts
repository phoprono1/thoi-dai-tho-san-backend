// Pet System Entities
export { PetDefinition } from './pet-definition.entity';
export { PetEvolution } from './pet-evolution.entity';
export { UserPet } from './user-pet.entity';
export { PetAbility } from './entities/pet-ability.entity';
export { PetEquipment } from './pet-equipment.entity';
export { PetFeedingItem } from './pet-feeding-item.entity';
export { PetBanner } from './pet-banner.entity';
export { UserPetBannerPity } from './user-pet-banner-pity.entity';
export { PetGachaPull } from './pet-gacha-pull.entity';

// Types
export type { PetBaseStats } from './pet-definition.entity';

export type { BannerType, FeaturedPet, DropRates } from './pet-banner.entity';

export type {
  AbilityType,
  TargetType,
  AbilityEffects,
} from './interfaces/pet-ability.interface';

export type {
  EquipmentSlot,
  EquipmentRarity,
  StatBoost,
  SpecialEffect,
} from './pet-equipment.entity';

export type {
  FeedingItemType,
  FeedingEffect,
  UsageRequirement,
} from './pet-feeding-item.entity';

export type { PullType } from './pet-gacha-pull.entity';

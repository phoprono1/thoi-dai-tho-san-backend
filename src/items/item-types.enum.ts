export enum ItemType {
  // Player Equipment slots (6 total)
  WEAPON = 'weapon', // Vũ khí chính
  HELMET = 'helmet', // Mũ/Nón bảo hộ
  ARMOR = 'armor', // Áo giáp
  GLOVES = 'gloves', // Găng tay
  BOOTS = 'boots', // Giày/Ủng
  ACCESSORY = 'accessory', // Phụ kiện (nhẫn, dây chuyền)

  // Pet Equipment slots (4 total)
  PET_COLLAR = 'pet_collar', // Vòng cổ pet
  PET_ARMOR = 'pet_armor', // Áo giáp pet
  PET_ACCESSORY = 'pet_accessory', // Phụ kiện pet
  PET_WEAPON = 'pet_weapon', // Vũ khí pet

  // Non-equipment items
  CONSUMABLE = 'consumable',
  MATERIAL = 'material',
  QUEST = 'quest',
}

// Equipment slot mapping for UI
export const EQUIPMENT_SLOTS = {
  WEAPON: { name: 'Vũ khí', icon: '⚔️', order: 1 },
  HELMET: { name: 'Mũ', icon: '🛡️', order: 2 },
  ARMOR: { name: 'Áo giáp', icon: '🥼', order: 3 },
  GLOVES: { name: 'Găng tay', icon: '🧤', order: 4 },
  BOOTS: { name: 'Giày', icon: '👢', order: 5 },
  ACCESSORY: { name: 'Phụ kiện', icon: '💍', order: 6 },
} as const;

// Pet Equipment slot mapping
export const PET_EQUIPMENT_SLOTS = {
  PET_COLLAR: { name: 'Vòng cổ', icon: '🎀', slot: 'collar', order: 1 },
  PET_ARMOR: { name: 'Áo giáp', icon: '🛡️', slot: 'armor', order: 2 },
  PET_ACCESSORY: { name: 'Phụ kiện', icon: '💍', slot: 'accessory', order: 3 },
  PET_WEAPON: { name: 'Vũ khí', icon: '⚔️', slot: 'weapon', order: 4 },
} as const;

// Helper function to check if item is pet equipment
export function isPetEquipmentType(type: ItemType): boolean {
  return [
    ItemType.PET_COLLAR,
    ItemType.PET_ARMOR,
    ItemType.PET_ACCESSORY,
    ItemType.PET_WEAPON,
  ].includes(type);
}

// Helper function to get pet equipment slot from item type
export function getPetEquipmentSlot(type: ItemType): string | null {
  const mapping = {
    [ItemType.PET_COLLAR]: 'collar',
    [ItemType.PET_ARMOR]: 'armor',
    [ItemType.PET_ACCESSORY]: 'accessory',
    [ItemType.PET_WEAPON]: 'weapon',
  };
  return mapping[type] || null;
}

// Helper function to check if slot matches item type
export function slotMatchesItemType(slot: string, type: ItemType): boolean {
  return getPetEquipmentSlot(type) === slot;
}

export enum ConsumableType {
  HP_POTION = 'hp_potion',
  MP_POTION = 'mp_potion', // DEPRECATED: Đang dùng cho stamina/energy potion (giữ để tương thích DB)
  MANA_POTION = 'mana_potion', // ✅ NEW: Lọ hồi mana thực sự
  ENERGY_POTION = 'energy_potion', // Sẽ migrate sau
  EXP_POTION = 'exp_potion',
  STAT_BOOST = 'stat_boost',
  PERMANENT_STAT_BOOST = 'permanent_stat_boost', // Sẽ migrate sau
}

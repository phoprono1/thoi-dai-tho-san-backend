export enum ItemType {
  // Equipment slots (6 total)
  WEAPON = 'weapon',        // Vũ khí chính
  HELMET = 'helmet',        // Mũ/Nón bảo hộ
  ARMOR = 'armor',          // Áo giáp
  GLOVES = 'gloves',        // Găng tay
  BOOTS = 'boots',          // Giày/Ủng
  ACCESSORY = 'accessory',  // Phụ kiện (nhẫn, dây chuyền)
  
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

export enum ConsumableType {
  HP_POTION = 'hp_potion',
  MP_POTION = 'mp_potion', // Giữ lại tạm thời cho tương thích
  ENERGY_POTION = 'energy_potion', // Sẽ migrate sau
  EXP_POTION = 'exp_potion',
  STAT_BOOST = 'stat_boost',
  PERMANENT_STAT_BOOST = 'permanent_stat_boost', // Sẽ migrate sau
}

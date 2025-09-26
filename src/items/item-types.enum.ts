export enum ItemType {
  WEAPON = 'weapon',
  ARMOR = 'armor',
  ACCESSORY = 'accessory',
  CONSUMABLE = 'consumable',
  MATERIAL = 'material',
  QUEST = 'quest',
}

export enum ConsumableType {
  HP_POTION = 'hp_potion',
  MP_POTION = 'mp_potion', // Giữ lại tạm thời cho tương thích
  ENERGY_POTION = 'energy_potion', // Sẽ migrate sau
  EXP_POTION = 'exp_potion',
  STAT_BOOST = 'stat_boost',
  PERMANENT_STAT_BOOST = 'permanent_stat_boost', // Sẽ migrate sau
}

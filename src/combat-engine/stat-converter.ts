import { CombatStats } from './types';

const CONFIG = {
  p: 0.94,
  atk_from_STR: 0.45,
  atk_from_INT: 0.6,
  atk_from_DEX: 0.18,
  hp_from_VIT: 12,
  def_from_VIT: 0.5,
  critRate_from_LUK: 0.28,
  critDamage_from_LUK: 0.15,
  dodge_from_DEX: 0.25,
  accuracy_from_DEX: 0.35,
  armorPen_from_STR: 0.02,
  lifesteal_from_STR: 0.03,
  combo_from_DEX: 0.08,
  maxCritRate: 75,
  dodgeCap: 70,
};

export function effective(attr: number, p = CONFIG.p) {
  return Math.pow(Math.max(0, attr || 0), p);
}

export function deriveCombatStats(core: {
  baseAttack?: number;
  baseMaxHp?: number;
  baseDefense?: number;
  STR?: number;
  VIT?: number;
  DEX?: number;
  LUK?: number;
  INT?: number;
  // Lowercase versions
  strength?: number;
  vitality?: number;
  dexterity?: number;
  luck?: number;
  intelligence?: number;
  // Player-allocated attribute points
  strengthPoints?: number;
  intelligencePoints?: number;
  dexterityPoints?: number;
  vitalityPoints?: number;
  luckPoints?: number;
}): CombatStats {
  const baseAttack = core.baseAttack ?? 10;
  const baseMaxHp = core.baseMaxHp ?? 100;
  const baseDefense = core.baseDefense ?? 5;

  const s = effective(
    (core.STR ?? core.strength ?? 0) + (core.strengthPoints ?? 0),
  );
  const v = effective(
    (core.VIT ?? core.vitality ?? 0) + (core.vitalityPoints ?? 0),
  );
  const d = effective(
    (core.DEX ?? core.dexterity ?? 0) + (core.dexterityPoints ?? 0),
  );
  const l = effective((core.LUK ?? core.luck ?? 0) + (core.luckPoints ?? 0));
  const i = effective(
    (core.INT ?? core.intelligence ?? 0) + (core.intelligencePoints ?? 0),
  );

  const attack = Math.floor(
    baseAttack +
      CONFIG.atk_from_STR * s +
      CONFIG.atk_from_DEX * d +
      CONFIG.atk_from_INT * i,
  );

  const maxHp = Math.floor(baseMaxHp + CONFIG.hp_from_VIT * v);
  const defense = Math.floor(baseDefense + CONFIG.def_from_VIT * v);

  const critRate = Math.min(
    CONFIG.maxCritRate,
    CONFIG.critRate_from_LUK * l || 0,
  );
  const critDamage = 150 + (CONFIG.critDamage_from_LUK * l || 0);

  const dodgeRate = Math.min(CONFIG.dodgeCap, CONFIG.dodge_from_DEX * d || 0);
  const accuracy = CONFIG.accuracy_from_DEX * d || 0;

  const armorPen = CONFIG.armorPen_from_STR * s || 0;
  const lifesteal = CONFIG.lifesteal_from_STR * s || 0;
  const comboRate = CONFIG.combo_from_DEX * d || 0;
  const counterRate = 0;

  const maxMana = Math.max(
    50,
    Math.floor(((core.INT ?? 0) + (core.intelligencePoints ?? 0)) * 10),
  );

  return {
    maxHp,
    attack,
    defense,
    critRate,
    critDamage,
    lifesteal,
    armorPen,
    dodgeRate,
    accuracy,
    comboRate,
    counterRate,
    maxMana,
    currentMana: maxMana, // Start with full mana
  };
}

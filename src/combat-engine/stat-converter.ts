import { CombatStats } from './types';

export const CONFIG = {
  p: 0.94,
  atk_from_STR: 0.45,
  atk_from_INT: 0.5, // Reduced from 0.6 - mages should rely on skills
  atk_from_DEX: 0.25, // Increased from 0.18 - encourage hybrid builds
  hp_from_VIT: 12,
  def_from_VIT: 0.5,
  mana_from_INT: 10, // Mana scaling: baseMana + 10 * effective(INT)
  critRate_from_LUK: 0.28,
  critDamage_from_LUK: 0.15,
  dodge_from_DEX: 0.25,
  accuracy_from_DEX: 0.35,
  armorPen_from_STR: 0.05, // Increased from 0.02 - more meaningful
  lifesteal_from_LUK: 0.08, // Moved from STR - lifesteal scales with luck
  combo_from_DEX: 0.05, // Reduced from 0.08 - was triggering too often
  counter_from_VIT: 0.08, // New - counter scales with vitality
  maxCritRate: 75,
  dodgeCap: 70,
  baseMana: 50, // Base mana for all characters
  manaRegenPerTurn: 0.1, // Regen 10% maxMana per turn
  // Softcap / clamp parameters (middle-term balancing)
  SOFTCAP: {
    critCap: 60, // percent
    critK: 120,
    dodgeCap: 50, // percent
    dodgeK: 140,
    accuracyCap: 150,
    accuracyK: 120,
  },
};

export function effective(attr: number, p = CONFIG.p) {
  return Math.pow(Math.max(0, attr || 0), p);
}

export function deriveCombatStats(core: {
  baseAttack?: number;
  baseMaxHp?: number;
  baseDefense?: number;
  baseMana?: number;
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
  const baseMana = core.baseMana ?? CONFIG.baseMana;

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

  // Softcap helper: Michaelis-Menten style to produce diminishing returns
  const softcap = (raw: number, cap: number, k: number) => {
    const r = raw || 0;
    return (cap * r) / (r + k);
  };

  // Crit: compute raw then apply softcap and hard upper bound
  const rawCrit = CONFIG.critRate_from_LUK * l || 0;
  const critRateSoft = softcap(
    rawCrit,
    CONFIG.SOFTCAP.critCap,
    CONFIG.SOFTCAP.critK,
  );
  const critRate = Math.min(
    CONFIG.maxCritRate,
    Math.round(critRateSoft * 100) / 100,
  );
  const critDamage = Math.min(
    300,
    Math.round((150 + (CONFIG.critDamage_from_LUK * l || 0)) * 100) / 100,
  );

  // Dodge & Accuracy: softcap to avoid runaway dodge or accuracy
  const rawDodge = CONFIG.dodge_from_DEX * d || 0;
  const dodgeRawSoft = softcap(
    rawDodge,
    CONFIG.SOFTCAP.dodgeCap,
    CONFIG.SOFTCAP.dodgeK,
  );
  const dodgeRate = Math.round(dodgeRawSoft * 100) / 100;
  const rawAccuracy = 85 + (CONFIG.accuracy_from_DEX * d || 0);
  const accuracyBonus = rawAccuracy - 85;
  const accuracySoft =
    85 +
    softcap(
      accuracyBonus,
      CONFIG.SOFTCAP.accuracyCap - 85,
      CONFIG.SOFTCAP.accuracyK,
    );
  const accuracy = Math.round(accuracySoft * 100) / 100;

  const armorPen = CONFIG.armorPen_from_STR * s || 0;
  const lifesteal = CONFIG.lifesteal_from_LUK * l || 0; // Lifesteal scales with luck
  const comboRate = CONFIG.combo_from_DEX * d || 0;
  const counterRate = CONFIG.counter_from_VIT * v || 0; // Counter scales with vitality

  // Mana formula: baseMana + mana_from_INT * effective(INT)
  // Same pattern as HP: baseMaxHp + hp_from_VIT * effective(VIT)
  const maxMana = Math.floor(baseMana + CONFIG.mana_from_INT * i);

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

import { UserStat } from '../user-stats/user-stat.entity';
import { UserItem } from '../user-items/user-item.entity';
import { deriveCombatStats } from '../combat-engine/stat-converter';

export type ComputeOptions = {
  exponent?: number; // p
  coeffs?: {
    atkFromSTR?: number;
    atkFromINT?: number;
    atkFromDEX?: number;
    hpFromVIT?: number;
    defFromVIT?: number;
  };
  weights?: {
    attack?: number;
    hp?: number;
    defense?: number;
    misc?: number;
  };
  // stacking options: how multiple copies of the same item scale
  stack?: {
    // multiplicative coefficient applied per extra stack (default 1.15)
    coeff?: number;
    // method of stacking. Currently only 'pow' supported which multiplies by coeff^(q-1)
    method?: 'pow' | 'linear';
  };
};

export function computeCombatPowerFromStats(
  userStat: Partial<UserStat>,
  equippedItems: UserItem[] = [],
  opts: ComputeOptions = {},
): number {
  const p = opts.exponent ?? 0.94;

  // Updated coefficients to match stat-converter.ts
  const coeffs = {
    atkFromSTR: 0.45, // stat-converter: atk_from_STR = 0.45
    atkFromINT: 0.6, // stat-converter: atk_from_INT = 0.6
    atkFromDEX: 0.18, // stat-converter: atk_from_DEX = 0.18
    hpFromVIT: 12, // stat-converter: hp_from_VIT = 12
    defFromVIT: 0.5, // stat-converter: def_from_VIT = 0.5
    defFromDEX: 0.0, // DEX doesn't contribute to defense in stat-converter
    ...(opts.coeffs || {}),
  };

  const weights = {
    attack: 1.0,
    hp: 0.1, // Slightly higher weight for HP
    defense: 1.5, // Lower weight for defense to balance
    misc: 0.8, // Higher weight for crit/luck
    ...(opts.weights || {}),
  };

  const stackCfg = {
    coeff: 1.15,
    method: 'pow' as 'pow' | 'linear',
    ...(opts.stack || {}),
  };

  const STR =
    Math.max(0, userStat.strength || 0) + (userStat.strengthPoints || 0);
  const INT =
    Math.max(0, userStat.intelligence || 0) +
    (userStat.intelligencePoints || 0);
  const DEX =
    Math.max(0, userStat.dexterity || 0) + (userStat.dexterityPoints || 0);
  const VIT =
    Math.max(0, userStat.vitality || 0) + (userStat.vitalityPoints || 0);
  const LUK = Math.max(0, userStat.luck || 0) + (userStat.luckPoints || 0);

  const eff = (a: number) => Math.pow(a, p);

  // Equip contributions (flattened for now)
  let equipAttackFlat = 0;
  let equipAttackMult = 0;
  let equipHpFlat = 0;
  let equipHpMult = 0;
  let equipDefFlat = 0;

  for (const it of equippedItems) {
    if (!it || !it.item) continue;
    const s = it.item.stats || {};

    // If the item is equipped (worn), count only one instance regardless of quantity.
    // Otherwise treat quantity as the stack size and apply stacking coefficient.
    const rawQty = Math.max(1, it.quantity || 1);
    const qty = it.isEquipped ? 1 : rawQty;

    // stacking multiplier: for quantity q > 1, use either linear or pow method
    let stackMultiplier = 1;
    if (qty > 1) {
      if (stackCfg.method === 'linear') {
        // linear: scale proportionally but apply coeff as extra per stack
        // total = base * (q * coeff)
        stackMultiplier = stackCfg.coeff * qty;
      } else {
        // pow: total = base * qty * coeff^(qty-1)
        stackMultiplier = qty * Math.pow(stackCfg.coeff, qty - 1);
      }
    } else {
      stackMultiplier = 1;
    }

    // Calculate derived stats from item's core attributes
    const itemDerivedStats = deriveCombatStats({
      baseAttack: 0, // Items don't have base stats, only bonuses
      baseMaxHp: 0,
      baseDefense: 0,
      ...s, // Spread the core attributes from item stats
    });

    equipAttackFlat += (itemDerivedStats.attack || 0) * stackMultiplier;
    // items currently don't have multiplicative fields in schema; keep attackMult 0
    equipAttackMult += 0;
    equipHpFlat += (itemDerivedStats.maxHp || 0) * stackMultiplier;
    equipHpMult += 0;
    equipDefFlat += (itemDerivedStats.defense || 0) * stackMultiplier;
  }

  const baseAttack = 10; // Base attack constant
  const baseMaxHp = 100; // Base HP constant
  const baseDefense = 5; // Base defense constant

  const finalAttack =
    Math.floor(
      baseAttack +
        equipAttackFlat +
        coeffs.atkFromSTR * eff(STR) +
        coeffs.atkFromINT * eff(INT) +
        coeffs.atkFromDEX * eff(DEX), // All three contribute to attack
    ) *
    (1 + equipAttackMult);

  const finalMaxHp =
    Math.floor(baseMaxHp + equipHpFlat + coeffs.hpFromVIT * eff(VIT)) *
    (1 + equipHpMult);

  const finalDefense = Math.floor(
    baseDefense + equipDefFlat + coeffs.defFromVIT * eff(VIT), // VIT contributes to defense
  );

  // Misc score from LUK (crit rate), INT (mana/crit damage), and DEX (dodge/combo)
  const misc = LUK * 1.0 + INT * 0.5 + DEX * 0.3;

  const power =
    weights.attack * finalAttack +
    weights.hp * finalMaxHp +
    weights.defense * finalDefense +
    weights.misc * misc;

  return Math.max(0, Math.floor(power));
}

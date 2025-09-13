import { UserStat } from '../user-stats/user-stat.entity';
import { UserItem } from '../user-items/user-item.entity';

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
};

export function computeCombatPowerFromStats(
  userStat: Partial<UserStat>,
  equippedItems: UserItem[] = [],
  opts: ComputeOptions = {},
): number {
  const p = opts.exponent ?? 0.94;
  const coeffs = {
    atkFromSTR: 0.45,
    atkFromINT: 0.6,
    atkFromDEX: 0.18,
    hpFromVIT: 12,
    defFromVIT: 0.5,
    ...(opts.coeffs || {}),
  };

  const weights = {
    attack: 1,
    hp: 0.08,
    defense: 2.5,
    misc: 0.5,
    ...(opts.weights || {}),
  };

  const STR = Math.max(0, userStat.strength || 0);
  const INT = Math.max(0, userStat.intelligence || 0);
  const DEX = Math.max(0, userStat.dexterity || 0);
  const VIT = Math.max(0, userStat.vitality || 0);
  const LUK = Math.max(0, userStat.luck || 0);

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
    equipAttackFlat += (s.attack || 0) * (it.quantity || 1);
    // items currently don't have multiplicative fields in schema; keep attackMult 0
    equipAttackMult += 0;
    equipHpFlat += (s.hp || 0) * (it.quantity || 1);
    equipHpMult += 0;
    equipDefFlat += (s.defense || 0) * (it.quantity || 1);
  }

  const baseAttack = userStat.attack || 0;
  const baseMaxHp = userStat.maxHp || 0;
  const baseDefense = userStat.defense || 0;

  const finalAttack =
    Math.floor(
      baseAttack +
        equipAttackFlat +
        coeffs.atkFromSTR * eff(STR) +
        coeffs.atkFromINT * eff(INT) +
        coeffs.atkFromDEX * eff(DEX),
    ) *
    (1 + equipAttackMult);

  const finalMaxHp =
    Math.floor(baseMaxHp + equipHpFlat + coeffs.hpFromVIT * eff(VIT)) *
    (1 + equipHpMult);

  const finalDefense = Math.floor(
    baseDefense + equipDefFlat + coeffs.defFromVIT * eff(VIT),
  );

  // Simple misc score from LUK (crit) and DEX (accuracy/dodge)
  const misc = LUK * 0.5 + DEX * 0.3;

  const power =
    weights.attack * finalAttack +
    weights.hp * finalMaxHp +
    weights.defense * finalDefense +
    weights.misc * misc;

  return Math.max(0, Math.floor(power));
}

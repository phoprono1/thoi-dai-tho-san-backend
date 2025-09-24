import { SkillCondition, CombatActorInput } from './types';

export function checkSkillConditions(
  skillConditions: SkillCondition[] | undefined,
  player: CombatActorInput,
  enemies: CombatActorInput[],
  turn: number,
): boolean {
  if (!skillConditions || skillConditions.length === 0) {
    return true;
  }

  return skillConditions.every((condition) => {
    switch (condition.type) {
      case 'always':
        return true;

      case 'player_hp_below': {
        const playerHpPercent =
          ((player.currentHp ?? player.stats.maxHp) / player.stats.maxHp) * 100;
        return playerHpPercent <= (condition.value ?? 0);
      }

      case 'enemy_hp_below': {
        const lowestHpEnemy = enemies.reduce((lowest, enemy) => {
          const lowestHpPercent =
            (lowest.currentHp ?? lowest.stats.maxHp) / lowest.stats.maxHp;
          const enemyHpPercent =
            (enemy.currentHp ?? enemy.stats.maxHp) / enemy.stats.maxHp;
          return enemyHpPercent < lowestHpPercent ? enemy : lowest;
        });
        const lowestHpPercent =
          ((lowestHpEnemy.currentHp ?? lowestHpEnemy.stats.maxHp) /
            lowestHpEnemy.stats.maxHp) *
          100;
        return lowestHpPercent <= (condition.value ?? 0);
      }

      case 'enemy_count': {
        return (
          enemies.filter((e) => (e.currentHp ?? 0) > 0).length <=
          (condition.value ?? 0)
        );
      }

      case 'turn_count': {
        return turn >= (condition.value ?? 0);
      }

      case 'mana_above': {
        const currentMana = player.stats.currentMana ?? player.stats.maxMana;
        const manaPercent = (currentMana / player.stats.maxMana) * 100;
        return manaPercent >= (condition.value ?? 0);
      }

      default:
        return false;
    }
  });
}

# Combat Simulation Report (Repo Skills)
Date: 2025-10-10T14:02:37.182Z

## Parameters
- Runs: 1000
- Player core: {"STR":100,"INT":40,"DEX":31,"VIT":100,"LUK":53}
- Skills used: Quick Attack (formula: STR * 0.8 + level * 5), Fireball (formula: INT * 1.5 + level * 15)

## Summary Metrics
- avgTurns: 40.82
- avgLogsPerRun: 92.86
- avgPlayerDamagePerTurn: 73.38
- avgEnemyDamagePerTurn: 13.53
- hitRate: 96.87%
- missRate: 3.13%
- critRate (per hit): 0.98%

## Damage per hit percentiles
- p25: 15
- p50 (median): 58
- p75: 76
- p90: 82
- p99: 86

## Logs per run distribution
- min: 87
- max: 99
- avg: 92.86

## Recommendations
- Avoid formulas that scale directly with raw core stats (e.g., STR * 5) unless the stat is intentionally small; prefer derived `attack` or bounded multipliers.
- Consider formulas like `attack * x + level * y` or `min(attack * x, cap)` to prevent runaway damage.
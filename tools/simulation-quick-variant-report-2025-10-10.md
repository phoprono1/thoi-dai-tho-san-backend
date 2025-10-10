# Combat Simulation Report (Quick Attack Variant)
Date: 2025-10-10T14:04:13.660Z

## Parameters
- Runs: 1000
- Player core: {"STR":100,"INT":40,"DEX":31,"VIT":100,"LUK":53}
- Quick Attack formula overridden to: attack * 0.6 + level * 3

## Summary Metrics
- avgTurns: 50.00
- avgLogsPerRun: 115.11
- avgPlayerDamagePerTurn: 51.91
- avgEnemyDamagePerTurn: 13.91
- hitRate: 97.00%
- missRate: 3.00%
- critRate (per hit): 0.93%

## Damage per hit percentiles
- p25: 15
- p50 (median): 33
- p75: 58
- p90: 72
- p99: 82

## Logs per run distribution
- min: 110
- max: 124
- avg: 115.11

## Recommendations
- Use derived `attack` in formulas or cap multipliers to avoid runaway damage.
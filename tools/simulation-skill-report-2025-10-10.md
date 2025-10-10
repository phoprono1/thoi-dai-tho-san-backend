# Combat Skill Simulation Report
Date: 2025-10-10T13:58:39.574Z

## Parameters
- Runs: 1000
- Player core: {"STR":100,"INT":31,"DEX":31,"VIT":100,"LUK":53}
- Skills: Quick Attack (attack*7+50), Hỏa cầu (attack*1+2)

## Summary Metrics
- avgTurns: 13.55
- avgLogsPerRun: 27.91
- avgPlayerDamagePerTurn: 0.00
- avgEnemyDamagePerTurn: 78.11
- hitRate: 95.13%
- missRate: 4.87%
- critRate (per hit): 0.58%

## Damage per hit percentiles
- p25: 80
- p50 (median): 82
- p75: 84
- p90: 85
- p99: 85

## Logs per run distribution
- min: 24
- max: 39
- avg: 27.91

## Recommendations
- If Quick Attack damage distribution (p75/p99) too high, reduce multiplier (e.g., 7 -> 5) or lower base +50.
- If player DPS low compared to enemy, consider raising skill frequency (reduce cooldown) or lower enemy defense formula.
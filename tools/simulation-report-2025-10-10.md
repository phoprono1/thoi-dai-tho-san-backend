# Combat Simulation Report
Date: 2025-10-10T13:54:57.292Z

## Parameters
- Runs: 1000
- Player core: {"STR":100,"INT":31,"DEX":31,"VIT":100,"LUK":53}
- Enemy template core: {"baseAttack":100,"baseMaxHp":3000,"baseDefense":70,"STR":20,"VIT":20,"DEX":10,"LUK":5,"INT":5}

## Summary Metrics
- avgTurns: 13.53
- avgLogsPerRun: 41.24
- avgPlayerDamagePerTurn: 0.00
- avgEnemyDamagePerTurn: 115.26
- hitRate: 95.00%
- missRate: 5.00%
- critRate (per hit): 3.01%

## Damage per hit percentiles
- p25: 38
- p50 (median): 60
- p75: 82
- p90: 84
- p99: 85

## Logs per run distribution
- min: 33
- max: 55
- avg: 41.24

## Recommendations
- If average player skill damage is too high, review skill damageFormula for heavy skills (Quick Attack, Hỏa cầu).
- If missRate still high for some builds, consider lowering MAX_DELTA or adjusting accuracy softcap.
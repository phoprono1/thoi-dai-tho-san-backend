import { runCombat } from '../src/combat-engine/engine';

async function main() {
  const players = [
    {
      id: 1,
      name: 'Hero',
      isPlayer: true,
      stats: {
        maxHp: 100,
        attack: 10,
        defense: 2,
        critRate: 10,
        critDamage: 150,
        lifesteal: 10,
        armorPen: 0,
        dodgeRate: 5,
        accuracy: 80,
        comboRate: 20,
        counterRate: 5,
      },
    },
  ];

  const enemies = [
    {
      id: 'e1',
      name: 'Goblin',
      isPlayer: false,
      stats: {
        maxHp: 30,
        attack: 5,
        defense: 1,
        critRate: 5,
        critDamage: 120,
        lifesteal: 0,
        armorPen: 0,
        dodgeRate: 2,
        accuracy: 70,
        comboRate: 5,
        counterRate: 0,
      },
    },
  ];

  const res = runCombat({ players, enemies });
  console.log('Combat result:', res.result);
  console.log('Turns:', res.turns);
  console.log('Final players:', res.finalPlayers.map((p) => ({ id: p.id, hp: p.currentHp })));
  console.log('Final enemies:', res.finalEnemies.map((e) => ({ id: e.id, hp: e.currentHp })));
  console.log('Logs (first 10):', res.logs.slice(0, 10));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

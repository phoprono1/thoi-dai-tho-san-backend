import { Controller, Get, Res, Param } from '@nestjs/common';
import { Response } from 'express';
import { AppDataSource } from '../data-source';
import { Item } from '../items/item.entity';
import { Monster } from '../monsters/monster.entity';
import { Quest } from '../quests/quest.entity';
import { Dungeon } from '../dungeons/dungeon.entity';
import { Level } from '../levels/level.entity';
import { CharacterClass } from '../character-classes/character-class.entity';
import * as csvStringify from 'fast-csv';

@Controller('admin/export')
export class AdminExportController {
  @Get('template/:resource')
  getTemplate(@Param('resource') resource: string, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${resource}-template.csv"`,
    );

    // Provide simplified templates with only essential, human-editable fields.
    // IDs and complex JSON columns are omitted to avoid accidental malformed input
    // during admin CSV imports. Admins can edit richer fields in the UI after import.
    const templates: Record<string, any[]> = {
      items: [['name', 'type', 'rarity', 'price']],
      monsters: [
        [
          'name',
          'description',
          'type',
          'element',
          'level',
          'baseHp',
          'baseAttack',
          'baseDefense',
          'experienceReward',
          'goldReward',
          'isActive',
        ],
      ],
      quests: [
        [
          'name',
          'description',
          'type',
          'requiredLevel',
          'isActive',
          'isRepeatable',
        ],
      ],
      'character-classes': [
        [
          'name',
          'description',
          'type',
          'tier',
          'requiredLevel',
          'statBonuses',
          'skillUnlocks',
        ],
      ],
      levels: [
        [
          'level',
          'name',
          'experienceRequired',
          'rewards',
          'maxHp',
          'maxMp',
          'attack',
          'defense',
          'speed',
        ],
      ],
      dungeons: [
        [
          'name',
          'monsterIds',
          'monsterCounts',
          'levelRequirement',
          'isHidden',
          'requiredItem',
          'dropItems',
        ],
      ],
    };

    const template = templates[resource] || [['id', 'name']];
    const stream = csvStringify.format({ headers: false });
    stream.pipe(res as any);
    template.forEach((row) => stream.write(row));
    stream.end();
  }

  @Get(':resource')
  async exportAll(@Param('resource') resource: string, @Res() res: Response) {
    try {
      // Ensure the TypeORM DataSource is initialized before calling getRepository.
      if (!AppDataSource.isInitialized) {
        // initialize may log; guard with try/catch to avoid double init errors
        try {
          // AppDataSource.options are already configured in data-source.ts
          // Initialize the data source if the application didn't already
          // initialize it via TypeOrmModule.
          await AppDataSource.initialize();
        } catch (initErr) {
          // If initialization failed because it was already initialized elsewhere,
          // ignore; otherwise log for debugging.
          console.warn('AppDataSource.initialize() warning:', String(initErr));
        }
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${resource}-export.csv"`,
      );

      const stream = csvStringify.format({ headers: true });
      stream.pipe(res as any);

      if (resource === 'items') {
        const items = await AppDataSource.getRepository(Item).find();
        items.forEach((it) => {
          stream.write({
            id: it.id,
            name: it.name,
            type: it.type,
            rarity: it.rarity,
            price: it.price,
            stats: JSON.stringify(it.stats || {}),
            classRestrictions: JSON.stringify(it.classRestrictions || {}),
            setId: it.setId,
            consumableValue: it.consumableValue,
            duration: it.duration,
          });
        });
      } else if (resource === 'monsters') {
        const monsters = await AppDataSource.getRepository(Monster).find();
        monsters.forEach((m) => {
          stream.write({
            id: m.id,
            name: m.name,
            description: m.description,
            type: m.type,
            element: m.element,
            level: m.level,
            baseHp: m.baseHp,
            baseAttack: m.baseAttack,
            baseDefense: m.baseDefense,
            experienceReward: m.experienceReward,
            goldReward: m.goldReward,
            dropItems: JSON.stringify(m.dropItems || []),
            isActive: m.isActive,
          });
        });
      } else if (resource === 'quests') {
        const quests = await AppDataSource.getRepository(Quest).find();
        quests.forEach((q) => {
          stream.write({
            id: q.id,
            name: q.name,
            description: q.description,
            type: q.type,
            requiredLevel: q.requiredLevel,
            requirements: JSON.stringify(q.requirements || {}),
            rewards: JSON.stringify(q.rewards || {}),
            dependencies: JSON.stringify(q.dependencies || {}),
            isActive: q.isActive,
            isRepeatable: q.isRepeatable,
            expiresAt: q.expiresAt?.toISOString() || '',
          });
        });
      } else if (resource === 'character-classes') {
        const rows = await AppDataSource.getRepository(CharacterClass).find();
        rows.forEach((c) => {
          stream.write({
            id: c.id,
            name: c.name,
            description: c.description,
            type: c.type,
            tier: c.tier,
            requiredLevel: c.requiredLevel,
            statBonuses: JSON.stringify(c.statBonuses || {}),
            skillUnlocks: JSON.stringify(c.skillUnlocks || []),
            advancementRequirements: JSON.stringify(
              c.advancementRequirements || {},
            ),
            previousClassId: c.previousClassId,
          });
        });
      } else if (resource === 'levels') {
        const rows = await AppDataSource.getRepository(Level).find();
        rows.forEach((r) => {
          stream.write({
            id: r.id,
            level: r.level,
            name: r.name,
            experienceRequired: r.experienceRequired,
            rewards: JSON.stringify(r.rewards || {}),
            maxHp: r.maxHp,
            maxMp: r.maxMp,
            attack: r.attack,
            defense: r.defense,
            speed: r.speed,
          });
        });
      } else if (resource === 'dungeons') {
        const rows = await AppDataSource.getRepository(Dungeon).find();
        rows.forEach((d) => {
          stream.write({
            id: d.id,
            name: d.name,
            monsterIds: JSON.stringify(d.monsterIds || []),
            monsterCounts: JSON.stringify(d.monsterCounts || []),
            levelRequirement: d.levelRequirement,
            isHidden: d.isHidden,
            requiredItem: d.requiredItem,
            dropItems: JSON.stringify(d.dropItems || []),
          });
        });
      }

      stream.end();
    } catch (err) {
      // Log full error server-side for debugging
      console.error('admin-export failed', err);
      // Return a simple error to the client during dev
      res.status(500).json({ statusCode: 500, message: String(err) });
    }
  }
}

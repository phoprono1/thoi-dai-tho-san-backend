/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { AppDataSource } from '../data-source';
import { DataSource } from 'typeorm';
import { Item } from '../items/item.entity';
import { ItemType } from '../items/item-types.enum';
import {
  Monster,
  MonsterElement,
  MonsterType,
} from '../monsters/monster.entity';
import { Quest, QuestType } from '../quests/quest.entity';
import { Dungeon } from '../dungeons/dungeon.entity';
import { Level } from '../levels/level.entity';
import {
  CharacterClass,
  ClassType,
} from '../character-classes/character-class.entity';
import { Logger } from '@nestjs/common';

const logger = new Logger('AdminImportHandlers');

function parseJsonField(val: any, defaultValue: any) {
  if (val === undefined || val === null) return defaultValue;
  if (typeof val !== 'string') return val;
  let s = val.trim();
  // CSV tools sometimes double-quote JSON and escape inner quotes as "".
  // Normalize common patterns: remove surrounding quotes and unescape doubled quotes.
  if (
    s.length >= 2 &&
    ((s.startsWith('"') && s.endsWith('"')) ||
      (s.startsWith("'") && s.endsWith("'")))
  ) {
    s = s.slice(1, -1);
  }
  // Unescape doubled quotes to single quotes for JSON parsing
  s = s.replace(/""/g, '"');
  if (s === '') return defaultValue;
  try {
    return JSON.parse(s);
  } catch (e) {
    logger.warn(
      `parseJsonField: JSON parse failed, returning default. error=${String(e)} value=${s}`,
    );
    return defaultValue;
  }
}

async function saveInBatches<T>(
  entityClass: any,
  entities: T[],
  batchSize = 200,
  conflictPaths: string[] = ['id'],
  dataSource?: DataSource,
) {
  const results: { success: number; failed: number; errors: any[] } = {
    success: 0,
    failed: 0,
    errors: [],
  };

  // Ensure the TypeORM DataSource is initialized. Sometimes the processor
  // runs outside of the Nest TypeOrmModule initialization (for example when
  // run directly via a script), so we guard and initialize here as needed.
  const ds = dataSource || AppDataSource;

  if (!ds.isInitialized) {
    try {
      await ds.initialize();
    } catch (initErr) {
      logger.warn(
        'DataSource.initialize() warning in import handler:',
        String(initErr),
      );
    }
  }

  const repo: any = ds.getRepository<any>(entityClass as any);

  for (let i = 0; i < entities.length; i += batchSize) {
    const batch = entities.slice(i, i + batchSize);
    try {
      // Prefer repository.upsert when available for efficient ON CONFLICT handling
      if ((repo as any).upsert) {
        // TypeORM upsert accepts an array and conflictPaths (columns)
        await (repo as any).upsert(batch as any, conflictPaths);
      } else {
        // Fallback to manager.save
        await ds.manager.save(batch as any);
      }
      results.success += batch.length;
    } catch (err) {
      logger.error('Batch save/upsert failed', err as any);
      results.failed += batch.length;
      results.errors.push({ index: i, error: String(err) });
    }
  }

  return results;
}

export async function processItems(
  rows: Record<string, any>[],
  dataSource?: DataSource,
) {
  const entities: Item[] = [];
  const errors: any[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    try {
      if (!r.name || String(r.name).trim() === '') {
        throw new Error('Missing required field: name');
      }

      const item = new Item();
      if (r.id) item.id = Number(r.id);
      item.name = String(r.name).trim();
      item.type = r.type ? (String(r.type).trim() as ItemType) : undefined;
      item.rarity = r.rarity ? Number(r.rarity) : 1;
      item.price =
        r.price !== undefined && r.price !== '' ? Number(r.price) : null;
      // Parse JSON-like fields robustly (CSV may escape quotes as "")
      item.stats = parseJsonField(r.stats, {});
      item.classRestrictions = parseJsonField(r.classRestrictions, {});
      item.setId = r.setId ? Number(r.setId) : null;
      item.consumableValue = r.consumableValue
        ? Number(r.consumableValue)
        : null;
      item.duration = r.duration ? Number(r.duration) : null;
      entities.push(item);
    } catch (err) {
      errors.push({ row: i + 1, error: String(err), raw: r });
    }
  }

  const res = await saveInBatches<Item>(
    Item,
    entities,
    200,
    ['id'],
    dataSource,
  );
  return { ...res, parseErrors: errors };
}

export async function processMonsters(
  rows: Record<string, any>[],
  dataSource?: DataSource,
) {
  const entities: Monster[] = [];
  const errors: any[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    try {
      if (!r.name || String(r.name).trim() === '') {
        throw new Error('Missing required field: name');
      }

      const m = new Monster();
      if (r.id) m.id = Number(r.id);
      m.name = String(r.name).trim();
      m.description = r.description ? String(r.description) : null;
      m.type = r.type ? (String(r.type) as MonsterType) : undefined;
      m.element = r.element ? (String(r.element) as MonsterElement) : undefined;
      m.level = r.level ? Number(r.level) : 1;
      m.baseHp = r.baseHp ? Number(r.baseHp) : 100;
      m.baseAttack = r.baseAttack ? Number(r.baseAttack) : 10;
      m.baseDefense = r.baseDefense ? Number(r.baseDefense) : 5;
      m.experienceReward = r.experienceReward ? Number(r.experienceReward) : 50;
      m.goldReward = r.goldReward ? Number(r.goldReward) : 10;
      m.dropItems = parseJsonField(r.dropItems, []);
      m.isActive = r.isActive
        ? r.isActive === 'true' || r.isActive === '1'
        : true;
      entities.push(m);
    } catch (err) {
      errors.push({ row: i + 1, error: String(err), raw: r });
    }
  }

  const res = await saveInBatches<Monster>(
    Monster,
    entities,
    200,
    ['id'],
    dataSource,
  );
  return { ...res, parseErrors: errors };
}

export async function processQuests(
  rows: Record<string, any>[],
  dataSource?: DataSource,
) {
  const entities: Quest[] = [];
  const errors: any[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    try {
      if (!r.name || String(r.name).trim() === '') {
        throw new Error('Missing required field: name');
      }

      const q = new Quest();
      if (r.id) q.id = Number(r.id);
      q.name = String(r.name).trim();
      q.description = r.description ? String(r.description) : '';
      q.type = r.type ? (String(r.type) as QuestType) : undefined;
      q.requiredLevel = r.requiredLevel ? Number(r.requiredLevel) : 1;
      q.requirements = r.requirements
        ? typeof r.requirements === 'string'
          ? (JSON.parse(r.requirements) as any)
          : (r.requirements as any)
        : {};
      q.rewards = r.rewards
        ? typeof r.rewards === 'string'
          ? (JSON.parse(r.rewards) as any)
          : (r.rewards as any)
        : {};
      q.dependencies = r.dependencies
        ? typeof r.dependencies === 'string'
          ? (JSON.parse(r.dependencies) as any)
          : (r.dependencies as any)
        : null;
      q.isActive = r.isActive
        ? r.isActive === 'true' || r.isActive === '1'
        : false;
      q.isRepeatable = r.isRepeatable
        ? r.isRepeatable === 'true' || r.isRepeatable === '1'
        : false;
      entities.push(q);
    } catch (err) {
      errors.push({ row: i + 1, error: String(err), raw: r });
    }
  }

  const res = await saveInBatches<Quest>(
    Quest,
    entities,
    200,
    ['id'],
    dataSource,
  );
  return { ...res, parseErrors: errors };
}

export async function processDungeons(
  rows: Record<string, any>[],
  dataSource?: DataSource,
) {
  const entities: Dungeon[] = [];
  const errors: any[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    try {
      if (!r.name || String(r.name).trim() === '') {
        throw new Error('Missing required field: name');
      }

      const d = new Dungeon();
      if (r.id) d.id = Number(r.id);
      d.name = String(r.name).trim();
      d.monsterIds = parseJsonField(r.monsterIds, []);
      d.monsterCounts = parseJsonField(r.monsterCounts, []);
      d.levelRequirement = r.levelRequirement ? Number(r.levelRequirement) : 1;
      d.isHidden = r.isHidden
        ? r.isHidden === 'true' || r.isHidden === '1'
        : false;
      d.requiredItem = r.requiredItem ? Number(r.requiredItem) : null;
      d.dropItems = parseJsonField(r.dropItems, []);
      entities.push(d);
    } catch (err) {
      errors.push({ row: i + 1, error: String(err), raw: r });
    }
  }

  const res = await saveInBatches<Dungeon>(
    Dungeon,
    entities,
    200,
    ['id'],
    dataSource,
  );
  return { ...res, parseErrors: errors };
}

export async function processLevels(
  rows: Record<string, any>[],
  dataSource?: DataSource,
) {
  const entities: Level[] = [];
  const errors: any[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    try {
      if (!r.level && r.level !== 0) {
        throw new Error('Missing required field: level');
      }

      const l = new Level();
      if (r.id) l.id = Number(r.id);
      l.level = Number(r.level);
      l.experienceRequired = r.experienceRequired
        ? Number(r.experienceRequired)
        : 0;
      l.name = r.name ? String(r.name) : null;
      l.rewards = parseJsonField(r.rewards, {});
      l.strength = r.strength ? Number(r.strength) : 0;
      l.intelligence = r.intelligence ? Number(r.intelligence) : 0;
      l.dexterity = r.dexterity ? Number(r.dexterity) : 0;
      l.vitality = r.vitality ? Number(r.vitality) : 0;
      l.luck = r.luck ? Number(r.luck) : 0;
      entities.push(l);
    } catch (err) {
      errors.push({ row: i + 1, error: String(err), raw: r });
    }
  }

  const res = await saveInBatches<Level>(
    Level,
    entities,
    200,
    ['id'],
    dataSource,
  );
  return { ...res, parseErrors: errors };
}

export async function processCharacterClasses(
  rows: Record<string, any>[],
  dataSource?: DataSource,
) {
  const entities: CharacterClass[] = [];
  const errors: any[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    try {
      if (!r.name || String(r.name).trim() === '') {
        throw new Error('Missing required field: name');
      }

      const c = new CharacterClass();
      if (r.id) c.id = Number(r.id);
      c.name = String(r.name).trim();
      c.description = r.description ? String(r.description) : '';
      c.type = r.type
        ? (r.type as ClassType)
        : (ClassType.WARRIOR as ClassType);
      c.tier = r.tier ? (Number(r.tier) as any) : (1 as any);
      c.requiredLevel = r.requiredLevel ? Number(r.requiredLevel) : 1;
      c.statBonuses = parseJsonField(r.statBonuses, {});
      c.skillUnlocks = parseJsonField(r.skillUnlocks, []);
      c.advancementRequirements = parseJsonField(
        r.advancementRequirements,
        null,
      );
      c.previousClassId = r.previousClassId ? Number(r.previousClassId) : null;
      entities.push(c);
    } catch (err) {
      errors.push({ row: i + 1, error: String(err), raw: r });
    }
  }

  const res = await saveInBatches<CharacterClass>(
    CharacterClass,
    entities,
    200,
    ['id'],
    dataSource,
  );
  return { ...res, parseErrors: errors };
}

export default {
  processItems,
  processMonsters,
  processQuests,
  processDungeons,
  processLevels,
  processCharacterClasses,
};

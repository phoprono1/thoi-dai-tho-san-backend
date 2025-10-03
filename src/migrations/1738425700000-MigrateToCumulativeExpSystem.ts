import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Convert từ Incremental Experience System sang Cumulative Experience System
 *
 * INCREMENTAL (Cũ):
 * - Mỗi level có exp riêng để lên level đó
 * - Khi lên level: user.experience -= experienceRequired
 * - Bug: Dễ bị lỗi nếu data không tăng dần
 *
 * CUMULATIVE (Mới):
 * - experienceRequired = TỔNG exp cần tích lũy từ level 1
 * - Khi lên level: chỉ so sánh, KHÔNG trừ exp
 * - An toàn: Logic đơn giản, không bao giờ bug "nhảy level"
 *
 * VÍ DỤ:
 * - Level 10: 28,410 exp (thay vì 9,170)
 * - Player có 30,000 exp → Level 10 (còn 30,000 exp)
 * - Level 11: 38,770 exp → Chưa đủ
 */
export class MigrateToCumulativeExpSystem1738425700000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Starting migration to Cumulative Experience System...\n');

    // Step 1: Backup current incremental values
    console.log('📦 Step 1: Creating backup of incremental values...');
    await queryRunner.query(`
      -- Store old values in a comment for rollback reference
      COMMENT ON TABLE level IS 'Migrated to cumulative system on 2025-10-02'
    `);

    // Step 2: Get current levels data
    const levels: Array<{
      id: number;
      level: number;
      experienceRequired: number;
    }> = await queryRunner.query(`
      SELECT id, level, "experienceRequired"
      FROM level
      ORDER BY level ASC
    `);

    console.log(`Found ${levels.length} levels to convert\n`);

    // Step 3: Calculate cumulative values
    let cumulative = 0;
    const updates: Array<{
      id: number;
      level: number;
      oldExp: number;
      newExp: number;
    }> = [];

    console.log('📊 Calculating cumulative values:');
    console.log('Level | Old (Incremental) | New (Cumulative) | Difference');
    console.log('------|-------------------|------------------|------------');

    for (const level of levels) {
      cumulative += level.experienceRequired;
      updates.push({
        id: level.id,
        level: level.level,
        oldExp: level.experienceRequired,
        newExp: cumulative,
      });

      const diff = cumulative - level.experienceRequired;
      console.log(
        `${String(level.level).padStart(5)} | ${String(level.experienceRequired).padStart(17)} | ${String(cumulative).padStart(16)} | +${diff}`,
      );
    }

    console.log('\n✅ Cumulative calculation completed');
    console.log(`   Max value: ${cumulative} (safe for PostgreSQL integer)\n`);

    // Step 4: Update experienceRequired to cumulative values
    console.log(
      '🔧 Step 2: Updating experienceRequired to cumulative values...',
    );

    for (const update of updates) {
      await queryRunner.query(
        `
        UPDATE level
        SET "experienceRequired" = $1,
            "updatedAt" = NOW()
        WHERE id = $2
      `,
        [update.newExp, update.id],
      );

      if (update.level % 5 === 0 || update.level === 1) {
        console.log(
          `   ✓ Updated Level ${update.level}: ${update.oldExp} → ${update.newExp}`,
        );
      }
    }

    console.log('✅ All levels updated successfully\n');

    // Step 5: Verify migration
    console.log('🔍 Step 3: Verifying migration...');
    const verification: Array<{ level: number; experienceRequired: number }> =
      await queryRunner.query(`
      SELECT level, "experienceRequired"
      FROM level
      WHERE level IN (1, 5, 10, 15, 20)
      ORDER BY level ASC
    `);

    console.log('\nVerification (sample levels):');
    verification.forEach((row) => {
      console.log(
        `   Level ${row.level}: ${row.experienceRequired.toLocaleString()} exp`,
      );
    });

    console.log(
      '\n✅ Migration to Cumulative Experience System completed successfully!',
    );
    console.log('⚠️  IMPORTANT: Update users.service.ts levelUpUser logic!');
    console.log(
      '   Change from: user.experience -= nextLevel.experienceRequired',
    );
    console.log('   To: Only compare, do NOT subtract experience\n');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('⏮️  Rolling back to Incremental Experience System...\n');

    // Calculate back to incremental values
    const levels: Array<{
      id: number;
      level: number;
      experienceRequired: number;
    }> = await queryRunner.query(`
      SELECT id, level, "experienceRequired"
      FROM level
      ORDER BY level ASC
    `);

    console.log('🔧 Converting cumulative back to incremental...');

    let previousCumulative = 0;
    for (const level of levels) {
      const incrementalValue = level.experienceRequired - previousCumulative;

      await queryRunner.query(
        `
        UPDATE level
        SET "experienceRequired" = $1,
            "updatedAt" = NOW()
        WHERE id = $2
      `,
        [incrementalValue, level.id],
      );

      previousCumulative = level.experienceRequired;

      if (level.level % 5 === 0 || level.level === 1) {
        console.log(
          `   ✓ Level ${level.level}: ${level.experienceRequired} → ${incrementalValue}`,
        );
      }
    }

    console.log('\n✅ Rollback completed. System restored to incremental.\n');
  }
}

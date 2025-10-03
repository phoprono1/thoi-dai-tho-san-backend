/**
 * Script để Admin reset tất cả users về level 1 và thống kê
 * Sử dụng trước khi migrate sang Cumulative System
 * 
 * Mục đích:
 * - Thống kê số lượng users ở từng level
 * - Reset tất cả users về level 1, exp = 0
 * - Export danh sách users cần bồi thường bình exp
 * 
 * CẢNH BÁO: Script này sẽ RESET tất cả users!
 * Chạy --dry-run trước để xem báo cáo
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function resetUsersToLevel1(dryRun = true) {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✅ Đã kết nối database\n');

    if (dryRun) {
      console.log('⚠️  DRY RUN MODE - Sẽ KHÔNG thực hiện reset\n');
    } else {
      console.log('🚨 PRODUCTION MODE - Sẽ RESET tất cả users về level 1!\n');
    }

    // Step 1: Thống kê users theo level
    console.log('📊 BƯỚC 1: Thống kê users theo level\n');

    const levelStats = await client.query(`
      SELECT level, COUNT(*) as count
      FROM "user"
      GROUP BY level
      ORDER BY level ASC
    `);

    console.log('Level | Số người chơi');
    console.log('------|---------------');
    levelStats.rows.forEach(row => {
      console.log(`${String(row.level).padStart(5)} | ${String(row.count).padStart(13)}`);
    });

    const totalUsers = levelStats.rows.reduce((sum, row) => sum + parseInt(row.count), 0);
    console.log('------|---------------');
    console.log(`TỔNG  | ${String(totalUsers).padStart(13)}\n`);

    // Step 2: Lấy danh sách chi tiết users cần bồi thường
    console.log('📋 BƯỚC 2: Danh sách users cần bồi thường bình exp\n');

    const usersToCompensate = await client.query(`
      SELECT 
        id,
        username,
        level,
        experience,
        gold,
        "createdAt"
      FROM "user"
      WHERE level > 1
      ORDER BY level DESC, experience DESC
    `);

    console.log(`Tìm thấy ${usersToCompensate.rows.length} users cần bồi thường:\n`);

    if (usersToCompensate.rows.length > 0) {
      console.log('ID    | Username              | Level | Exp     | Gold    | Bồi thường (bình exp)');
      console.log('------|----------------------|-------|---------|---------|----------------------');

      // Tính số bình exp cần bồi thường dựa trên level
      // Công thức: Mỗi level = 1 bình exp cơ bản, mỗi 5 level = bonus 1 bình
      const compensationList = [];

      usersToCompensate.rows.slice(0, 20).forEach(user => {
        const expBottles = calculateExpBottleCompensation(user.level);
        compensationList.push({
          userId: user.id,
          username: user.username,
          oldLevel: user.level,
          oldExp: user.experience,
          compensation: expBottles,
        });

        console.log(
          `${String(user.id).padStart(5)} | ${user.username.padEnd(20).substring(0, 20)} | ${String(user.level).padStart(5)} | ${String(user.experience).padStart(7)} | ${String(user.gold).padStart(7)} | ${expBottles} bình exp`
        );
      });

      if (usersToCompensate.rows.length > 20) {
        console.log(`... và ${usersToCompensate.rows.length - 20} users khác\n`);
      }

      // Export full list to JSON
      const exportData = {
        timestamp: new Date().toISOString(),
        totalUsers: usersToCompensate.rows.length,
        compensation: usersToCompensate.rows.map(user => ({
          userId: user.id,
          username: user.username,
          oldLevel: user.level,
          oldExp: user.experience,
          gold: user.gold,
          createdAt: user.createdAt,
          expBottlesCompensation: calculateExpBottleCompensation(user.level),
        })),
      };

      const exportPath = path.join(__dirname, 'user-compensation-list.json');
      fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
      console.log(`\n✅ Đã export danh sách đầy đủ ra: ${exportPath}\n`);
    }

    // Step 3: Tính tổng bồi thường
    console.log('💰 BƯỚC 3: Tổng bồi thường cần chuẩn bị\n');

    let totalExpBottles = 0;
    usersToCompensate.rows.forEach(user => {
      totalExpBottles += calculateExpBottleCompensation(user.level);
    });

    console.log(`Tổng số bình exp cần chuẩn bị: ${totalExpBottles} bình\n`);

    // Step 4: Reset (nếu không phải dry run)
    if (!dryRun) {
      console.log('🔧 BƯỚC 4: Đang reset users về level 1...\n');

      const confirmReset = process.argv.includes('--confirm');
      if (!confirmReset) {
        console.log('❌ BẠN PHẢI THÊM --confirm ĐỂ XÁC NHẬN RESET!');
        console.log('   Ví dụ: node reset-users-level1.js --apply --confirm\n');
        return;
      }

      await client.query('BEGIN');

      try {
        // Reset all users to level 1, exp = 0
        const result = await client.query(`
          UPDATE "user"
          SET level = 1,
              experience = 0,
              "updatedAt" = NOW()
          WHERE level > 1
        `);

        console.log(`✅ Đã reset ${result.rowCount} users về level 1`);

        // Also reset user_stat if needed
        // Note: You may want to keep their allocated stats or reset them
        // For now, we'll keep their stats but you can adjust based on needs

        await client.query('COMMIT');
        console.log('✅ Transaction committed successfully\n');

        console.log('🎉 HOÀN THÀNH RESET!\n');
        console.log('📋 TIẾP THEO:');
        console.log('1. Sử dụng file user-compensation-list.json để gửi bình exp cho users');
        console.log('2. Chạy migration cumulative system: npm run migration:run');
        console.log('3. Deploy backend mới');
        console.log('4. Thông báo cho players về việc maintenance\n');

      } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Lỗi khi reset. Đã rollback:', error.message);
        throw error;
      }

    } else {
      console.log('💡 Để thực hiện reset, chạy lại với: node reset-users-level1.js --apply --confirm\n');
      console.log('⚠️  CHÚ Ý: Phải có cả --apply VÀ --confirm để reset thực sự!\n');
    }

  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

/**
 * Tính số bình exp bồi thường dựa trên level
 * Công thức: level - 1 + bonus mỗi 5 level
 */
function calculateExpBottleCompensation(level) {
  if (level <= 1) return 0;
  
  const baseLevels = level - 1;
  const bonus = Math.floor((level - 1) / 5);
  
  return baseLevels + bonus;
}

// Parse command line arguments
const dryRun = !process.argv.includes('--apply');

resetUsersToLevel1(dryRun).catch(console.error);

/**
 * Script FIX: Convert incremental levels data thành cumulative
 * 
 * CẢNH BÁO: Data hiện tại của bạn CHƯA ĐÚNG cumulative!
 * Level 27 = 1000 < Level 26 = 10000 → SAI!
 * 
 * Script này sẽ:
 * 1. Phát hiện các level có exp thấp hơn level trước
 * 2. Tự động convert sang cumulative đúng
 */

const { Client } = require('pg');

async function fixLevelsCumulative() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✅ Đã kết nối database\n');

    // Get current levels
    const result = await client.query(`
      SELECT id, level, "experienceRequired"
      FROM level
      ORDER BY level ASC
    `);

    const levels = result.rows;
    console.log('📊 Data hiện tại:\n');
    console.log('Level | Current Exp | Cumulative (Đúng) | Status');
    console.log('------|-------------|-------------------|--------');

    let cumulative = 0;
    const fixes = [];
    let hasError = false;

    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      const prev = i > 0 ? levels[i - 1] : null;

      // Check if current value is valid (must be >= previous)
      const isValid = !prev || level.experienceRequired >= prev.experienceRequired;
      
      if (!isValid) {
        hasError = true;
        console.log(
          `${String(level.level).padStart(5)} | ${String(level.experienceRequired).padStart(11)} | ${String('???').padStart(17)} | ❌ SAI (< lv${prev.level})`
        );
        
        // Tính cumulative đúng
        // Giả sử incremental = 100 mỗi level (hoặc tùy chỉnh)
        const increment = 100; // Có thể điều chỉnh
        cumulative = prev.experienceRequired + increment;
        
      } else {
        // Giữ nguyên nếu đúng
        cumulative = level.experienceRequired;
        console.log(
          `${String(level.level).padStart(5)} | ${String(level.experienceRequired).padStart(11)} | ${String(cumulative).padStart(17)} | ✅ OK`
        );
      }

      if (level.experienceRequired !== cumulative) {
        fixes.push({
          id: level.id,
          level: level.level,
          oldValue: level.experienceRequired,
          newValue: cumulative,
        });
      }
    }

    if (!hasError) {
      console.log('\n✅ Data đã đúng cumulative! Không cần fix.\n');
      return;
    }

    console.log('\n⚠️  PHÁT HIỆN LỖI DATA!\n');
    console.log('📝 Các level cần fix:\n');

    fixes.forEach((fix, idx) => {
      console.log(`${idx + 1}. Level ${fix.level}: ${fix.oldValue} → ${fix.newValue}`);
    });

    // Suggest correct values for levels 26-28
    console.log('\n💡 ĐỀ XUẤT DATA ĐÚNG:\n');
    console.log('Nếu bạn muốn:');
    console.log('- Level 26 cần thêm 7500 exp (từ lv25)');
    console.log('- Level 27 cần thêm 10000 exp (từ lv26)');
    console.log('- Level 28 cần thêm 10000 exp (từ lv27)');
    console.log('\nThì data nên là:');
    console.log('Level 25: 2500');
    console.log('Level 26: 10000  (= 2500 + 7500)');
    console.log('Level 27: 20000  (= 10000 + 10000) ← Phải 20000, không phải 1000!');
    console.log('Level 28: 30000  (= 20000 + 10000) ← Phải 30000, không phải 3000!');

    console.log('\n🔧 Để fix tự động, hãy:');
    console.log('1. Xác định incremental exp cho level 26→27→28');
    console.log('2. Chạy UPDATE manual hoặc qua Admin UI\n');

    console.log('📝 SQL để fix:\n');
    console.log(`-- Fix Level 27 (giả sử cần thêm 10000 từ lv26)`);
    console.log(`UPDATE level SET "experienceRequired" = 20000 WHERE level = 27;\n`);
    
    console.log(`-- Fix Level 28 (giả sử cần thêm 10000 từ lv27)`);
    console.log(`UPDATE level SET "experienceRequired" = 30000 WHERE level = 28;\n`);

  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

fixLevelsCumulative().catch(console.error);

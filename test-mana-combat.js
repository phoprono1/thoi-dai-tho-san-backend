/**
 * Test script to verify mana consumption in combat
 * Run: node test-mana-combat.js
 */

const baseURL = 'http://localhost:3005';

async function testManaInCombat() {
  console.log('🧪 Testing Mana Consumption in Combat\n');

  try {
    // Step 1: Login
    console.log('1️⃣ Logging in...');
    const loginRes = await fetch(`${baseURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'SikeS',
        password: 'Hoangpho@2705',
      }),
    });

    if (!loginRes.ok) {
      throw new Error(`Login failed: ${loginRes.status}`);
    }

    const loginData = await loginRes.json();
    const access_token = loginData.access_token || loginData.accessToken;
    const user = loginData.user || loginData;
    
    if (!access_token) {
      console.log('Login response:', JSON.stringify(loginData, null, 2));
      throw new Error('No access token in response');
    }
    
    console.log(`   ✅ Logged in as ${user.username} (ID: ${user.id || user.userId})\n`);

    const headers = {
      Authorization: `Bearer ${access_token}`,
      'Content-Type': 'application/json',
    };

    // Step 2: Get user stats BEFORE combat
    console.log('2️⃣ Getting user stats BEFORE combat...');
    const userId = user.id || user.userId;
    const statsBeforeRes = await fetch(`${baseURL}/api/user-stats/${userId}`, {
      headers,
    });
    const statsBefore = await statsBeforeRes.json();
    console.log(`   Current HP: ${statsBefore.currentHp}/${statsBefore.maxHp}`);
    console.log(`   Current Mana: ${statsBefore.currentMana ?? 'NULL'}/${statsBefore.maxMana}`);

    // Step 3: Get user's active skills
    console.log('\n3️⃣ Getting equipped active skills...');
    const skillsRes = await fetch(
      `${baseURL}/api/player-skills?userId=${userId}`,
      { headers },
    );
    const skills = await skillsRes.json();
    const activeSkills = skills.filter(
      (s) => s.isEquipped && s.skillDefinition.skillType === 'active',
    );

    console.log(`   Found ${activeSkills.length} equipped active skills:`);
    activeSkills.forEach((s) => {
      console.log(
        `   - ${s.skillDefinition.name}: manaCost=${s.skillDefinition.manaCost ?? 'NULL'}, cooldown=${s.skillDefinition.cooldown ?? 'NULL'}`,
      );
    });

    if (activeSkills.length === 0) {
      console.log('\n   ⚠️  No active skills equipped! Equip some skills first.');
      return;
    }

    // Step 4: Start combat via API (bypass room system for direct testing)
    console.log('\n4️⃣ Starting combat (Wild Area)...');
    console.log(
      '   Note: Check backend console for detailed MANA DEBUG logs\n',
    );

    const combatRes = await fetch(`${baseURL}/api/wildarea/1/enter`, {
      method: 'POST',
      headers,
    });

    if (!combatRes.ok) {
      throw new Error(`Combat failed: ${combatRes.status}`);
    }

    const combatResult = await combatRes.json();

    // Step 5: Analyze combat logs for mana usage
    console.log('5️⃣ Analyzing combat logs for mana usage...\n');

    const skillUsageLogs = combatResult.logs.filter(
      (log) => log.type === 'skill',
    );

    if (skillUsageLogs.length === 0) {
      console.log('   ⚠️  No skills were used in combat!');
    } else {
      console.log(`   Found ${skillUsageLogs.length} skill usages:`);
      skillUsageLogs.slice(0, 5).forEach((log) => {
        console.log(`\n   Turn ${log.turn}:`);
        console.log(`   - Skill: ${log.skillName}`);
        console.log(`   - Caster: ${log.actorName}`);
        if (log.details.manaBefore !== undefined) {
          console.log(
            `   - Mana: ${log.details.manaBefore} → ${log.details.manaAfter} (cost: ${log.details.manaCost})`,
          );
        } else {
          console.log('   - ❌ Mana tracking data missing from log!');
        }
        if (log.damage) {
          console.log(`   - Damage: ${log.damage}`);
        }
      });
    }

    // Step 6: Get user stats AFTER combat
    console.log('\n\n6️⃣ Getting user stats AFTER combat...');
    const statsAfterRes = await fetch(`${baseURL}/api/user-stats/${userId}`, {
      headers,
    });
    const statsAfter = await statsAfterRes.json();
    console.log(
      `   Current HP: ${statsAfter.currentHp}/${statsAfter.maxHp} (${statsBefore.currentHp - statsAfter.currentHp} damage taken)`,
    );
    console.log(
      `   Current Mana: ${statsAfter.currentMana ?? 'NULL'}/${statsAfter.maxMana}`,
    );

    // Step 7: Check finalPlayers from combat result
    if (combatResult.teamStats?.members) {
      console.log('\n7️⃣ Final player states from combat result:');
      combatResult.teamStats.members.forEach((member) => {
        console.log(`\n   ${member.name}:`);
        console.log(`   - HP: ${member.currentHp}/${member.maxHp}`);
        console.log(`   - Mana: ${member.currentMana}/${member.maxMana}`);
      });
    }

    // Final verdict
    console.log('\n\n📊 VERDICT:');
    const manaChanged = statsBefore.currentMana !== statsAfter.currentMana;
    const hasManaCostInLogs = skillUsageLogs.some(
      (log) => log.details.manaCost > 0,
    );

    if (manaChanged && hasManaCostInLogs) {
      console.log(
        '   ✅ SUCCESS: Mana was consumed in combat and saved to DB!',
      );
    } else if (hasManaCostInLogs && !manaChanged) {
      console.log(
        '   ⚠️  PARTIAL: Mana was consumed during combat but not saved to DB',
      );
    } else {
      console.log('   ❌ FAILED: Mana was not consumed in combat');
      console.log('\n   Possible causes:');
      console.log('   - Skills have manaCost=null in database');
      console.log('   - Combat engine not deducting mana');
      console.log('   - Combat result not saving mana changes to DB');
    }

    console.log('\n✅ Test completed! Check backend console for debug logs.');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

// Run the test
testManaInCombat();

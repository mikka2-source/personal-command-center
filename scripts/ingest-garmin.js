#!/usr/bin/env node
/**
 * Garmin Health Ingestion Script
 * Connects to Garmin Connect, pulls health data, upserts to Supabase
 */

const { GarminConnect } = require('garmin-connect');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Config
const SUPABASE_URL = 'https://frbdzhddqbkuzwaqwvwi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyYmR6aGRkcWJrdXp3YXF3dndpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MTYxNzEsImV4cCI6MjA4NTA5MjE3MX0.yLOrB38FQ3F_6r7wpVq2z8aVdOjSFuea9nyqP6xzkKE';

const GARMIN_EMAIL = 'dann.mizrahi@gmail.com';
const GARMIN_PASSWORD = 'Dan95688555';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const CACHE_PATH = path.join(__dirname, '..', 'data', 'garmin-cache.json');

// Sleep quality thresholds
const SLEEP_QUALITY = {
  excellent: 7.5,
  good: 6.5,
  fair: 5.5,
  poor: 0
};

function classifySleepQuality(hours) {
  if (!hours) return 'unknown';
  if (hours >= SLEEP_QUALITY.excellent) return 'excellent';
  if (hours >= SLEEP_QUALITY.good) return 'good';
  if (hours >= SLEEP_QUALITY.fair) return 'fair';
  return 'poor';
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function getDateRange(days) {
  const dates = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dates.push(formatDate(d));
  }
  return dates;
}

async function fetchGarminData(GC, days = 7) {
  console.log(`\n🏃 Fetching last ${days} days of Garmin data...`);
  
  const healthRecords = [];
  const dates = getDateRange(days);
  
  for (const date of dates) {
    console.log(`  📊 Fetching ${date}...`);
    
    try {
      const record = {
        user_id: 'dan',
        date: date,
        sleep_hours: null,
        sleep_quality: null,
        body_battery: null,
        stress_level: null,
        steps: null,
        active_minutes: null,
        calories_burned: null,
        resting_hr: null,
        workout_type: null,
        workout_duration: null,
        metadata: {}
      };

      // Steps & daily summary
      try {
        const steps = await GC.getSteps(new Date(date));
        if (steps) {
          record.steps = steps.totalSteps || steps.steps || (Array.isArray(steps) && steps[0]?.totalSteps) || null;
          record.calories_burned = steps.totalKilocalories || steps.calories || null;
          record.active_minutes = steps.highlyActiveSeconds 
            ? Math.round(steps.highlyActiveSeconds / 60) 
            : (steps.activeMinutes || null);
        }
      } catch (e) {
        // Try daily summary instead
        try {
          const summary = await GC.getDailyStats(new Date(date));
          if (summary) {
            record.steps = summary.totalSteps || null;
            record.calories_burned = summary.totalKilocalories || null;
            record.active_minutes = summary.highlyActiveSeconds 
              ? Math.round(summary.highlyActiveSeconds / 60) 
              : null;
          }
        } catch (e2) { /* skip */ }
      }

      // Sleep
      try {
        const sleep = await GC.getSleep(new Date(date));
        if (sleep) {
          const sleepSeconds = sleep.sleepTimeSeconds || sleep.totalSleepTimeInSeconds || 0;
          record.sleep_hours = sleepSeconds > 0 ? parseFloat((sleepSeconds / 3600).toFixed(2)) : null;
          record.sleep_quality = classifySleepQuality(record.sleep_hours);
          record.metadata.sleep_score = sleep.overallSleepScore || sleep.sleepScores?.overall || null;
        }
      } catch (e) { /* skip */ }

      // Heart rate
      try {
        const hr = await GC.getHeartRate(new Date(date));
        if (hr) {
          record.resting_hr = hr.restingHeartRate || hr.minHeartRate || null;
          record.metadata.max_hr = hr.maxHeartRate || null;
          record.metadata.avg_hr = hr.averageHeartRate || null;
        }
      } catch (e) { /* skip */ }

      // Stress
      try {
        const stress = await GC.getStress(new Date(date));
        if (stress) {
          record.stress_level = stress.overallStressLevel || stress.avgStressLevel || null;
          record.body_battery = stress.bodyBatteryChargedValue || stress.startingBatteryLevel || null;
          record.metadata.stress_high = stress.highStressDuration || null;
          record.metadata.stress_low = stress.lowStressDuration || null;
        }
      } catch (e) { /* skip */ }

      // Activities/Workouts
      try {
        const activities = await GC.getActivities(0, 5, null, new Date(date));
        if (activities && activities.length > 0) {
          const todayActivities = activities.filter(a => {
            const actDate = a.startTimeLocal ? a.startTimeLocal.split(' ')[0] : '';
            return actDate === date;
          });
          if (todayActivities.length > 0) {
            const main = todayActivities[0];
            record.workout_type = main.activityType?.typeKey || main.activityName || 'unknown';
            record.workout_duration = main.duration ? Math.round(main.duration / 60) : null;
            record.metadata.workout_calories = main.calories || null;
            record.metadata.workout_distance = main.distance || null;
          }
        }
      } catch (e) { /* skip */ }

      healthRecords.push(record);
    } catch (err) {
      console.error(`  ❌ Error for ${date}:`, err.message);
    }
  }

  return healthRecords;
}

function calculateSleepTrend(records) {
  // Look at last 5 days of sleep
  const sleepRecords = records
    .filter(r => r.sleep_hours !== null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
  
  if (sleepRecords.length < 3) return 'unknown';
  
  const baseline = 7; // hours
  const belowBaseline = sleepRecords.filter(r => r.sleep_hours < baseline).length;
  
  if (belowBaseline >= 3) return 'conservation';
  if (belowBaseline >= 2) return 'declining';
  return 'good';
}

async function upsertHealthData(records) {
  console.log(`\n💾 Upserting ${records.length} health records to Supabase...`);
  
  let success = 0;
  for (const record of records) {
    const { error } = await supabase
      .from('health_data')
      .upsert(record, { onConflict: 'user_id,date' });
    
    if (error) {
      console.error(`  ❌ Error upserting ${record.date}:`, error.message);
    } else {
      success++;
    }
  }
  
  console.log(`  ✅ Upserted ${success}/${records.length} records`);
  return success;
}

function saveCache(records, sleepTrend) {
  const cacheDir = path.dirname(CACHE_PATH);
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  
  const cache = {
    lastUpdated: new Date().toISOString(),
    sleepTrend: sleepTrend,
    recordCount: records.length,
    records: records
  };
  
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  console.log(`💾 Cache saved to ${CACHE_PATH}`);
}

function printSummary(records, sleepTrend) {
  const today = records.find(r => r.date === formatDate(new Date()));
  
  console.log('\n📊 Health Summary:');
  console.log(`  Sleep Trend: ${sleepTrend === 'conservation' ? '⚠️ CONSERVATION MODE' : sleepTrend === 'declining' ? '⚠️ Declining' : '✅ Good'}`);
  
  if (today) {
    console.log(`\n  Today (${today.date}):`);
    if (today.sleep_hours) console.log(`    💤 Sleep: ${today.sleep_hours}h (${today.sleep_quality})`);
    if (today.body_battery) console.log(`    🔋 Body Battery: ${today.body_battery}`);
    if (today.stress_level) console.log(`    😰 Stress: ${today.stress_level}`);
    if (today.steps) console.log(`    👟 Steps: ${today.steps.toLocaleString()}`);
    if (today.resting_hr) console.log(`    ❤️ Resting HR: ${today.resting_hr}`);
    if (today.workout_type) console.log(`    🏋️ Workout: ${today.workout_type} (${today.workout_duration}min)`);
  }
  
  // Last 5 days sleep
  console.log('\n  Sleep (last 5 days):');
  records
    .filter(r => r.sleep_hours !== null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
    .forEach(r => {
      const bar = '█'.repeat(Math.round(r.sleep_hours)) + '░'.repeat(Math.max(0, 9 - Math.round(r.sleep_hours)));
      console.log(`    ${r.date}: ${bar} ${r.sleep_hours}h`);
    });
}

async function main() {
  console.log('🚀 Garmin Health Ingestion Starting...\n');
  
  const GC = new GarminConnect({
    username: GARMIN_EMAIL,
    password: GARMIN_PASSWORD
  });
  
  console.log('🔐 Logging in to Garmin Connect...');
  try {
    await GC.login();
    console.log('  ✅ Logged in successfully');
  } catch (err) {
    console.error('  ❌ Login failed:', err.message);
    console.log('\n  Attempting with session restore...');
    
    // Try loading saved session
    const sessionPath = path.join(__dirname, '..', 'data', 'garmin-session.json');
    if (fs.existsSync(sessionPath)) {
      try {
        const session = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
        Object.assign(GC, session);
        console.log('  ✅ Session restored');
      } catch (e) {
        console.error('  ❌ Session restore failed:', e.message);
        console.log('\n⚠️ Garmin login requires manual intervention (MFA/captcha).');
        console.log('  Creating mock data for development...');
        
        // Create mock data so the rest of the pipeline works
        const mockData = createMockData();
        await upsertHealthData(mockData);
        const sleepTrend = calculateSleepTrend(mockData);
        saveCache(mockData, sleepTrend);
        printSummary(mockData, sleepTrend);
        console.log('\n⚠️ Using MOCK data. Run with valid Garmin session for real data.');
        return;
      }
    } else {
      console.log('\n⚠️ No saved session. Creating mock data for development...');
      const mockData = createMockData();
      await upsertHealthData(mockData);
      const sleepTrend = calculateSleepTrend(mockData);
      saveCache(mockData, sleepTrend);
      printSummary(mockData, sleepTrend);
      console.log('\n⚠️ Using MOCK data. Run with valid Garmin session for real data.');
      return;
    }
  }
  
  // Save session for future use
  try {
    const sessionPath = path.join(__dirname, '..', 'data', 'garmin-session.json');
    fs.writeFileSync(sessionPath, JSON.stringify({
      oauth1Token: GC.oauth1Token,
      oauth2Token: GC.oauth2Token
    }));
  } catch (e) { /* ignore */ }
  
  const records = await fetchGarminData(GC, 7);
  
  if (records.length === 0) {
    console.log('⚠️ No health data retrieved.');
    return;
  }
  
  const sleepTrend = calculateSleepTrend(records);
  
  await upsertHealthData(records);
  saveCache(records, sleepTrend);
  printSummary(records, sleepTrend);
  
  console.log('\n✅ Garmin ingestion complete!');
}

function createMockData() {
  const records = [];
  const now = new Date();
  
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const date = formatDate(d);
    
    // Realistic-ish mock data
    const sleepBase = 6.5 + Math.random() * 2;
    const sleepHours = parseFloat(sleepBase.toFixed(1));
    
    records.push({
      user_id: 'dan',
      date: date,
      sleep_hours: sleepHours,
      sleep_quality: classifySleepQuality(sleepHours),
      body_battery: Math.floor(30 + Math.random() * 70),
      stress_level: Math.floor(20 + Math.random() * 40),
      steps: Math.floor(4000 + Math.random() * 8000),
      active_minutes: Math.floor(15 + Math.random() * 60),
      calories_burned: Math.floor(1800 + Math.random() * 800),
      resting_hr: Math.floor(55 + Math.random() * 15),
      workout_type: i % 3 === 0 ? 'running' : (i % 3 === 1 ? 'padel' : null),
      workout_duration: i % 3 !== 2 ? Math.floor(30 + Math.random() * 60) : null,
      metadata: {
        mock: true,
        sleep_score: Math.floor(50 + Math.random() * 40)
      }
    });
  }
  
  return records;
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

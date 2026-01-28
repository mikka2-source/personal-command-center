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

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function classifySleepQuality(hours) {
  // null/0 means NO DATA (watch not worn), not "bad sleep"
  if (hours === null || hours === undefined || hours === 0) return 'no_data';
  if (hours >= 7.5) return 'excellent';
  if (hours >= 6.5) return 'good';
  if (hours >= 5.5) return 'fair';
  return 'poor';
}

function analyzeSleepTrend(records) {
  // Only analyze days where watch was actually worn (sleep_hours > 0)
  const validSleep = records.filter(r => r.sleep_hours != null && r.sleep_hours > 0).slice(0, 5);
  const totalDays = Math.min(records.length, 5);
  const missingDays = totalDays - validSleep.length;
  
  // Not enough real data points — don't guess
  if (validSleep.length < 2) return 'unknown';
  
  const baseline = 7.0; // Dan's target
  const belowBaseline = validSleep.filter(r => r.sleep_hours < baseline).length;
  
  // Only declare conservation/declining based on ACTUAL worn-watch data
  if (belowBaseline >= 3) return 'conservation';
  if (belowBaseline >= 2) return 'declining';
  return 'good';
}

async function main() {
  console.log('🏃 Garmin Health Ingestion');
  console.log('========================\n');

  const GC = new GarminConnect({ username: GARMIN_EMAIL, password: GARMIN_PASSWORD });

  try {
    await GC.login();
    console.log('✅ Garmin login successful\n');
  } catch (err) {
    console.error('❌ Garmin login failed:', err.message);
    console.log('Using cached data if available...');
    return loadCache();
  }

  const DAYS = 7;
  const records = [];

  for (let i = 0; i < DAYS; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = formatDate(date);
    console.log(`📊 Fetching ${dateStr}...`);

    const record = {
      user_id: 'dan',
      date: dateStr,
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

    // Sleep
    try {
      const sleepData = await GC.getSleepData(date);
      if (sleepData?.dailySleepDTO) {
        const dto = sleepData.dailySleepDTO;
        const sleepSeconds = dto.sleepTimeSeconds || 0;
        record.sleep_hours = Math.round((sleepSeconds / 3600) * 100) / 100;
        record.sleep_quality = classifySleepQuality(record.sleep_hours);
        record.metadata.deep_sleep_min = Math.round((dto.deepSleepSeconds || 0) / 60);
        record.metadata.light_sleep_min = Math.round((dto.lightSleepSeconds || 0) / 60);
        record.metadata.rem_sleep_min = Math.round((dto.remSleepSeconds || 0) / 60);
        record.metadata.awake_min = Math.round((dto.awakeSleepSeconds || 0) / 60);
        record.metadata.avg_sleep_stress = dto.averageRespirationValue;
        record.metadata.avg_respiration = dto.averageRespirationValue;
        console.log(`  😴 Sleep: ${record.sleep_hours}h (${record.sleep_quality}) — Deep: ${record.metadata.deep_sleep_min}m, REM: ${record.metadata.rem_sleep_min}m`);
      }
    } catch (e) {
      console.log(`  😴 Sleep: unavailable`);
    }

    // Sleep duration (backup)
    if (!record.sleep_hours) {
      try {
        const dur = await GC.getSleepDuration(date);
        if (dur?.hours != null) {
          record.sleep_hours = dur.hours + (dur.minutes || 0) / 60;
          record.sleep_quality = classifySleepQuality(record.sleep_hours);
          console.log(`  😴 Sleep (duration): ${record.sleep_hours.toFixed(1)}h (${record.sleep_quality})`);
        }
      } catch (e) {}
    }

    // Steps
    try {
      const steps = await GC.getSteps(date);
      if (typeof steps === 'number') {
        record.steps = steps;
        console.log(`  👟 Steps: ${steps.toLocaleString()}`);
      }
    } catch (e) {
      console.log(`  👟 Steps: unavailable`);
    }

    // Heart Rate
    try {
      const hr = await GC.getHeartRate(date);
      if (hr?.restingHeartRate) {
        record.resting_hr = hr.restingHeartRate;
        record.metadata.max_hr = hr.maxHeartRate;
        record.metadata.min_hr = hr.minHeartRate;
        console.log(`  ❤️ HR: resting ${hr.restingHeartRate}, max ${hr.maxHeartRate}`);
      }
    } catch (e) {
      console.log(`  ❤️ HR: unavailable`);
    }

    // Activities/Workouts for this date
    try {
      const activities = await GC.getActivities(0, 10);
      const dayActivities = activities.filter(a => a.startTimeLocal?.startsWith(dateStr));
      if (dayActivities.length > 0) {
        const a = dayActivities[0]; // Primary activity
        record.workout_type = a.activityName || a.activityType?.typeKey || 'unknown';
        record.workout_duration = Math.round((a.duration || 0) / 60);
        record.calories_burned = Math.round(a.calories || 0);
        record.metadata.activities = dayActivities.map(act => ({
          name: act.activityName,
          type: act.activityType?.typeKey,
          duration_min: Math.round((act.duration || 0) / 60),
          calories: Math.round(act.calories || 0),
          distance: act.distance ? Math.round(act.distance) : null
        }));
        console.log(`  🏋️ Workout: ${record.workout_type} (${record.workout_duration} min)`);
      }
    } catch (e) {}

    // Daily hydration
    try {
      const hydration = await GC.getDailyHydration(dateStr);
      if (hydration?.valueInML) {
        record.metadata.hydration_ml = hydration.valueInML;
        console.log(`  💧 Hydration: ${hydration.valueInML}ml`);
      }
    } catch (e) {}

    // Weight
    try {
      const weight = await GC.getDailyWeightData(dateStr);
      if (weight?.totalAverage) {
        record.metadata.weight_kg = Math.round(weight.totalAverage.weight / 1000 * 10) / 10;
        console.log(`  ⚖️ Weight: ${record.metadata.weight_kg}kg`);
      }
    } catch (e) {}

    records.push(record);
    console.log('');
  }

  // Analyze sleep trend
  const sleepTrend = analyzeSleepTrend(records);
  console.log(`\n📊 Health Summary:`);
  console.log(`  Sleep Trend: ${sleepTrend === 'good' ? '✅ Good' : sleepTrend === 'declining' ? '⚠️ Declining' : sleepTrend === 'conservation' ? '🔴 Conservation Mode' : '❓ Unknown'}`);
  
  const today = records[0];
  if (today) {
    console.log(`\n  Today (${today.date}):`);
    if (today.sleep_hours) console.log(`    😴 Sleep: ${today.sleep_hours.toFixed(1)}h (${today.sleep_quality})`);
    if (today.steps) console.log(`    👟 Steps: ${today.steps.toLocaleString()}`);
    if (today.resting_hr) console.log(`    ❤️ Resting HR: ${today.resting_hr}`);
    if (today.workout_type) console.log(`    🏋️ Workout: ${today.workout_type} (${today.workout_duration}min)`);
  }

  // Upsert to Supabase
  console.log('\n💾 Saving to Supabase...');
  for (const record of records) {
    try {
      const { error } = await supabase
        .from('health_data')
        .upsert(record, { onConflict: 'user_id,date' });
      if (error) console.warn(`  ⚠️ ${record.date}: ${error.message}`);
    } catch (e) {
      console.warn(`  ⚠️ ${record.date}: ${e.message}`);
    }
  }
  console.log('  ✅ Health data saved');

  // Save cache
  const cache = { records, sleepTrend, fetchedAt: new Date().toISOString() };
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  console.log('  ✅ Cache saved');

  // Save sleep trend for decision engine
  const trendPath = path.join(__dirname, '..', 'data', 'sleep-trend.json');
  fs.writeFileSync(trendPath, JSON.stringify({ trend: sleepTrend, records: records.map(r => ({ date: r.date, sleep_hours: r.sleep_hours, sleep_quality: r.sleep_quality })) }, null, 2));

  console.log('\n✅ Garmin ingestion complete!');
}

function loadCache() {
  try {
    const data = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));
    console.log(`Using cached data from ${data.fetchedAt}`);
    return data;
  } catch {
    console.log('No cache available');
    return null;
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

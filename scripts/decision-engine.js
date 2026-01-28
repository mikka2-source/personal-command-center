#!/usr/bin/env node
/**
 * Decision Engine — The Brain of Life OS
 * 
 * Reads events, health, tasks, projects, dependencies.
 * Computes daily load, sleep trend, task priorities, warnings.
 * Outputs and saves daily brief.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Config
const SUPABASE_URL = 'https://frbdzhddqbkuzwaqwvwi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyYmR6aGRkcWJrdXp3YXF3dndpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MTYxNzEsImV4cCI6MjA4NTA5MjE3MX0.yLOrB38FQ3F_6r7wpVq2z8aVdOjSFuea9nyqP6xzkKE';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Use Asia/Nicosia timezone for all time calculations
const NOW = new Date();
const TODAY = NOW.toLocaleDateString('en-CA', { timeZone: 'Asia/Nicosia' }); // YYYY-MM-DD format
const NOW_NICOSIA = new Date(NOW.toLocaleString('en-US', { timeZone: 'Asia/Nicosia' }));

// === CONSTANTS ===
const MAX_ACTIVE_PROJECTS = 3;
const ENERGY_COSTS = { low: 1, mid: 2, high: 3 };
const SLEEP_BASELINE = 7; // hours
const MAX_DAILY_ENERGY = 10; // energy units per day
const OVERLOAD_THRESHOLD = 75;

// === DATA FETCHERS ===

async function fetchTodayEvents() {
  const startOfDay = `${TODAY}T00:00:00Z`;
  const endOfDay = `${TODAY}T23:59:59Z`;
  
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .gte('start_time', startOfDay)
    .lte('start_time', endOfDay)
    .eq('user_id', 'dan')
    .order('start_time');
  
  if (error) console.error('Events fetch error:', error.message);
  return data || [];
}

async function fetchHealthData(days = 7) {
  const { data, error } = await supabase
    .from('health_data')
    .select('*')
    .eq('user_id', 'dan')
    .order('date', { ascending: false })
    .limit(days);
  
  if (error) console.error('Health fetch error:', error.message);
  return data || [];
}

async function fetchOpenTasks() {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', 'dan')
    .in('status', ['open', 'waiting', 'pending', 'in_progress']);
  
  if (error) console.error('Tasks fetch error:', error.message);
  return data || [];
}

async function fetchActiveProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', 'dan')
    .eq('status', 'active');
  
  if (error) console.error('Projects fetch error:', error.message);
  return data || [];
}

async function fetchDependencies() {
  const { data, error } = await supabase
    .from('dependencies')
    .select('*')
    .eq('user_id', 'dan')
    .eq('status', 'waiting');
  
  if (error) console.error('Dependencies fetch error:', error.message);
  return data || [];
}

async function fetchHabits() {
  const { data, error } = await supabase
    .from('habits')
    .select('*')
    .eq('user_id', 'dan');
  
  if (error) console.error('Habits fetch error:', error.message);
  return data || [];
}

// === COMPUTATION ENGINE ===

function computeCalendarLoad(events) {
  let totalHours = 0;
  let highEnergyCount = 0;
  let immutableCount = 0;
  
  events.forEach(e => {
    if (e.start_time && e.end_time) {
      const duration = (new Date(e.end_time) - new Date(e.start_time)) / (1000 * 60 * 60);
      totalHours += duration;
    }
    if (e.energy_level === 'high') highEnergyCount++;
    if (e.immutable) immutableCount++;
  });
  
  return {
    totalHours,
    highEnergyCount,
    immutableCount,
    eventCount: events.length,
    // Calendar score: 0-40 (part of load score)
    score: Math.min(40, Math.round(
      (totalHours / 10) * 25 + // hours weight
      highEnergyCount * 5 +     // high energy penalty
      immutableCount * 2         // locked-in events
    ))
  };
}

function computeSleepTrend(healthData) {
  // Separate days with data from days with missing data
  const last5Days = healthData
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
  
  const withData = last5Days.filter(r => r.sleep_hours !== null && r.sleep_hours !== undefined && parseFloat(r.sleep_hours) > 0);
  const missingDays = last5Days.filter(r => r.sleep_hours === null || r.sleep_hours === undefined || parseFloat(r.sleep_hours) === 0);
  const totalDays = last5Days.length;
  
  // Confidence: how many of the last 5 days have actual sleep data
  const confidence = totalDays > 0 ? withData.length / totalDays : 0;
  const confidenceLevel = confidence >= 0.8 ? 'high' : confidence >= 0.5 ? 'medium' : 'low';
  
  // Not enough real data to determine trend
  if (withData.length < 2) {
    return { 
      trend: 'unknown', 
      avgSleep: null, 
      deficit: 0, 
      confidence: confidenceLevel,
      missingDays: missingDays.map(r => r.date),
      dataPoints: withData.length,
      totalDays
    };
  }
  
  const avgSleep = withData.reduce((sum, r) => sum + parseFloat(r.sleep_hours), 0) / withData.length;
  const belowBaseline = withData.filter(r => parseFloat(r.sleep_hours) < SLEEP_BASELINE).length;
  const deficit = Math.max(0, SLEEP_BASELINE - avgSleep);
  
  let trend = 'good';
  // Only declare conservation/declining based on ACTUAL data, not missing days
  if (belowBaseline >= 3) trend = 'conservation';
  else if (belowBaseline >= 2) trend = 'declining';
  
  return { 
    trend, 
    avgSleep: parseFloat(avgSleep.toFixed(1)), 
    deficit: parseFloat(deficit.toFixed(1)),
    confidence: confidenceLevel,
    missingDays: missingDays.map(r => r.date),
    dataPoints: withData.length,
    totalDays
  };
}

function computeBodyLoad(healthData) {
  const today = healthData.find(r => r.date === TODAY);
  if (!today) return { score: 15, bodyBattery: null, stress: null, dataAvailable: false }; // default moderate, but flag as missing
  
  let score = 0;
  
  // Body battery (lower = more load)
  if (today.body_battery) {
    score += Math.round((100 - today.body_battery) * 0.15); // 0-15
  } else {
    score += 8; // default
  }
  
  // Stress (higher = more load)
  if (today.stress_level) {
    score += Math.round(today.stress_level * 0.15); // 0-15
  } else {
    score += 7; // default
  }
  
  // Check if sleep data is actually present vs missing (watch not worn)
  const hasSleepData = today.sleep_hours !== null && today.sleep_hours !== undefined && parseFloat(today.sleep_hours) > 0;
  const sleepQuality = hasSleepData ? today.sleep_quality : 'no_data';

  return {
    score: Math.min(30, score),
    bodyBattery: today.body_battery,
    stress: today.stress_level,
    steps: today.steps,
    sleepHours: hasSleepData ? parseFloat(today.sleep_hours) : null,
    sleepQuality,
    dataAvailable: true,
    sleepDataMissing: !hasSleepData
  };
}

function computeTaskLoad(tasks) {
  const openCount = tasks.length;
  const urgentCount = tasks.filter(t => {
    if (!t.deadline) return false;
    const daysUntil = (new Date(t.deadline) - NOW) / (1000 * 60 * 60 * 24);
    return daysUntil <= 2;
  }).length;
  
  return {
    score: Math.min(30, openCount * 2 + urgentCount * 5),
    openCount,
    urgentCount
  };
}

function deriveTaskPriority(task, sleepTrend, availableEnergy) {
  let priority = 5; // base
  
  // Deadline urgency (biggest factor)
  if (task.deadline) {
    const daysUntil = (new Date(task.deadline) - NOW) / (1000 * 60 * 60 * 24);
    if (daysUntil < 0) priority += 4;       // overdue
    else if (daysUntil < 1) priority += 3;  // due today
    else if (daysUntil < 3) priority += 2;  // due soon
    else if (daysUntil < 7) priority += 1;  // this week
  }
  
  // Dependencies (if someone is waiting on me)
  if (task.dependency) priority += 1;
  
  // Energy match
  const energyCost = ENERGY_COSTS[task.energy_cost || 'mid'];
  if (sleepTrend === 'conservation' && energyCost >= 3) {
    priority -= 2; // demote high-energy tasks when in conservation
  }
  
  // Cap at 1-10
  return Math.max(1, Math.min(10, priority));
}

function selectTodayTasks(tasks, sleepTrend, calendarLoad, bodyLoad) {
  // Available energy budget
  let energyBudget = MAX_DAILY_ENERGY;
  
  // Reduce budget based on conditions
  if (sleepTrend === 'conservation') energyBudget -= 4;
  else if (sleepTrend === 'declining') energyBudget -= 2;
  
  if (calendarLoad.totalHours > 6) energyBudget -= 3;
  else if (calendarLoad.totalHours > 4) energyBudget -= 1;
  
  if (bodyLoad.bodyBattery && bodyLoad.bodyBattery < 30) energyBudget -= 2;
  
  energyBudget = Math.max(2, energyBudget); // minimum
  
  // Sort by derived priority
  const prioritized = tasks
    .map(t => ({
      ...t,
      derived_priority: deriveTaskPriority(t, sleepTrend, energyBudget)
    }))
    .sort((a, b) => b.derived_priority - a.derived_priority);
  
  const doing = [];
  const notDoing = [];
  let usedEnergy = 0;
  
  for (const task of prioritized) {
    const cost = ENERGY_COSTS[task.energy_cost || 'mid'];
    
    if (usedEnergy + cost <= energyBudget && doing.length < 5) {
      doing.push(task);
      usedEnergy += cost;
    } else {
      notDoing.push(task);
    }
  }
  
  return { doing, notDoing, energyBudget, usedEnergy };
}

function generateWarnings(sleepData, calendarLoad, projects, dependencies, habits) {
  const warnings = [];
  
  // Sleep warnings — distinguish missing data from bad data
  if (sleepData.missingDays && sleepData.missingDays.length > 0 && sleepData.confidence === 'low') {
    warnings.push(`נתוני שינה חלקיים (${sleepData.dataPoints}/${sleepData.totalDays} ימים). אין מספיק מידע להתראה.`);
  } else if (sleepData.trend === 'conservation' && sleepData.confidence !== 'low') {
    warnings.push('שינה ירודה 3+ ימים — מצב שימור. רק משימות הכרחיות.');
  } else if (sleepData.trend === 'declining' && sleepData.confidence !== 'low') {
    const qualifier = sleepData.confidence === 'medium' ? ' (נתונים חלקיים)' : '';
    warnings.push(`שינה יורדת — ממוצע ${sleepData.avgSleep}h. תעדוף שינה הלילה.${qualifier}`);
  }
  
  // Overload warning
  if (calendarLoad.score > 30) {
    warnings.push(`יומן צפוף: ${calendarLoad.totalHours.toFixed(1)} שעות, ${calendarLoad.eventCount} אירועים.`);
  }
  
  // Project limit
  if (projects.length > MAX_ACTIVE_PROJECTS) {
    warnings.push(`${projects.length} פרויקטים פעילים — מקסימום ${MAX_ACTIVE_PROJECTS}! הקפא אחד.`);
  }
  
  // Stale dependencies (waiting > 5 days)
  const staleDeps = dependencies.filter(d => {
    const daysSince = (NOW - new Date(d.created_at)) / (1000 * 60 * 60 * 24);
    return daysSince > 5;
  });
  if (staleDeps.length > 0) {
    const names = staleDeps.map(d => d.waiting_on).join(', ');
    warnings.push(`תלויות תקועות: מחכה ל-${names} כבר ${Math.round((NOW - new Date(staleDeps[0].created_at)) / (1000*60*60*24))} ימים`);
  }
  
  // Missed habits
  const missedHabits = habits.filter(h => {
    if (!h.last_seen) return false;
    const daysSince = (NOW - new Date(h.last_seen)) / (1000 * 60 * 60 * 24);
    if (h.baseline_frequency === 'daily' && daysSince > 2) return true;
    if (h.baseline_frequency === '3x_week' && daysSince > 4) return true;
    if (h.baseline_frequency === 'weekly' && daysSince > 10) return true;
    return false;
  });
  if (missedHabits.length > 0) {
    warnings.push(`הרגלים שנעלמו: ${missedHabits.map(h => h.title).join(', ')}`);
  }
  
  return warnings;
}

function generateSmallAction(sleepData, bodyLoad, calendarLoad, events) {
  // Generate time-anchored DECISIONS, not suggestions
  const hour = NOW_NICOSIA.getHours();
  const minute = NOW_NICOSIA.getMinutes();
  
  // Find the next gap in the calendar (at least 30 min between events)
  const upcomingEvents = events
    .filter(e => e.start_time && new Date(e.start_time) > NOW)
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  
  let nextGapTime = null;
  let nextGapLabel = '';
  
  if (upcomingEvents.length >= 2) {
    for (let i = 0; i < upcomingEvents.length - 1; i++) {
      const endCurrent = new Date(upcomingEvents[i].end_time || upcomingEvents[i].start_time);
      const startNext = new Date(upcomingEvents[i + 1].start_time);
      const gapMinutes = (startNext - endCurrent) / (1000 * 60);
      if (gapMinutes >= 30) {
        nextGapTime = endCurrent;
        nextGapLabel = nextGapTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Nicosia' });
        break;
      }
    }
  }
  
  // If no gap found, use a reasonable default time slot
  if (!nextGapLabel) {
    if (hour < 13) nextGapLabel = '13:00';
    else if (hour < 16) nextGapLabel = '16:00';
    else nextGapLabel = `${String(hour + 1).padStart(2, '0')}:00`;
  }
  
  if (sleepData.trend === 'conservation' && sleepData.confidence !== 'low') {
    return `ב-${nextGapLabel}: 20 דקות מנוחה. טלפון במצב טיסה. לא נדחה.`;
  }
  
  if (bodyLoad.stress && bodyLoad.stress > 50) {
    return `ב-${nextGapLabel}: 10 דקות נשימות. חסום ביומן עכשיו.`;
  }
  
  if (bodyLoad.steps && bodyLoad.steps < 3000 && hour > 14) {
    return `ב-${nextGapLabel}: 15 דקות הליכה בחוץ. שים תזכורת.`;
  }
  
  if (calendarLoad.totalHours > 5) {
    return `ב-${nextGapLabel}: 10 דקות בלי מסכים. סגור לפטופ וצא מהחדר.`;
  }
  
  if (bodyLoad.bodyBattery && bodyLoad.bodyBattery > 70) {
    return `עד ${nextGapLabel}: שעה אחת על הפרויקט הכי חשוב. בלי הפרעות.`;
  }
  
  return `ב-${nextGapLabel}: 10 דקות הליכה בחוץ. שים טיימר.`;
}

// === MAIN ===

async function main() {
  console.log('🧠 Decision Engine Starting...\n');
  console.log(`📅 Date: ${TODAY}`);
  console.log(`⏰ Time: ${NOW.toLocaleTimeString('he-IL')}\n`);
  
  // Fetch all data
  console.log('📥 Fetching data...');
  const [events, healthData, tasks, projects, dependencies, habits] = await Promise.all([
    fetchTodayEvents(),
    fetchHealthData(7),
    fetchOpenTasks(),
    fetchActiveProjects(),
    fetchDependencies(),
    fetchHabits()
  ]);
  
  console.log(`  Events: ${events.length}`);
  console.log(`  Health records: ${healthData.length}`);
  console.log(`  Open tasks: ${tasks.length}`);
  console.log(`  Active projects: ${projects.length}/${MAX_ACTIVE_PROJECTS}`);
  console.log(`  Pending dependencies: ${dependencies.length}`);
  console.log(`  Habits tracked: ${habits.length}`);
  
  // Compute loads
  console.log('\n⚙️ Computing...');
  const calendarLoad = computeCalendarLoad(events);
  const sleepData = computeSleepTrend(healthData);
  const bodyLoad = computeBodyLoad(healthData);
  const taskLoad = computeTaskLoad(tasks);
  
  // Total load score (0-100)
  const loadScore = Math.min(100, calendarLoad.score + bodyLoad.score + taskLoad.score);
  
  console.log(`  Calendar load: ${calendarLoad.score}/40 (${calendarLoad.totalHours.toFixed(1)}h)`);
  console.log(`  Body load: ${bodyLoad.score}/30`);
  console.log(`  Task load: ${taskLoad.score}/30`);
  console.log(`  TOTAL: ${loadScore}/100`);
  console.log(`  Sleep trend: ${sleepData.trend}`);
  
  // Select tasks
  const { doing, notDoing, energyBudget, usedEnergy } = selectTodayTasks(
    tasks, sleepData.trend, calendarLoad, bodyLoad
  );
  
  // Update derived priorities in DB
  for (const task of [...doing, ...notDoing]) {
    if (task.derived_priority && task.id) {
      await supabase
        .from('tasks')
        .update({ derived_priority: task.derived_priority })
        .eq('id', task.id);
    }
  }
  
  // Generate warnings (pick top one)
  const warnings = generateWarnings(sleepData, calendarLoad, projects, dependencies, habits);
  const topWarning = warnings[0] || null;
  
  // Generate small action (now time-anchored)
  const smallAction = generateSmallAction(sleepData, bodyLoad, calendarLoad, events);
  
  // Classify events by time status (past / ongoing / upcoming)
  const classifiedEvents = events.map(e => {
    const start = e.start_time ? new Date(e.start_time) : null;
    const end = e.end_time ? new Date(e.end_time) : null;
    let timeStatus = 'upcoming';
    if (end && end < NOW) timeStatus = 'past';
    else if (start && start <= NOW && (!end || end >= NOW)) timeStatus = 'ongoing';
    else if (start && start > NOW) timeStatus = 'upcoming';
    else if (start && start < NOW) timeStatus = 'past';
    
    const time = start
      ? start.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Nicosia' })
      : '';
    return { ...e, timeStatus, formattedTime: time };
  });
  
  // Focus items: ALL ongoing and upcoming events (not just immutable), never past
  const ongoingEvents = classifiedEvents.filter(e => e.timeStatus === 'ongoing');
  const upcomingEvents = classifiedEvents.filter(e => e.timeStatus === 'upcoming');
  const pastEvents = classifiedEvents.filter(e => e.timeStatus === 'past');
  
  // Build doing_today: ongoing first, then upcoming, then tasks
  const doingToday = [
    ...ongoingEvents.map(e => ({
      text: `${e.formattedTime} ${e.title}`,
      timeStatus: 'ongoing',
      startTime: e.start_time,
      endTime: e.end_time
    })),
    ...upcomingEvents.map(e => ({
      text: `${e.formattedTime} ${e.title}`,
      timeStatus: 'upcoming',
      startTime: e.start_time,
      endTime: e.end_time
    })),
    ...doing.map(t => ({
      text: t.title || t.name || t.description || 'Unknown task',
      timeStatus: 'task',
      startTime: null,
      endTime: null
    }))
  ];
  
  // Past events stored separately for reference (greyed out in UI)
  const completedEvents = pastEvents.map(e => ({
    text: `${e.formattedTime} ${e.title}`,
    timeStatus: 'past',
    startTime: e.start_time,
    endTime: e.end_time
  }));
  
  // If no ongoing/upcoming events and no tasks, show "rest of day" focus
  const hasActiveFocus = doingToday.length > 0;
  
  // Build brief — store structured data in metadata (DB only has core columns)
  const brief = {
    user_id: 'dan',
    date: TODAY,
    doing_today: doingToday.map(d => d.text),
    not_doing_today: notDoing.slice(0, 3).map(t => t.title || t.name || t.description || 'Deferred task'),
    warning: topWarning,
    small_action: smallAction,
    load_score: loadScore,
    sleep_trend: sleepData.trend,
    metadata: {
      // Structured fields (read by frontend from metadata)
      doing_today_structured: doingToday,
      completed_events: completedEvents,
      no_active_focus: !hasActiveFocus,
      sleep_confidence: sleepData.confidence,
      sleep_missing_days: sleepData.missingDays || [],
      // Analytics
      calendar_hours: calendarLoad.totalHours,
      event_count: events.length,
      energy_budget: energyBudget,
      energy_used: usedEnergy,
      body_battery: bodyLoad.bodyBattery,
      stress: bodyLoad.stress,
      sleep_avg: sleepData.avgSleep,
      sleep_deficit: sleepData.deficit,
      sleep_data_points: sleepData.dataPoints,
      sleep_total_days: sleepData.totalDays,
      all_warnings: warnings,
      active_projects: projects.map(p => p.title),
      pending_dependencies: dependencies.map(d => ({ person: d.waiting_on, for: d.waiting_for })),
      generated_at: new Date().toISOString(),
      completed_event_count: completedEvents.length,
      ongoing_event_count: ongoingEvents.length,
      upcoming_event_count: upcomingEvents.length
    }
  };
  
  // Save to Supabase
  console.log('\n💾 Saving daily brief...');
  const { error } = await supabase
    .from('daily_briefs')
    .upsert(brief, { onConflict: 'user_id,date' });
  
  if (error) {
    console.error('  ❌ Error saving brief:', error.message);
  } else {
    console.log('  ✅ Brief saved');
  }
  
  // Save to file
  const briefPath = path.join(__dirname, '..', 'data', 'daily-brief.json');
  fs.writeFileSync(briefPath, JSON.stringify(brief, null, 2));
  console.log(`  💾 Brief saved to ${briefPath}`);
  
  // Print brief
  console.log('\n' + '='.repeat(50));
  console.log('📋 DAILY BRIEF');
  console.log('='.repeat(50));
  console.log(`\n📅 עושים היום:`);
  brief.doing_today.forEach(item => console.log(`  • ${item}`));
  
  if (brief.not_doing_today.length > 0) {
    console.log(`\n🚫 לא עושים היום:`);
    brief.not_doing_today.forEach(item => console.log(`  • ${item}`));
  }
  
  if (brief.warning) {
    console.log(`\n⚠️ ${brief.warning}`);
  }
  
  console.log(`\n✨ ${brief.small_action}`);
  
  const filled = Math.round(loadScore / 10);
  const empty = 10 - filled;
  console.log(`\n עומס: ${'█'.repeat(filled)}${'░'.repeat(empty)} ${loadScore}/100`);
  console.log(` שינה: ${sleepData.trend === 'good' ? '✅ תקין' : sleepData.trend === 'declining' ? '⚠️ ירידה' : sleepData.trend === 'conservation' ? '🔴 שימור' : '❓ לא ידוע'}`);
  console.log('='.repeat(50));
  
  console.log('\n✅ Decision Engine complete!');
  
  return brief;
}

module.exports = { main };

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

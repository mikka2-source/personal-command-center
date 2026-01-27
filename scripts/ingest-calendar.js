#!/usr/bin/env node
/**
 * Calendar Ingestion Script
 * Fetches ICS calendars (Work + Personal), normalizes events, upserts to Supabase
 */

const ical = require('node-ical');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Config
const SUPABASE_URL = 'https://frbdzhddqbkuzwaqwvwi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyYmR6aGRkcWJrdXp3YXF3dndpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MTYxNzEsImV4cCI6MjA4NTA5MjE3MX0.yLOrB38FQ3F_6r7wpVq2z8aVdOjSFuea9nyqP6xzkKE';

const CALENDARS = [
  {
    name: 'work',
    url: 'https://outlook.office365.com/owa/calendar/811666325c2c4d0cb4038778c7511a54@xbo.com/01920fc0670a431e902d21b205fffb5d17964506696735962495/calendar.ics',
    defaultCategory: 'work'
  },
  {
    name: 'personal',
    url: 'https://calendar.google.com/calendar/ical/dann.mizrahi%40gmail.com/private-576355abe37582ed2dc707b199d7bd2f/basic.ics',
    defaultCategory: 'personal'
  }
];

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const CACHE_PATH = path.join(__dirname, '..', 'data', 'calendar-cache.json');

// Keywords for categorization
const CATEGORY_KEYWORDS = {
  family: ['family', 'משפחה', 'ילדים', 'kids', 'birthday', 'יום הולדת', 'אמא', 'אבא', 'הורים', 'שבת', 'חג'],
  sport: ['gym', 'חדר כושר', 'padel', 'פאדל', 'tennis', 'טניס', 'run', 'ריצה', 'swim', 'שחייה', 'workout', 'אימון', 'yoga', 'יוגה', 'football', 'כדורגל', 'basketball'],
  travel: ['flight', 'טיסה', 'hotel', 'מלון', 'airport', 'שדה תעופה', 'trip', 'נסיעה', 'travel'],
  health: ['doctor', 'רופא', 'dentist', 'שיניים', 'clinic', 'מרפאה', 'health', 'בריאות', 'therapy', 'טיפול'],
  personal: ['lunch', 'dinner', 'ארוחה', 'coffee', 'קפה', 'friend', 'חבר']
};

// Keywords that suggest immutable events
const IMMUTABLE_KEYWORDS = ['meeting', 'פגישה', 'call', 'שיחה', 'flight', 'טיסה', 'interview', 'ראיון', 'sync', 'standup', 'review', 'demo', 'presentation'];

function categorizeEvent(title, description, source) {
  const text = `${title} ${description || ''}`.toLowerCase();
  
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) {
      return category;
    }
  }
  
  return source === 'work' ? 'work' : 'personal';
}

function calculateEnergyLevel(event) {
  const durationMs = event.end_time && event.start_time 
    ? new Date(event.end_time) - new Date(event.start_time) 
    : 0;
  const durationHours = durationMs / (1000 * 60 * 60);
  
  // High energy: sport, long meetings (>2h), travel
  if (['sport', 'travel'].includes(event.category)) return 'high';
  if (durationHours > 2) return 'high';
  if (durationHours > 1) return 'mid';
  return 'low';
}

function isImmutable(title, attendeeCount) {
  const text = title.toLowerCase();
  if (attendeeCount > 1) return true;
  return IMMUTABLE_KEYWORDS.some(kw => text.includes(kw));
}

function normalizeEvent(icalEvent, source) {
  const title = icalEvent.summary || 'Untitled';
  const description = icalEvent.description || '';
  const attendeeCount = icalEvent.attendee 
    ? (Array.isArray(icalEvent.attendee) ? icalEvent.attendee.length : 1)
    : 0;

  const startTime = icalEvent.start ? new Date(icalEvent.start).toISOString() : null;
  const endTime = icalEvent.end ? new Date(icalEvent.end).toISOString() : null;
  
  const category = categorizeEvent(title, description, source);
  
  const event = {
    id: icalEvent.uid || `${source}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    user_id: 'dan',
    source: source === 'work' ? 'calendar' : 'calendar',
    title: title,
    start_time: startTime,
    end_time: endTime,
    category: category,
    energy_level: 'mid', // will be computed
    immutable: isImmutable(title, attendeeCount),
    location: icalEvent.location || null,
    metadata: {
      calendar_source: source,
      description: description ? description.substring(0, 500) : null,
      attendees: attendeeCount,
      recurrence: icalEvent.rrule ? true : false
    }
  };
  
  event.energy_level = calculateEnergyLevel(event);
  
  return event;
}

async function fetchCalendar(cal) {
  console.log(`📅 Fetching ${cal.name} calendar...`);
  try {
    // Fetch raw ICS text first to handle parse errors gracefully
    const fetch = require('node-fetch');
    const response = await fetch(cal.url);
    const icsText = await response.text();
    
    let data;
    try {
      data = ical.sync.parseICS(icsText);
    } catch (parseErr) {
      console.warn(`  ⚠️ Full parse failed for ${cal.name}, trying line-by-line...`);
      // Strip problematic RRULE lines that cause UNTIL type mismatch
      const cleaned = icsText.replace(/^RRULE:.*$/gm, (match) => {
        // Fix UNTIL values that are DATE-only when DTSTART is DATETIME
        return match.replace(/UNTIL=(\d{8})(?!T)/g, 'UNTIL=$1T235959Z');
      });
      try {
        data = ical.sync.parseICS(cleaned);
      } catch (e2) {
        // Last resort: strip all RRULE lines
        console.warn(`  ⚠️ Stripping all RRULE lines as fallback...`);
        const noRrule = icsText.replace(/^RRULE:.*$/gm, '');
        try {
          data = ical.sync.parseICS(noRrule);
        } catch (e3) {
          console.error(`  ❌ Cannot parse ${cal.name} calendar:`, e3.message);
          return [];
        }
      }
    }
    
    const events = [];
    const now = new Date();
    const pastLimit = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const futureLimit = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    
    for (const [key, event] of Object.entries(data)) {
      try {
        if (event.type !== 'VEVENT') continue;
        
        const start = event.start ? new Date(event.start) : null;
        if (!start || isNaN(start.getTime())) continue;
        
        if (start < pastLimit || start > futureLimit) continue;
        
        events.push(normalizeEvent(event, cal.name));
      } catch (eventErr) {
        // Skip individual bad events
        continue;
      }
    }
    
    console.log(`  ✅ Found ${events.length} events from ${cal.name}`);
    return events;
  } catch (err) {
    console.error(`  ❌ Error fetching ${cal.name}:`, err.message);
    return [];
  }
}

async function upsertEvents(events) {
  console.log(`\n💾 Upserting ${events.length} events to Supabase...`);
  
  // Batch upsert in chunks of 50
  const chunkSize = 50;
  let totalUpserted = 0;
  
  for (let i = 0; i < events.length; i += chunkSize) {
    const chunk = events.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('events')
      .upsert(chunk, { onConflict: 'id' });
    
    if (error) {
      console.error(`  ❌ Upsert error (batch ${Math.floor(i/chunkSize) + 1}):`, error.message);
    } else {
      totalUpserted += chunk.length;
    }
  }
  
  console.log(`  ✅ Upserted ${totalUpserted} events`);
  return totalUpserted;
}

function saveCache(events) {
  const cacheDir = path.dirname(CACHE_PATH);
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  
  const cache = {
    lastUpdated: new Date().toISOString(),
    eventCount: events.length,
    events: events
  };
  
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  console.log(`\n💾 Cache saved to ${CACHE_PATH}`);
}

function printSummary(events) {
  const today = new Date().toISOString().split('T')[0];
  const todayEvents = events.filter(e => e.start_time && e.start_time.startsWith(today));
  
  console.log('\n📊 Summary:');
  console.log(`  Total events: ${events.length}`);
  console.log(`  Today's events: ${todayEvents.length}`);
  
  // Category breakdown
  const categories = {};
  events.forEach(e => {
    categories[e.category] = (categories[e.category] || 0) + 1;
  });
  console.log('  Categories:', categories);
  
  // Today's schedule
  if (todayEvents.length > 0) {
    console.log('\n📅 Today\'s Schedule:');
    todayEvents
      .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
      .forEach(e => {
        const time = e.start_time ? new Date(e.start_time).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '??:??';
        const lock = e.immutable ? '🔒' : '  ';
        console.log(`  ${lock} ${time} - ${e.title} [${e.category}/${e.energy_level}]`);
      });
  }
}

async function main() {
  console.log('🚀 Calendar Ingestion Starting...\n');
  
  const allEvents = [];
  
  for (const cal of CALENDARS) {
    const events = await fetchCalendar(cal);
    allEvents.push(...events);
  }
  
  if (allEvents.length === 0) {
    console.log('⚠️ No events found. Check calendar URLs.');
    return;
  }
  
  // Upsert to Supabase
  await upsertEvents(allEvents);
  
  // Save cache
  saveCache(allEvents);
  
  // Print summary
  printSummary(allEvents);
  
  console.log('\n✅ Calendar ingestion complete!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

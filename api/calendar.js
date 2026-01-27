// Vercel Serverless Function - Calendar API
// Handles Windows timezone names, RRULE expansion, RECURRENCE-ID overrides
const https = require('https');
const http = require('http');

const CALENDARS = {
  work: process.env.WORK_ICS,
  personal: process.env.PERSONAL_ICS
};

// ─── Timezone Handling ──────────────────────────────────────────

// Windows timezone name → {standard: offsetMin, daylight: offsetMin, hasDST, dstStartMonth, dstStartWeek, dstStartDay, dstEndMonth, dstEndWeek, dstEndDay}
// Offsets are in minutes from UTC (positive = east)
const WINDOWS_TZ_MAP = {
  'FLE Standard Time':            { standard: 120, daylight: 180, hasDST: true, rule: 'eu' },
  'GTB Standard Time':            { standard: 120, daylight: 180, hasDST: true, rule: 'eu' },
  'E. Europe Standard Time':      { standard: 120, daylight: 180, hasDST: true, rule: 'eu' },
  'Israel Standard Time':         { standard: 120, daylight: 180, hasDST: true, rule: 'israel' },
  'GMT Standard Time':            { standard: 0,   daylight: 60,  hasDST: true, rule: 'eu' },
  'UTC':                          { standard: 0,   daylight: 0,   hasDST: false },
  'Arabian Standard Time':        { standard: 240, daylight: 240, hasDST: false },
  'Central Europe Standard Time': { standard: 60,  daylight: 120, hasDST: true, rule: 'eu' },
  'W. Europe Standard Time':      { standard: 60,  daylight: 120, hasDST: true, rule: 'eu' },
  'Eastern Standard Time':        { standard: -300, daylight: -240, hasDST: true, rule: 'us' },
  'India Standard Time':          { standard: 330, daylight: 330, hasDST: false },
  'Egypt Standard Time':          { standard: 120, daylight: 180, hasDST: true, rule: 'egypt' },
  'SE Asia Standard Time':        { standard: 420, daylight: 420, hasDST: false },
  'Pacific Standard Time':        { standard: -480, daylight: -420, hasDST: true, rule: 'us' },
  'China Standard Time':          { standard: 480, daylight: 480, hasDST: false },
  'Singapore Standard Time':      { standard: 480, daylight: 480, hasDST: false },
  'Tokyo Standard Time':          { standard: 540, daylight: 540, hasDST: false },
};

// IANA timezone aliases
const IANA_TZ_MAP = {
  'Asia/Nicosia': 'E. Europe Standard Time',
  'Asia/Jerusalem': 'Israel Standard Time',
  'Europe/Helsinki': 'FLE Standard Time',
  'Europe/Athens': 'GTB Standard Time',
  'Europe/Bucharest': 'GTB Standard Time',
  'Europe/London': 'GMT Standard Time',
  'America/New_York': 'Eastern Standard Time',
  'Europe/Berlin': 'Central Europe Standard Time',
  'Asia/Dubai': 'Arabian Standard Time',
};

function getLastDayOfMonth(year, month, dayOfWeek) {
  // dayOfWeek: 0=Sunday, 5=Friday, etc.
  const lastDay = new Date(Date.UTC(year, month + 1, 0)); // last day of month
  const diff = (lastDay.getUTCDay() - dayOfWeek + 7) % 7;
  return new Date(Date.UTC(year, month, lastDay.getUTCDate() - diff));
}

function getNthDayOfMonth(year, month, dayOfWeek, n) {
  const first = new Date(Date.UTC(year, month, 1));
  const diff = (dayOfWeek - first.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, month, 1 + diff + (n - 1) * 7));
}

function isDST(date, rule) {
  const year = date.getUTCFullYear();

  if (rule === 'eu') {
    // EU: last Sunday of March 01:00 UTC to last Sunday of October 01:00 UTC
    const start = getLastDayOfMonth(year, 2, 0); // March
    start.setUTCHours(1, 0, 0, 0);
    const end = getLastDayOfMonth(year, 9, 0); // October
    end.setUTCHours(1, 0, 0, 0);
    return date >= start && date < end;
  }

  if (rule === 'israel') {
    // Israel: last Friday of March 02:00 local to last Sunday of October 02:00 local
    const start = getLastDayOfMonth(year, 2, 5); // Friday in March
    start.setUTCHours(0, 0, 0, 0); // ~02:00 local (UTC+2)
    const end = getLastDayOfMonth(year, 9, 0); // Sunday in October
    end.setUTCHours(0, 0, 0, 0);
    return date >= start && date < end;
  }

  if (rule === 'us') {
    // US: 2nd Sunday of March 02:00 local to 1st Sunday of November 02:00 local
    const start = getNthDayOfMonth(year, 2, 0, 2);
    start.setUTCHours(7, 0, 0, 0); // approximate
    const end = getNthDayOfMonth(year, 10, 0, 1);
    end.setUTCHours(6, 0, 0, 0);
    return date >= start && date < end;
  }

  if (rule === 'egypt') {
    const start = getLastDayOfMonth(year, 3, 4); // last Thursday April
    const end = getLastDayOfMonth(year, 9, 4); // last Thursday October
    return date >= start && date < end;
  }

  return false;
}

function getTimezoneOffset(tzName, dateUTC) {
  if (!tzName) return 120; // Default: Asia/Nicosia EET (UTC+2)

  // Check IANA names first
  const mapped = IANA_TZ_MAP[tzName];
  if (mapped) tzName = mapped;

  const tz = WINDOWS_TZ_MAP[tzName];
  if (!tz) {
    // Fuzzy match
    const lower = tzName.toLowerCase();
    if (lower.includes('jerusalem') || lower.includes('israel')) return getTimezoneOffset('Israel Standard Time', dateUTC);
    if (lower.includes('nicosia') || lower.includes('cyprus')) return getTimezoneOffset('E. Europe Standard Time', dateUTC);
    if (lower.includes('utc') || lower.includes('gmt') && !lower.includes('standard')) return 0;
    // Default to EET
    return getTimezoneOffset('E. Europe Standard Time', dateUTC);
  }

  if (!tz.hasDST) return tz.standard;
  return isDST(dateUTC, tz.rule) ? tz.daylight : tz.standard;
}

// Target display timezone
const DISPLAY_TZ = 'E. Europe Standard Time'; // Asia/Nicosia

function getDisplayOffset(dateUTC) {
  return getTimezoneOffset(DISPLAY_TZ, dateUTC);
}

// ─── ICS Fetching ───────────────────────────────────────────────

function fetchICS(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const options = {
      timeout: 15000,
      headers: { 'User-Agent': 'PersonalCommandCenter/1.0' }
    };
    const req = client.get(url, options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchICS(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
  });
}

// ─── ICS Parsing ────────────────────────────────────────────────

function unfoldLines(text) {
  return text.replace(/\r\n[ \t]/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function decodeICSText(text) {
  if (!text) return text;
  return text.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

function parseDateValue(value, tzName) {
  // value like "20260127T110000" or "20260127T110000Z" or "20260127"
  const match = value.match(/^(\d{4})(\d{2})(\d{2})(T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!match) return null;

  const [, year, month, day, , hour, minute, second, isUTC] = match;
  const y = parseInt(year), m = parseInt(month) - 1, d = parseInt(day);
  const h = hour ? parseInt(hour) : 0;
  const min = minute ? parseInt(minute) : 0;
  const s = second ? parseInt(second) : 0;

  if (!hour) {
    // All-day event
    return { date: new Date(Date.UTC(y, m, d)), allDay: true, localTime: null, tzName };
  }

  if (isUTC) {
    return { date: new Date(Date.UTC(y, m, d, h, min, s)), allDay: false, localTime: null, tzName: null };
  }

  // Local time in the given timezone → convert to UTC
  // First create as if UTC, then adjust by timezone offset
  const asUTC = new Date(Date.UTC(y, m, d, h, min, s));
  const offset = getTimezoneOffset(tzName, asUTC);
  const utcDate = new Date(asUTC.getTime() - offset * 60000);
  // Store local time components for recurring event expansion
  return { date: utcDate, allDay: false, localTime: { h, min, s }, tzName };
}

function parseICSDateTimeLine(line) {
  const colonIndex = line.indexOf(':');
  if (colonIndex === -1) return null;

  const params = line.substring(0, colonIndex);
  const value = line.substring(colonIndex + 1).trim();

  let tzName = null;
  const tzMatch = params.match(/TZID=([^;:]+)/);
  if (tzMatch) tzName = tzMatch[1];

  return parseDateValue(value, tzName);
}

function parseExDates(line) {
  // EXDATE;TZID=FLE Standard Time:20250814T120000,20251218T120000,20260101T120000
  const colonIndex = line.indexOf(':');
  if (colonIndex === -1) return [];

  const params = line.substring(0, colonIndex);
  const value = line.substring(colonIndex + 1).trim();

  let tzName = null;
  const tzMatch = params.match(/TZID=([^;:]+)/);
  if (tzMatch) tzName = tzMatch[1];

  return value.split(',').map(v => {
    const parsed = parseDateValue(v.trim(), tzName);
    return parsed ? parsed.date.getTime() : null;
  }).filter(Boolean);
}

function parseRRule(rruleStr) {
  // RRULE:FREQ=WEEKLY;UNTIL=20260217T090000Z;INTERVAL=1;BYDAY=TU;WKST=SU
  const parts = rruleStr.replace('RRULE:', '').split(';');
  const rule = {};
  for (const part of parts) {
    const [key, val] = part.split('=');
    if (key && val) rule[key] = val;
  }
  return rule;
}

const DAY_MAP = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

// Convert local time on a given date to UTC, accounting for DST at that date
function localToUTC(year, month, day, hour, min, sec, tzName) {
  const asUTC = new Date(Date.UTC(year, month, day, hour, min, sec));
  const offset = getTimezoneOffset(tzName, asUTC);
  return new Date(asUTC.getTime() - offset * 60000);
}

function expandRRule(rrule, dtstart, rangeStart, rangeEnd, localTime, tzName) {
  // Returns array of Date objects (UTC) for occurrences within range.
  // If localTime is provided, each occurrence preserves the local wall-clock time
  // across DST changes by re-computing UTC from local time + date + timezone.
  const occurrences = [];
  const freq = rrule.FREQ;
  const interval = parseInt(rrule.INTERVAL || '1');
  const count = rrule.COUNT ? parseInt(rrule.COUNT) : null;
  let until = null;
  if (rrule.UNTIL) {
    const parsed = parseDateValue(rrule.UNTIL, null);
    if (parsed) until = parsed.date;
  }

  const byDay = rrule.BYDAY ? rrule.BYDAY.split(',').map(d => DAY_MAP[d.trim()]).filter(d => d !== undefined) : null;

  // Helper: create occurrence date preserving local time
  function makeOccurrence(year, month, day) {
    if (localTime && tzName) {
      return localToUTC(year, month, day, localTime.h, localTime.min, localTime.s, tzName);
    }
    // Fallback: use same UTC hour/min/sec as dtstart
    return new Date(Date.UTC(year, month, day,
      dtstart.getUTCHours(), dtstart.getUTCMinutes(), dtstart.getUTCSeconds()));
  }

  // Get the initial date in UTC for stepping
  // We use a "reference date" that steps by calendar days, separate from time
  const startYear = dtstart.getUTCFullYear();
  const startMonth = dtstart.getUTCMonth();
  const startDay = dtstart.getUTCDate();
  // If we have local time, compute the actual local date of dtstart
  let refYear = startYear, refMonth = startMonth, refDay = startDay;
  if (localTime && tzName) {
    // The dtstart in UTC might be on a different calendar day than local
    const offset = getTimezoneOffset(tzName, dtstart);
    const localDt = new Date(dtstart.getTime() + offset * 60000);
    refYear = localDt.getUTCFullYear();
    refMonth = localDt.getUTCMonth();
    refDay = localDt.getUTCDate();
  }

  if (freq === 'WEEKLY') {
    let generated = 0;
    const maxOccurrences = count || 520;
    // Step week by week from refDate
    let weekDate = new Date(Date.UTC(refYear, refMonth, refDay));

    while (generated < maxOccurrences) {
      // Check if we're past the end
      const checkEnd = makeOccurrence(weekDate.getUTCFullYear(), weekDate.getUTCMonth(), weekDate.getUTCDate());
      if (until && checkEnd > until) break;
      if (checkEnd > new Date(rangeEnd.getTime() + 7 * 86400000)) break; // generous bound

      if (byDay) {
        const wdow = weekDate.getUTCDay();
        for (const dow of byDay) {
          const diff = (dow - wdow + 7) % 7;
          const candDate = new Date(weekDate.getTime() + diff * 86400000);
          const candidate = makeOccurrence(candDate.getUTCFullYear(), candDate.getUTCMonth(), candDate.getUTCDate());

          if (candidate >= dtstart && candidate >= rangeStart && candidate <= rangeEnd) {
            if (!until || candidate <= until) {
              occurrences.push(candidate);
            }
          }
          generated++;
        }
      } else {
        const candidate = makeOccurrence(weekDate.getUTCFullYear(), weekDate.getUTCMonth(), weekDate.getUTCDate());
        if (candidate >= rangeStart && candidate <= rangeEnd) {
          if (!until || candidate <= until) {
            occurrences.push(candidate);
          }
        }
        generated++;
      }

      weekDate = new Date(weekDate.getTime() + interval * 7 * 86400000);
    }
  } else if (freq === 'DAILY') {
    let generated = 0;
    const maxOccurrences = count || 3650;
    let dayDate = new Date(Date.UTC(refYear, refMonth, refDay));

    while (generated < maxOccurrences) {
      const candidate = makeOccurrence(dayDate.getUTCFullYear(), dayDate.getUTCMonth(), dayDate.getUTCDate());
      if (until && candidate > until) break;
      if (candidate > rangeEnd) break;

      if (candidate >= rangeStart) {
        occurrences.push(candidate);
      }
      generated++;
      dayDate = new Date(dayDate.getTime() + interval * 86400000);
    }
  } else if (freq === 'MONTHLY') {
    let generated = 0;
    const maxOccurrences = count || 120;
    let curYear = refYear, curMonth = refMonth;

    while (generated < maxOccurrences) {
      const candidate = makeOccurrence(curYear, curMonth, refDay);
      if (until && candidate > until) break;
      if (candidate > rangeEnd) break;

      if (candidate >= rangeStart) {
        occurrences.push(candidate);
      }
      generated++;
      curMonth += interval;
      while (curMonth > 11) { curMonth -= 12; curYear++; }
    }
  }

  return occurrences;
}

function parseICS(icsData) {
  const unfolded = unfoldLines(icsData);
  const lines = unfolded.split('\n');

  // First pass: collect all events with their properties
  const rawEvents = [];
  let currentEvent = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === 'BEGIN:VEVENT') {
      currentEvent = { lines: [] };
    } else if (trimmed === 'END:VEVENT' && currentEvent) {
      rawEvents.push(currentEvent);
      currentEvent = null;
    } else if (currentEvent) {
      currentEvent.lines.push(trimmed);
    }
  }

  // Parse each event
  const singleEvents = [];
  const recurringEvents = [];
  const overrides = new Map(); // recurrence-id timestamp → event data

  for (const raw of rawEvents) {
    const ev = {};
    let rruleStr = null;
    let exdateLines = [];
    let recurrenceId = null;

    for (const line of raw.lines) {
      if (line.startsWith('SUMMARY')) {
        const ci = line.indexOf(':');
        if (ci !== -1) ev.title = decodeICSText(line.substring(ci + 1));
      } else if (line.startsWith('DTSTART')) {
        const parsed = parseICSDateTimeLine(line);
        if (parsed) {
          ev.startDate = parsed.date;
          ev.allDay = parsed.allDay;
          ev.startLocalTime = parsed.localTime;
          ev.startTzName = parsed.tzName;
        }
      } else if (line.startsWith('DTEND')) {
        const parsed = parseICSDateTimeLine(line);
        if (parsed) ev.endDate = parsed.date;
      } else if (line.startsWith('RRULE')) {
        rruleStr = line;
      } else if (line.startsWith('EXDATE')) {
        exdateLines.push(line);
      } else if (line.startsWith('RECURRENCE-ID')) {
        const parsed = parseICSDateTimeLine(line);
        if (parsed) recurrenceId = parsed.date.getTime();
      } else if (line.startsWith('LOCATION')) {
        const ci = line.indexOf(':');
        if (ci !== -1) {
          const loc = decodeICSText(line.substring(ci + 1)).trim();
          if (loc) ev.location = loc;
        }
      } else if (line.startsWith('UID')) {
        const ci = line.indexOf(':');
        if (ci !== -1) ev.uid = line.substring(ci + 1);
      } else if (line.startsWith('STATUS')) {
        const ci = line.indexOf(':');
        if (ci !== -1) ev.status = line.substring(ci + 1).trim();
      } else if (line.startsWith('TRANSP')) {
        const ci = line.indexOf(':');
        if (ci !== -1) ev.transp = line.substring(ci + 1).trim();
      }
    }

    if (!ev.title || !ev.startDate) continue;

    // Skip cancelled events (title starts with "Canceled:" or status CANCELLED)
    const isCancelled = ev.status === 'CANCELLED' ||
      ev.title.startsWith('Canceled:') ||
      ev.title.startsWith('Cancelled:');

    if (recurrenceId !== null) {
      // This is an override for a recurring event instance
      overrides.set(recurrenceId + '_' + (ev.uid || ''), {
        ...ev,
        cancelled: isCancelled
      });
      continue;
    }

    if (isCancelled) continue;

    if (rruleStr) {
      // Parse excluded dates
      const excludedDates = [];
      for (const exLine of exdateLines) {
        excludedDates.push(...parseExDates(exLine));
      }
      recurringEvents.push({
        ...ev,
        rrule: parseRRule(rruleStr),
        excludedDates,
        startLocalTime: ev.startLocalTime,
        startTzName: ev.startTzName
      });
    } else {
      singleEvents.push(ev);
    }
  }

  return { singleEvents, recurringEvents, overrides };
}

function getEventsInRange(parsedICS, rangeStart, rangeEnd) {
  const { singleEvents, recurringEvents, overrides } = parsedICS;
  const events = [];

  // Add single events in range
  for (const ev of singleEvents) {
    if (ev.startDate >= rangeStart && ev.startDate < rangeEnd) {
      events.push({
        id: ev.uid || `${ev.startDate.getTime()}-${ev.title}`,
        title: ev.title,
        start: ev.startDate.toISOString(),
        end: ev.endDate ? ev.endDate.toISOString() : null,
        location: ev.location || null,
        allDay: ev.allDay || false
      });
    }
  }

  // Expand recurring events
  for (const ev of recurringEvents) {
    const occurrences = expandRRule(ev.rrule, ev.startDate, rangeStart, rangeEnd, ev.startLocalTime, ev.startTzName);
    // Duration in milliseconds (wall-clock time, DST-invariant)
    const duration = ev.endDate ? (ev.endDate.getTime() - ev.startDate.getTime()) : 3600000;
    // For recurring events with local time, the duration stays fixed regardless of DST

    for (const occ of occurrences) {
      // Check if excluded
      if (ev.excludedDates.some(ex => Math.abs(ex - occ.getTime()) < 60000)) continue;

      // Check if overridden
      const overrideKey = occ.getTime() + '_' + (ev.uid || '');
      const override = overrides.get(overrideKey);
      if (override) {
        if (override.cancelled) continue;
        events.push({
          id: ev.uid || `${occ.getTime()}-${override.title}`,
          title: override.title,
          start: override.startDate.toISOString(),
          end: override.endDate ? override.endDate.toISOString() : new Date(override.startDate.getTime() + duration).toISOString(),
          location: override.location || ev.location || null,
          allDay: override.allDay || false
        });
        continue;
      }

      const occEnd = new Date(occ.getTime() + duration);
      events.push({
        id: ev.uid || `${occ.getTime()}-${ev.title}`,
        title: ev.title,
        start: occ.toISOString(),
        end: occEnd.toISOString(),
        location: ev.location || null,
        allDay: ev.allDay || false
      });
    }
  }

  // Sort by start time
  events.sort((a, b) => new Date(a.start) - new Date(b.start));
  return events;
}

// ─── Date Range Helpers ─────────────────────────────────────────

function getTodayRange() {
  const now = new Date();
  const offset = getDisplayOffset(now);
  // Get "today" in display timezone
  const localNow = new Date(now.getTime() + offset * 60000);
  const dateStr = localNow.toISOString().split('T')[0];
  // Convert start/end of day back to UTC
  const dayStart = new Date(dateStr + 'T00:00:00Z');
  const dayEnd = new Date(dateStr + 'T23:59:59.999Z');
  const utcStart = new Date(dayStart.getTime() - offset * 60000);
  const utcEnd = new Date(dayEnd.getTime() - offset * 60000);
  return { start: utcStart, end: utcEnd, dateStr };
}

function getWeekRange(days = 7) {
  const { start } = getTodayRange();
  const end = new Date(start.getTime() + days * 86400000);
  return { start, end };
}

// ─── API Handler ────────────────────────────────────────────────

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');

  try {
    const allMeetings = [];
    const allUpcoming = [];
    const errors = [];

    const todayRange = getTodayRange();
    const weekRange = getWeekRange(7);

    for (const [name, url] of Object.entries(CALENDARS)) {
      if (!url) continue;
      try {
        const icsData = await fetchICS(url);
        const parsed = parseICS(icsData);

        const todayEvents = getEventsInRange(parsed, todayRange.start, todayRange.end);
        todayEvents.forEach(e => { e.calendar = name; });
        allMeetings.push(...todayEvents);

        const weekEvents = getEventsInRange(parsed, weekRange.start, weekRange.end);
        weekEvents.forEach(e => { e.calendar = name; });
        allUpcoming.push(...weekEvents);
      } catch (err) {
        console.error(`Error fetching ${name}:`, err.message);
        errors.push({ calendar: name, error: err.message });
      }
    }

    // Sort
    allMeetings.sort((a, b) => new Date(a.start) - new Date(b.start));
    allUpcoming.sort((a, b) => new Date(a.start) - new Date(b.start));

    // Deduplicate by id
    const dedup = (arr) => {
      const seen = new Set();
      return arr.filter(e => {
        const key = `${e.start}_${e.title}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };

    res.json({
      success: true,
      date: todayRange.dateStr,
      timezone: 'Asia/Nicosia',
      meetings: dedup(allMeetings),
      upcoming: dedup(allUpcoming),
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Calendar API error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      meetings: []
    });
  }
};

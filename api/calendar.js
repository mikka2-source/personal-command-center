// Vercel Serverless Function - Calendar API
const https = require('https');
const http = require('http');

const CALENDARS = {
  work: process.env.WORK_ICS,
  personal: process.env.PERSONAL_ICS
};

// Target timezone offset for Asia/Nicosia (EET = UTC+2, EEST = UTC+3)
// We'll compute this dynamically based on DST rules
function getNicosiaOffset(date) {
  // Cyprus follows EU DST rules:
  // EEST (UTC+3): Last Sunday of March to last Sunday of October
  // EET (UTC+2): Rest of year
  const year = date.getUTCFullYear();
  const marchLast = new Date(Date.UTC(year, 2, 31));
  const lastSunMarch = new Date(Date.UTC(year, 2, 31 - marchLast.getUTCDay()));
  lastSunMarch.setUTCHours(1, 0, 0, 0); // Transition at 01:00 UTC

  const octLast = new Date(Date.UTC(year, 9, 31));
  const lastSunOct = new Date(Date.UTC(year, 9, 31 - octLast.getUTCDay()));
  lastSunOct.setUTCHours(1, 0, 0, 0);

  if (date >= lastSunMarch && date < lastSunOct) {
    return 3 * 60; // EEST UTC+3
  }
  return 2 * 60; // EET UTC+2
}

function fetchICS(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const options = {
      timeout: 10000,
      headers: {
        'User-Agent': 'PersonalCommandCenter/1.0'
      }
    };

    const req = client.get(url, options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchICS(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

function parseICS(icsData) {
  const events = [];
  const lines = icsData.split(/\r?\n/);
  let currentEvent = null;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Handle line continuations (folded lines)
    while (i + 1 < lines.length && (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
      i++;
      line += lines[i].substring(1);
    }

    line = line.trim();

    if (line === 'BEGIN:VEVENT') {
      currentEvent = {};
    } else if (line === 'END:VEVENT' && currentEvent) {
      if (currentEvent.title && currentEvent.start) {
        events.push(currentEvent);
      }
      currentEvent = null;
    } else if (currentEvent) {
      if (line.startsWith('SUMMARY')) {
        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1) {
          currentEvent.title = decodeICSText(line.substring(colonIndex + 1));
        }
      } else if (line.startsWith('DTSTART')) {
        const parsed = parseICSDateTime(line);
        currentEvent.start = parsed.iso;
        currentEvent.allDay = parsed.allDay;
      } else if (line.startsWith('DTEND')) {
        const parsed = parseICSDateTime(line);
        currentEvent.end = parsed.iso;
      } else if (line.startsWith('LOCATION')) {
        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1) {
          const loc = decodeICSText(line.substring(colonIndex + 1));
          if (loc && loc.trim()) currentEvent.location = loc.trim();
        }
      } else if (line.startsWith('DESCRIPTION')) {
        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1) {
          currentEvent.description = decodeICSText(line.substring(colonIndex + 1));
        }
      } else if (line.startsWith('UID')) {
        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1) {
          currentEvent.uid = line.substring(colonIndex + 1);
        }
      } else if (line.startsWith('STATUS')) {
        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1) {
          currentEvent.status = line.substring(colonIndex + 1).trim();
        }
      }
    }
  }
  return events;
}

function parseICSDateTime(line) {
  const colonIndex = line.indexOf(':');
  if (colonIndex === -1) return { iso: null, allDay: false };

  const value = line.substring(colonIndex + 1).trim();
  const params = line.substring(0, colonIndex);

  // Extract timezone if present
  let timezone = null;
  const tzMatch = params.match(/TZID=([^;:]+)/);
  if (tzMatch) {
    timezone = tzMatch[1];
  }

  const match = value.match(/^(\d{4})(\d{2})(\d{2})(T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!match) return { iso: null, allDay: false };

  const [, year, month, day, , hour, minute, second, isUTC] = match;

  if (hour !== undefined) {
    if (isUTC) {
      return {
        iso: new Date(Date.UTC(
          parseInt(year), parseInt(month) - 1, parseInt(day),
          parseInt(hour), parseInt(minute), parseInt(second) || 0
        )).toISOString(),
        allDay: false
      };
    } else {
      // Timezone-aware: convert to UTC assuming the timezone
      // For Israel/Jerusalem or Asia/Nicosia events, handle accordingly
      const localDate = new Date(Date.UTC(
        parseInt(year), parseInt(month) - 1, parseInt(day),
        parseInt(hour), parseInt(minute), parseInt(second) || 0
      ));

      // Determine offset based on timezone
      let offsetMinutes = 0;
      if (timezone) {
        const tz = timezone.toLowerCase();
        if (tz.includes('jerusalem') || tz.includes('israel') || tz.includes('tel_aviv')) {
          // Israel: IST=UTC+2, IDT=UTC+3
          offsetMinutes = isIsraelDST(localDate) ? 180 : 120;
        } else if (tz.includes('nicosia') || tz.includes('cyprus')) {
          offsetMinutes = getNicosiaOffset(localDate);
        } else if (tz.includes('utc') || tz.includes('gmt')) {
          offsetMinutes = 0;
        } else {
          // Default: assume EET (UTC+2) for this region
          offsetMinutes = getNicosiaOffset(localDate);
        }
      } else {
        // No timezone specified, assume local (Asia/Nicosia)
        offsetMinutes = getNicosiaOffset(localDate);
      }

      // Convert from local time to UTC
      const utcDate = new Date(localDate.getTime() - offsetMinutes * 60000);
      return { iso: utcDate.toISOString(), allDay: false };
    }
  } else {
    return {
      iso: new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day))).toISOString(),
      allDay: true
    };
  }
}

function isIsraelDST(date) {
  // Israel DST: Friday before last Sunday of March to last Sunday of October
  const year = date.getUTCFullYear();
  const marchLast = new Date(Date.UTC(year, 2, 31));
  const lastSunMarch = new Date(Date.UTC(year, 2, 31 - marchLast.getUTCDay()));
  const fridayBefore = new Date(lastSunMarch.getTime() - 2 * 86400000);
  fridayBefore.setUTCHours(2, 0, 0, 0);

  const octLast = new Date(Date.UTC(year, 9, 31));
  const lastSunOct = new Date(Date.UTC(year, 9, 31 - octLast.getUTCDay()));
  lastSunOct.setUTCHours(2, 0, 0, 0);

  return date >= fridayBefore && date < lastSunOct;
}

function decodeICSText(text) {
  if (!text) return text;
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function getTodayEvents(events) {
  // "Today" in Asia/Nicosia timezone
  const now = new Date();
  const offset = getNicosiaOffset(now);
  const localNow = new Date(now.getTime() + offset * 60000);

  const todayStr = localNow.toISOString().split('T')[0];

  return events.filter(e => {
    if (!e.start) return false;
    // Skip cancelled events
    if (e.status === 'CANCELLED') return false;

    const eventDate = new Date(e.start);
    const localEvent = new Date(eventDate.getTime() + offset * 60000);
    const eventStr = localEvent.toISOString().split('T')[0];
    return eventStr === todayStr;
  }).sort((a, b) => new Date(a.start) - new Date(b.start));
}

function getUpcomingEvents(events, days = 7) {
  const now = new Date();
  const offset = getNicosiaOffset(now);
  const localNow = new Date(now.getTime() + offset * 60000);
  const todayStart = new Date(localNow.toISOString().split('T')[0] + 'T00:00:00Z');
  const futureEnd = new Date(todayStart.getTime() + days * 86400000);

  // Convert back to UTC for comparison
  const utcTodayStart = new Date(todayStart.getTime() - offset * 60000);
  const utcFutureEnd = new Date(futureEnd.getTime() - offset * 60000);

  return events.filter(e => {
    if (!e.start) return false;
    if (e.status === 'CANCELLED') return false;
    const eventDate = new Date(e.start);
    return eventDate >= utcTodayStart && eventDate < utcFutureEnd;
  }).sort((a, b) => new Date(a.start) - new Date(b.start));
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');

  try {
    const allEvents = [];
    const errors = [];

    for (const [name, url] of Object.entries(CALENDARS)) {
      if (url) {
        try {
          const icsData = await fetchICS(url);
          const events = parseICS(icsData);
          events.forEach(e => {
            e.calendar = name;
            e.id = e.uid || `${name}-${e.start}-${e.title}`;
          });
          allEvents.push(...events);
        } catch (err) {
          console.error(`Error fetching ${name}:`, err.message);
          errors.push({ calendar: name, error: err.message });
        }
      }
    }

    const todayEvents = getTodayEvents(allEvents);
    const upcomingEvents = getUpcomingEvents(allEvents, 7);

    res.json({
      success: true,
      date: new Date().toISOString().split('T')[0],
      meetings: todayEvents.map(e => ({
        id: e.id,
        title: e.title,
        start: e.start,
        end: e.end,
        location: e.location || null,
        calendar: e.calendar,
        allDay: e.allDay || false
      })),
      upcoming: upcomingEvents.map(e => ({
        id: e.id,
        title: e.title,
        start: e.start,
        end: e.end,
        location: e.location || null,
        calendar: e.calendar,
        allDay: e.allDay || false
      })),
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      meetings: []
    });
  }
};

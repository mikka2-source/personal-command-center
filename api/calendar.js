// Vercel Serverless Function - Calendar API
const https = require('https');
const http = require('http');

const CALENDARS = {
  work: process.env.WORK_ICS,
  personal: process.env.PERSONAL_ICS
};

function fetchICS(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function parseICS(icsData) {
  const events = [];
  const lines = icsData.split('\n');
  let currentEvent = null;

  for (let line of lines) {
    line = line.trim();
    
    if (line === 'BEGIN:VEVENT') {
      currentEvent = {};
    } else if (line === 'END:VEVENT' && currentEvent) {
      events.push(currentEvent);
      currentEvent = null;
    } else if (currentEvent) {
      if (line.startsWith('SUMMARY:')) {
        currentEvent.title = line.substring(8);
      } else if (line.startsWith('DTSTART')) {
        const match = line.match(/(\d{8}T\d{6})|(\d{8})/);
        if (match) {
          currentEvent.start = parseICSDate(match[0]);
        }
      } else if (line.startsWith('DTEND')) {
        const match = line.match(/(\d{8}T\d{6})|(\d{8})/);
        if (match) {
          currentEvent.end = parseICSDate(match[0]);
        }
      } else if (line.startsWith('LOCATION:')) {
        currentEvent.location = line.substring(9);
      }
    }
  }
  return events;
}

function parseICSDate(dateStr) {
  // Format: 20260126T100000 or 20260126
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  
  if (dateStr.length >= 15) {
    const hour = dateStr.substring(9, 11);
    const min = dateStr.substring(11, 13);
    return new Date(`${year}-${month}-${day}T${hour}:${min}:00`);
  }
  return new Date(`${year}-${month}-${day}`);
}

function getTodayEvents(events) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  return events.filter(e => {
    const eventDate = new Date(e.start);
    return eventDate >= todayStart && eventDate < todayEnd;
  }).sort((a, b) => new Date(a.start) - new Date(b.start));
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  try {
    const allEvents = [];
    
    for (const [name, url] of Object.entries(CALENDARS)) {
      if (url) {
        try {
          const icsData = await fetchICS(url);
          const events = parseICS(icsData);
          events.forEach(e => e.calendar = name);
          allEvents.push(...events);
        } catch (err) {
          console.error(`Error fetching ${name}:`, err.message);
        }
      }
    }

    const todayEvents = getTodayEvents(allEvents);
    
    res.json({
      success: true,
      date: new Date().toISOString().split('T')[0],
      meetings: todayEvents.map(e => ({
        title: e.title,
        start: e.start,
        end: e.end,
        location: e.location,
        calendar: e.calendar
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

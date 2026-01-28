import React, { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import './HorizonMode.css';

// Get current time in Asia/Nicosia timezone
function getNicosiaTime() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Nicosia' }));
}

function daysFromNow(dateStr) {
  const now = getNicosiaTime();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

function formatDateRange(start, end) {
  const opts = { day: 'numeric', month: 'short', timeZone: 'Asia/Nicosia' };
  const s = new Date(start).toLocaleDateString('en-US', opts);
  if (!end || start === end) return s;
  const e = new Date(end).toLocaleDateString('en-US', opts);
  return `${s} — ${e}`;
}

// Calculate prep window based on event type and days away
function calculatePrepWindow(item) {
  const { _type, daysAway } = item;
  
  // Default prep windows by type
  const prepWindows = {
    trip: 14,      // 2 weeks before
    birthday: 7,   // 1 week before
    milestone: 30, // 1 month before
    holiday: 3,    // 3 days before
  };
  
  const prepDays = item.prepDays || prepWindows[_type] || 7;
  const isInPrepWindow = daysAway <= prepDays;
  
  return {
    prepDays,
    isInPrepWindow,
    daysUntilPrep: isInPrepWindow ? 0 : daysAway - prepDays,
  };
}

// Get meaning context for each event type
function getMeaning(item) {
  const { _type, metadata } = item;
  
  // Check for explicit meaning in metadata
  if (metadata?.meaning) return metadata.meaning;
  if (metadata?.why) return metadata.why;
  
  // Default meanings by type
  switch (_type) {
    case 'trip':
      return 'Family time and getting out of routine';
    case 'birthday':
      return 'Celebration and connection with loved ones';
    case 'milestone':
      return 'A step forward toward the goal';
    case 'holiday':
      return 'Break from routine, time together';
    default:
      return null;
  }
}

function classifyType(item) {
  if (item._type === 'trip') return { icon: '✈️', label: 'Trip' };
  if (item._type === 'birthday') return { icon: '🎂', label: 'Birthday' };
  if (item._type === 'holiday') return { icon: '🧒', label: 'Holiday' };
  if (item._type === 'milestone') return { icon: '🏁', label: 'Milestone' };
  return { icon: '📅', label: 'Event' };
}

// Check if an event is a "big event" worthy of Horizon
function isBigEvent(event) {
  const cat = (event.category || '').toLowerCase();
  const title = (event.title || '').toLowerCase();
  const meta = event.metadata || {};
  
  // Explicit horizon flag
  if (meta.horizon === true) return true;
  if (meta.horizon === false) return false;
  
  // Always exclude: reminders, tasks, routine appointments
  const excludePatterns = [
    'reminder', 'תזכורת', 'todo', 'משימה',
    'meeting', 'פגישה', 'call', 'שיחה',
    'dentist', 'רופא', 'doctor', 'appointment',
    'gym', 'workout', 'אימון',
  ];
  
  for (const pattern of excludePatterns) {
    if (title.includes(pattern) || cat.includes(pattern)) {
      return false;
    }
  }
  
  // Always include: birthdays, trips, holidays, milestones
  const includePatterns = [
    'birthday', 'יום הולדת', 'anniversary', 'יום נישואין',
    'trip', 'טיול', 'vacation', 'חופשה',
    'holiday', 'חג', 'passover', 'pesach', 'sukkot', 'hanukkah',
    'milestone', 'launch', 'deadline',
  ];
  
  for (const pattern of includePatterns) {
    if (title.includes(pattern) || cat.includes(pattern)) {
      return true;
    }
  }
  
  // Multi-day events are usually big
  const startDate = event.start_time?.split('T')[0];
  const endDate = event.end_time?.split('T')[0];
  if (endDate && startDate && endDate !== startDate) {
    return true;
  }
  
  return false;
}

function HorizonMode() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHorizonData = useCallback(async () => {
    if (!isSupabaseConfigured()) { setLoading(false); return; }

    try {
      const now = getNicosiaTime();
      const todayStr = now.toISOString().split('T')[0];

      const [tripsRes, eventsRes, goalsRes] = await Promise.all([
        supabase.from('trips').select('*').gte('end_date', todayStr).order('start_date'),
        supabase.from('events').select('*').gte('start_time', `${todayStr}T00:00:00Z`).eq('user_id', 'dan').order('start_time'),
        supabase.from('goals').select('*').eq('user_id', 'dan').eq('status', 'active'),
      ]);

      const horizonItems = [];

      // Trips — always big events
      (tripsRes.data || []).forEach(trip => {
        const startDate = trip.start_date || trip.metadata?.start_date;
        if (!startDate) return;
        
        const days = daysFromNow(startDate);
        if (days < 0) return;
        
        const item = {
          id: `trip-${trip.id}`,
          _type: 'trip',
          title: trip.title || trip.destination || 'טיול',
          startDate,
          endDate: trip.end_date || trip.metadata?.end_date || startDate,
          daysAway: days,
          metadata: trip.metadata || {},
          prepStatus: trip.metadata?.prep_status || null,
          prepDays: trip.metadata?.prep_days || 14,
        };
        
        item.meaning = getMeaning(item);
        Object.assign(item, calculatePrepWindow(item));
        
        horizonItems.push(item);
      });

      // Events — filter to big events only
      (eventsRes.data || []).forEach(event => {
        if (!isBigEvent(event)) return;
        
        const cat = (event.category || '').toLowerCase();
        const meta = event.metadata || {};
        const startDate = event.start_time?.split('T')[0];
        if (!startDate) return;
        
        const days = daysFromNow(startDate);
        if (days < 0) return;
        
        const endDate = event.end_time?.split('T')[0];
        const isMultiDay = endDate && endDate !== startDate;
        const isBirthday = cat.includes('birthday') || cat.includes('יום הולדת') || cat.includes('anniversary');
        const isHoliday = cat.includes('holiday') || cat.includes('חופש') || cat.includes('school') || cat.includes('חג');

        let itemType = 'trip';
        if (isBirthday) itemType = 'birthday';
        else if (isHoliday) itemType = 'holiday';
        else if (!isMultiDay) itemType = 'milestone';

        const item = {
          id: `event-${itemType}-${event.id}`,
          _type: itemType,
          title: event.title,
          startDate,
          endDate: endDate || startDate,
          daysAway: days,
          metadata: meta,
          prepStatus: meta.prep_status || null,
          prepDays: meta.prep_days || null,
        };
        
        item.meaning = getMeaning(item);
        Object.assign(item, calculatePrepWindow(item));
        
        horizonItems.push(item);
      });

      // Goals with deadlines → milestones
      (goalsRes.data || []).forEach(goal => {
        const deadline = goal.deadline || goal.metrics?.deadline || goal.metrics?.event;
        if (!deadline) return;

        let deadlineDate;
        try {
          deadlineDate = new Date(deadline);
          if (isNaN(deadlineDate.getTime())) return;
        } catch { return; }

        const deadlineDateStr = deadlineDate.toISOString().split('T')[0];
        const days = daysFromNow(deadlineDateStr);
        if (days < 0) return;

        const confidence = goal.metadata?.confidence || 'unknown';

        const item = {
          id: `goal-${goal.id}`,
          _type: 'milestone',
          title: goal.title,
          startDate: deadlineDateStr,
          endDate: deadlineDateStr,
          daysAway: days,
          metadata: goal.metadata || {},
          goalConfidence: confidence,
          domain: goal.domain,
          prepDays: goal.metadata?.prep_days || 30,
        };
        
        item.meaning = goal.metadata?.why || getMeaning(item);
        Object.assign(item, calculatePrepWindow(item));
        
        horizonItems.push(item);
      });

      // Sort by days away
      horizonItems.sort((a, b) => a.daysAway - b.daysAway);

      setItems(horizonItems);
    } catch (err) {
      console.error('Horizon fetch error:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchHorizonData(); }, [fetchHorizonData]);

  // Group into time buckets
  const next7 = items.filter(i => i.daysAway <= 7);
  const next30 = items.filter(i => i.daysAway > 7 && i.daysAway <= 30);
  const later = items.filter(i => i.daysAway > 30);

  if (loading) {
    return (
      <div className="horizon">
        <div className="horizon-loading">
          <div className="horizon-pulse" />
          <span>Loading horizon...</span>
        </div>
      </div>
    );
  }

  const renderCard = (item) => {
    const type = classifyType(item);
    const { isInPrepWindow, daysUntilPrep } = item;
    
    return (
      <div 
        key={item.id} 
        className={`horizon-card ${isInPrepWindow ? 'horizon-card--prep-active' : 'horizon-card--prep-future'}`}
      >
        <div className="horizon-card-icon">{type.icon}</div>
        <div className="horizon-card-content">
          <div className="horizon-card-header">
            <span className="horizon-card-title">{item.title}</span>
            <span className={`horizon-card-days ${item.daysAway <= 3 ? 'horizon-card-days--soon' : ''}`}>
              {item.daysAway === 0 ? 'Today' :
               item.daysAway === 1 ? 'Tomorrow' :
               `In ${item.daysAway} days`}
            </span>
          </div>
          
          <span className="horizon-card-date">
            {formatDateRange(item.startDate, item.endDate)}
          </span>
          
          {/* Meaning — why this matters */}
          {item.meaning && (
            <span className="horizon-card-meaning">
              💭 {item.meaning}
            </span>
          )}
          
          {/* Prep window indicator */}
          <div className={`horizon-card-prep-window ${isInPrepWindow ? 'prep-active' : 'prep-future'}`}>
            {isInPrepWindow ? (
              <>
                <span className="prep-indicator prep-indicator--active">⏰</span>
                <span>Time to prepare</span>
                {item.prepStatus && <span className="prep-status">• {item.prepStatus}</span>}
              </>
            ) : (
              <>
                <span className="prep-indicator prep-indicator--future">📅</span>
                <span>Prep starts in {daysUntilPrep} days</span>
              </>
            )}
          </div>
          
          {/* Goal confidence for milestones */}
          {item.goalConfidence && (
            <span className={`horizon-card-confidence goal-${item.goalConfidence}`}>
              {item.goalConfidence === 'on_track' ? '✅ On track' :
               item.goalConfidence === 'behind' ? '⚠️ Behind' :
               item.goalConfidence === 'ahead' ? '🚀 Ahead' :
               '❓ Unknown'}
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderBucket = (title, emoji, bucketItems) => {
    if (bucketItems.length === 0) return null;
    return (
      <section className="horizon-section">
        <h2 className="horizon-section-title">{emoji} {title}</h2>
        <div className="horizon-cards">
          {bucketItems.map(renderCard)}
        </div>
      </section>
    );
  };

  return (
    <div className="horizon">
      <div className="horizon-container">
        <header className="horizon-header">
          <h1>🔭 Horizon</h1>
          <p className="horizon-sub">Big events on the horizon — only what truly matters</p>
        </header>

        {items.length === 0 ? (
          <div className="horizon-empty">
            <span className="horizon-empty-icon">🌅</span>
            <p>No big events on the horizon</p>
            <p className="horizon-empty-sub">All quiet — enjoy the moment</p>
          </div>
        ) : (
          <>
            {renderBucket('This Week', '📍', next7)}
            {renderBucket('This Month', '📅', next30)}
            {renderBucket('Later', '🌊', later)}
          </>
        )}
        
        <footer className="horizon-footer">
          <p>Only trips, birthdays, and milestones • No daily reminders</p>
        </footer>
      </div>
    </div>
  );
}

export default HorizonMode;

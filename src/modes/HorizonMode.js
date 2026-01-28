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
  const s = new Date(start).toLocaleDateString('he-IL', opts);
  if (!end || start === end) return s;
  const e = new Date(end).toLocaleDateString('he-IL', opts);
  return `${s} — ${e}`;
}

function classifyType(item) {
  // Determine icon and type label
  if (item._type === 'trip') return { icon: '✈️', label: 'טיול' };
  if (item._type === 'birthday') return { icon: '🎂', label: 'יום הולדת' };
  if (item._type === 'holiday') return { icon: '🧒', label: 'חופשה' };
  if (item._type === 'milestone') return { icon: '🏁', label: 'מטרה' };
  return { icon: '📅', label: 'אירוע' };
}

function HorizonMode() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHorizonData = useCallback(async () => {
    if (!isSupabaseConfigured()) { setLoading(false); return; }

    try {
      const now = getNicosiaTime();
      const todayStr = now.toISOString().split('T')[0];

      // Fetch trips, events (multi-day, birthdays, holidays), and goals with deadlines
      const [tripsRes, eventsRes, goalsRes] = await Promise.all([
        supabase.from('trips').select('*').gte('end_date', todayStr).order('start_date'),
        supabase.from('events').select('*').gte('start_time', `${todayStr}T00:00:00Z`).eq('user_id', 'dan').order('start_time'),
        supabase.from('goals').select('*').eq('user_id', 'dan').eq('status', 'active'),
      ]);

      const horizonItems = [];

      // Trips
      (tripsRes.data || []).forEach(trip => {
        const startDate = trip.start_date || trip.metadata?.start_date;
        if (!startDate) return;
        horizonItems.push({
          id: `trip-${trip.id}`,
          _type: 'trip',
          title: trip.title || trip.destination || 'טיול',
          startDate,
          endDate: trip.end_date || trip.metadata?.end_date || startDate,
          daysAway: daysFromNow(startDate),
          prep: trip.metadata?.prep_status || null,
          dependencies: [],
          confidence: trip.source === 'calendar' ? 'partial' : 'full',
        });
      });

      // Events — filter to big events only (multi-day, birthdays, holidays)
      (eventsRes.data || []).forEach(event => {
        const cat = (event.category || '').toLowerCase();
        const meta = event.metadata || {};
        const startDate = event.start_time?.split('T')[0];
        if (!startDate) return;
        const endDate = event.end_time?.split('T')[0];

        // Multi-day events (trips)
        const isMultiDay = endDate && endDate !== startDate;
        const isBirthday = cat.includes('birthday') || cat.includes('יום הולדת') || cat.includes('anniversary');
        const isHoliday = cat.includes('holiday') || cat.includes('חופש') || cat.includes('school');

        if (isMultiDay && !isBirthday && !isHoliday) {
          horizonItems.push({
            id: `event-trip-${event.id}`,
            _type: 'trip',
            title: event.title,
            startDate,
            endDate,
            daysAway: daysFromNow(startDate),
            prep: meta.prep_status || null,
            dependencies: [],
            confidence: event.source === 'calendar' ? 'partial' : 'full',
          });
        } else if (isBirthday) {
          horizonItems.push({
            id: `event-bday-${event.id}`,
            _type: 'birthday',
            title: event.title,
            startDate,
            endDate: startDate,
            daysAway: daysFromNow(startDate),
            prep: null,
            dependencies: [],
            confidence: 'full',
          });
        } else if (isHoliday) {
          horizonItems.push({
            id: `event-holiday-${event.id}`,
            _type: 'holiday',
            title: event.title,
            startDate,
            endDate: endDate || startDate,
            daysAway: daysFromNow(startDate),
            prep: null,
            dependencies: [],
            confidence: 'full',
          });
        }
      });

      // Goals with deadlines → milestones
      (goalsRes.data || []).forEach(goal => {
        const deadline = goal.deadline || goal.metrics?.deadline || goal.metrics?.event;
        if (!deadline) return;

        // Try to parse deadline — might be a date or text like "April 2026"
        let deadlineDate;
        try {
          deadlineDate = new Date(deadline);
          if (isNaN(deadlineDate.getTime())) return;
        } catch { return; }

        const deadlineDateStr = deadlineDate.toISOString().split('T')[0];
        const days = daysFromNow(deadlineDateStr);
        if (days < 0) return; // past deadline

        // Determine confidence from goal metadata
        const confidence = goal.metadata?.confidence || 'unknown';

        horizonItems.push({
          id: `goal-${goal.id}`,
          _type: 'milestone',
          title: goal.title,
          startDate: deadlineDateStr,
          endDate: deadlineDateStr,
          daysAway: days,
          prep: null,
          dependencies: [],
          confidence: 'full',
          goalConfidence: confidence,
          domain: goal.domain,
        });
      });

      // Sort by days away
      horizonItems.sort((a, b) => a.daysAway - b.daysAway);

      // Filter out past items
      setItems(horizonItems.filter(i => i.daysAway >= 0));
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
          <span>טוען אופק...</span>
        </div>
      </div>
    );
  }

  const renderBucket = (title, bucketItems) => {
    if (bucketItems.length === 0) return null;
    return (
      <section className="horizon-section">
        <h2 className="horizon-section-title">{title}</h2>
        <div className="horizon-cards">
          {bucketItems.map(item => {
            const type = classifyType(item);
            return (
              <div key={item.id} className="horizon-card">
                <div className="horizon-card-icon">{type.icon}</div>
                <div className="horizon-card-content">
                  <div className="horizon-card-header">
                    <span className="horizon-card-title">{item.title}</span>
                    <span className="horizon-card-days">
                      {item.daysAway === 0 ? 'היום' :
                       item.daysAway === 1 ? 'מחר' :
                       `עוד ${item.daysAway} ימים`}
                    </span>
                  </div>
                  <span className="horizon-card-date">
                    {formatDateRange(item.startDate, item.endDate)}
                  </span>
                  {item.prep && (
                    <span className="horizon-card-prep">🔧 {item.prep}</span>
                  )}
                  {item.goalConfidence && (
                    <span className={`horizon-card-confidence goal-${item.goalConfidence}`}>
                      {item.goalConfidence === 'on_track' ? '✅ במסלול' :
                       item.goalConfidence === 'behind' ? '⚠️ מאחור' :
                       item.goalConfidence === 'ahead' ? '🚀 מקדים' :
                       '❓ לא ידוע'}
                    </span>
                  )}
                  {item.dependencies && item.dependencies.length > 0 && (
                    <span className="horizon-card-deps">
                      🔗 {item.dependencies.length} תלויות פתוחות
                    </span>
                  )}
                  {item.confidence === 'partial' && (
                    <span className="horizon-card-partial">פרטים חלקיים</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <div className="horizon">
      <div className="horizon-container">
        <header className="horizon-header">
          <h1>🔭 Horizon</h1>
          <p className="horizon-sub">מה בא — מבט רגוע קדימה</p>
        </header>

        {items.length === 0 ? (
          <div className="horizon-empty">
            <span className="horizon-empty-icon">🌅</span>
            <p>אין אירועים גדולים באופק</p>
            <p className="horizon-empty-sub">הכל שקט — תהנה מהרגע</p>
          </div>
        ) : (
          <>
            {renderBucket('📍 השבוע הקרוב', next7)}
            {renderBucket('📅 החודש הקרוב', next30)}
            {renderBucket('🌊 בהמשך', later)}
          </>
        )}
      </div>
    </div>
  );
}

export default HorizonMode;

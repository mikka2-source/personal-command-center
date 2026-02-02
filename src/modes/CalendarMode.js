import React, { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import './CalendarMode.css';

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

function classifyType(item) {
  if (item._type === 'trip') return { icon: '✈️', label: 'Trip', color: '#3b82f6' };
  if (item._type === 'birthday') return { icon: '🎂', label: 'Birthday', color: '#ec4899' };
  if (item._type === 'holiday') return { icon: '🧒', label: 'Holiday', color: '#f59e0b' };
  if (item._type === 'milestone') return { icon: '📅', label: 'Event', color: '#8b5cf6' };
  return { icon: '📅', label: 'Event', color: '#6b7280' };
}

// Check if an event is a "big event" worthy of Horizon/Calendar
function isBigEvent(event) {
  const cat = (event.category || '').toLowerCase();
  const title = (event.title || '').toLowerCase();
  const meta = event.metadata || {};
  
  if (meta.horizon === true) return true;
  if (meta.horizon === false) return false;
  
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
  
  const includePatterns = [
    'birthday', 'יום הולדת', 'anniversary', 'יום נישואין',
    'trip', 'טיול', 'vacation', 'חופשה',
    'holiday', 'חג', 'passover', 'pesach', 'sukkot', 'hanukkah',
    'milestone', 'launch', 'deadline', 'conference', 'כנס',
  ];
  
  for (const pattern of includePatterns) {
    if (title.includes(pattern) || cat.includes(pattern)) {
      return true;
    }
  }
  
  const startDate = event.start_time?.split('T')[0];
  const endDate = event.end_time?.split('T')[0];
  if (endDate && startDate && endDate !== startDate) {
    return true;
  }
  
  return false;
}

function CalendarMode() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = getNicosiaTime();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const fetchCalendarData = useCallback(async () => {
    if (!isSupabaseConfigured()) { setLoading(false); return; }

    try {
      const now = getNicosiaTime();
      const todayStr = now.toISOString().split('T')[0];
      
      // Fetch 6 months ahead
      const futureDate = new Date(now);
      futureDate.setMonth(futureDate.getMonth() + 6);
      const futureStr = futureDate.toISOString().split('T')[0];

      const [tripsRes, eventsRes, goalsRes] = await Promise.all([
        supabase.from('trips').select('*').gte('end_date', todayStr).lte('start_date', futureStr).order('start_date'),
        supabase.from('events').select('*').gte('start_time', `${todayStr}T00:00:00Z`).lte('start_time', `${futureStr}T23:59:59Z`).eq('user_id', 'dan').order('start_time'),
        supabase.from('goals').select('*').eq('user_id', 'dan').eq('status', 'active'),
      ]);

      const calendarItems = [];

      // Trips
      (tripsRes.data || []).forEach(trip => {
        const startDate = trip.start_date || trip.metadata?.start_date;
        if (!startDate) return;
        
        const days = daysFromNow(startDate);
        if (days < 0) return;
        
        calendarItems.push({
          id: `trip-${trip.id}`,
          _type: 'trip',
          title: trip.title || trip.destination || 'טיול',
          startDate,
          endDate: trip.end_date || trip.metadata?.end_date || startDate,
          daysAway: days,
        });
      });

      // Events — filter to big events only
      (eventsRes.data || []).forEach(event => {
        if (!isBigEvent(event)) return;
        
        const cat = (event.category || '').toLowerCase();
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

        calendarItems.push({
          id: `event-${itemType}-${event.id}`,
          _type: itemType,
          title: event.title,
          startDate,
          endDate: endDate || startDate,
          daysAway: days,
        });
      });

      // Goals with deadlines
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

        calendarItems.push({
          id: `goal-${goal.id}`,
          _type: 'milestone',
          title: goal.title,
          startDate: deadlineDateStr,
          endDate: deadlineDateStr,
          daysAway: days,
        });
      });

      setItems(calendarItems);
    } catch (err) {
      console.error('Calendar fetch error:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCalendarData(); }, [fetchCalendarData]);

  // Build calendar grid
  const buildCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay(); // 0=Sun
    
    const days = [];
    
    // Padding for previous month
    for (let i = 0; i < startPadding; i++) {
      days.push({ day: null, date: null });
    }
    
    // Days of current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ day: d, date: dateStr });
    }
    
    return days;
  };

  // Get events for a specific date (including multi-day spans)
  const getEventsForDate = (dateStr) => {
    if (!dateStr) return [];
    
    return items.filter(item => {
      const start = item.startDate;
      const end = item.endDate;
      return dateStr >= start && dateStr <= end;
    });
  };

  const goToPrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const goToToday = () => {
    const now = getNicosiaTime();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const today = getNicosiaTime();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (loading) {
    return (
      <div className="calendar-mode">
        <div className="calendar-loading">
          <div className="calendar-pulse" />
          <span>Loading calendar...</span>
        </div>
      </div>
    );
  }

  const calendarDays = buildCalendarDays();

  return (
    <div className="calendar-mode">
      <div className="calendar-container">
        <header className="calendar-header">
          <h1>📅 Calendar</h1>
          <div className="calendar-nav">
            <button onClick={goToPrevMonth} className="calendar-nav-btn">◀</button>
            <span className="calendar-month-title">
              {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </span>
            <button onClick={goToNextMonth} className="calendar-nav-btn">▶</button>
            <button onClick={goToToday} className="calendar-today-btn">Today</button>
          </div>
        </header>

        {/* Legend */}
        <div className="calendar-legend">
          <span className="legend-item"><span className="legend-dot" style={{background: '#3b82f6'}}></span> טיסות/כנסים</span>
          <span className="legend-item"><span className="legend-dot" style={{background: '#f59e0b'}}></span> חופשות ילדים</span>
          <span className="legend-item"><span className="legend-dot" style={{background: '#ec4899'}}></span> ימי הולדת</span>
          <span className="legend-item"><span className="legend-dot" style={{background: '#8b5cf6'}}></span> אירועים</span>
        </div>

        <div className="calendar-grid">
          {/* Day headers */}
          {dayNames.map(day => (
            <div key={day} className="calendar-day-header">{day}</div>
          ))}
          
          {/* Calendar cells */}
          {calendarDays.map((cell, idx) => {
            const events = getEventsForDate(cell.date);
            const isToday = cell.date === todayStr;
            const isPast = cell.date && cell.date < todayStr;
            
            return (
              <div 
                key={idx} 
                className={`calendar-cell ${!cell.day ? 'calendar-cell--empty' : ''} ${isToday ? 'calendar-cell--today' : ''} ${isPast ? 'calendar-cell--past' : ''}`}
              >
                {cell.day && (
                  <>
                    <span className="calendar-cell-day">{cell.day}</span>
                    <div className="calendar-cell-events">
                      {events.slice(0, 3).map(event => {
                        const type = classifyType(event);
                        return (
                          <div 
                            key={event.id} 
                            className="calendar-event"
                            style={{ backgroundColor: type.color }}
                            title={event.title}
                          >
                            <span className="calendar-event-icon">{type.icon}</span>
                            <span className="calendar-event-title">{event.title}</span>
                          </div>
                        );
                      })}
                      {events.length > 3 && (
                        <div className="calendar-more">+{events.length - 3} more</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Upcoming list */}
        <div className="calendar-upcoming">
          <h2>📍 Coming Up</h2>
          <div className="calendar-upcoming-list">
            {items.slice(0, 10).map(item => {
              const type = classifyType(item);
              return (
                <div key={item.id} className="calendar-upcoming-item">
                  <span className="upcoming-icon">{type.icon}</span>
                  <span className="upcoming-title">{item.title}</span>
                  <span className="upcoming-days">
                    {item.daysAway === 0 ? 'היום' :
                     item.daysAway === 1 ? 'מחר' :
                     `בעוד ${item.daysAway} ימים`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CalendarMode;

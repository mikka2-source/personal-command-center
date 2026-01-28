import React, { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import './CommandMode.css';

const TODAY = new Date().toISOString().split('T')[0];

// Get current time in Asia/Nicosia timezone
function getNicosiaTime() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Nicosia' }));
}

// Classify an event's time status relative to NOW
function classifyEventTime(text, startTime, endTime) {
  const now = getNicosiaTime();
  const start = startTime ? new Date(startTime) : null;
  const end = endTime ? new Date(endTime) : null;

  if (end && end < now) return 'past';
  if (start && start <= now && (!end || end >= now)) return 'ongoing';
  if (start && start > now) return 'upcoming';
  if (start && start < now) return 'past';
  return 'upcoming'; // tasks without time default to upcoming
}

function CommandMode() {
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(getNicosiaTime());

  const fetchBrief = useCallback(async () => {
    if (!isSupabaseConfigured()) { setLoading(false); return; }
    try {
      const { data } = await supabase
        .from('daily_briefs')
        .select('*')
        .eq('user_id', 'dan')
        .eq('date', TODAY)
        .single();
      if (data) setBrief(data);
    } catch (err) {
      console.error('Brief fetch error:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchBrief(); }, [fetchBrief]);

  // Refresh time every minute to auto-update past/ongoing/upcoming status
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(getNicosiaTime());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 6) return 'לילה טוב';
    if (hour < 12) return 'בוקר טוב';
    if (hour < 17) return 'צהריים טובים';
    if (hour < 21) return 'ערב טוב';
    return 'לילה טוב';
  };

  const getDayString = () => {
    return new Date().toLocaleDateString('he-IL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'Asia/Nicosia'
    });
  };

  // Get focus items: re-classify at render time (live time-awareness)
  const getFocusItems = () => {
    if (!brief) return { ongoing: [], upcoming: [], past: [], tasks: [] };

    // Use structured data if available (stored in metadata), otherwise parse legacy
    const structured = brief.doing_today_structured || brief.metadata?.doing_today_structured || [];
    
    if (structured.length > 0) {
      // Re-classify based on CURRENT time (not brief generation time)
      const reclassified = structured.map(item => ({
        ...item,
        liveStatus: classifyEventTime(item.text, item.startTime, item.endTime)
      }));

      return {
        ongoing: reclassified.filter(i => i.liveStatus === 'ongoing'),
        upcoming: reclassified.filter(i => i.liveStatus === 'upcoming'),
        past: reclassified.filter(i => i.liveStatus === 'past'),
        tasks: reclassified.filter(i => i.timeStatus === 'task')
      };
    }

    // Legacy fallback: use doing_today as flat strings
    // Try to parse time from "HH:MM title" format
    const items = (brief.doing_today || []).map(text => {
      const timeMatch = text.match(/^(\d{1,2}:\d{2})\s/);
      if (timeMatch) {
        const [h, m] = timeMatch[1].split(':').map(Number);
        const eventDate = new Date(currentTime);
        eventDate.setHours(h, m, 0, 0);
        // Estimate end as 1 hour after start
        const endDate = new Date(eventDate.getTime() + 60 * 60 * 1000);
        const status = classifyEventTime(text, eventDate, endDate);
        return { text, liveStatus: status, isEvent: true };
      }
      return { text, liveStatus: 'upcoming', isEvent: false };
    });

    return {
      ongoing: items.filter(i => i.liveStatus === 'ongoing'),
      upcoming: items.filter(i => i.liveStatus === 'upcoming'),
      past: items.filter(i => i.liveStatus === 'past'),
      tasks: items.filter(i => !i.isEvent)
    };
  };

  const getMainFocus = () => {
    const { ongoing, upcoming, tasks } = getFocusItems();
    // Priority: ongoing > upcoming events > tasks
    if (ongoing.length > 0) return { text: ongoing[0].text, status: 'ongoing' };
    if (upcoming.length > 0) return { text: upcoming[0].text, status: 'upcoming' };
    if (tasks.length > 0) return { text: tasks[0].text, status: 'task' };
    // All events done — rest of day focus
    return null;
  };

  const getUpcomingItems = () => {
    const { ongoing, upcoming, tasks } = getFocusItems();
    // Skip the first one (shown as main focus), show next items
    const all = [...ongoing, ...upcoming, ...tasks];
    return all.slice(1, 4); // Next 3 items
  };

  const getPastItems = () => {
    const { past } = getFocusItems();
    const completed = brief?.completed_events || brief?.metadata?.completed_events || [];
    // Merge: re-classified past + stored completed
    const allPast = [
      ...past,
      ...completed.filter(c => !past.some(p => p.text === c.text))
    ];
    return allPast.slice(0, 3);
  };

  const getNotToday = () => {
    if (!brief?.not_doing_today?.length) return null;
    return brief.not_doing_today.slice(0, 2);
  };

  const getWarning = () => brief?.warning || null;

  const getSmallAction = () => brief?.small_action || null;

  const getSleepConfidence = () => brief?.sleep_confidence || brief?.metadata?.sleep_confidence || null;

  const getLoadLevel = () => {
    const score = brief?.load_score || 0;
    if (score >= 70) return { label: 'יום כבד', level: 'heavy', message: 'פחות = יותר. המסך ריק בכוונה.' };
    if (score >= 45) return { label: 'יום בינוני', level: 'medium', message: '' };
    return { label: 'יום קל', level: 'light', message: '' };
  };

  if (loading) {
    return (
      <div className="cmd">
        <div className="cmd-loading">
          <div className="cmd-pulse" />
        </div>
      </div>
    );
  }

  const mainFocus = getMainFocus();
  const upcomingItems = getUpcomingItems();
  const pastItems = getPastItems();
  const notToday = getNotToday();
  const warning = getWarning();
  const smallAction = getSmallAction();
  const load = getLoadLevel();
  const sleepConfidence = getSleepConfidence();
  const noActiveFocus = brief?.no_active_focus || brief?.metadata?.no_active_focus || (!mainFocus);

  return (
    <div className="cmd">
      <div className="cmd-container">
        {/* Greeting */}
        <header className="cmd-header">
          <h1 className="cmd-greeting">{getGreeting()}, דן</h1>
          <p className="cmd-date">{getDayString()}</p>
          {brief?.load_score != null && (
            <div className={`cmd-load cmd-load-${load.level}`}>
              {load.label}
            </div>
          )}
        </header>

        {/* The Command Cards */}
        <div className="cmd-cards">
          {/* 🎯 Main Focus — always ongoing or upcoming, never past */}
          {mainFocus ? (
            <div className={`cmd-card cmd-card-focus ${mainFocus.status === 'ongoing' ? 'cmd-card-ongoing' : ''}`}>
              <div className="cmd-card-icon">🎯</div>
              <div className="cmd-card-content">
                <span className="cmd-card-label">
                  {mainFocus.status === 'ongoing' ? 'עכשיו' : 'הבא בתור'}
                </span>
                <span className="cmd-card-value">{mainFocus.text}</span>
                {mainFocus.status === 'ongoing' && (
                  <span className="cmd-card-badge cmd-badge-live">● פעיל</span>
                )}
              </div>
            </div>
          ) : noActiveFocus ? (
            <div className="cmd-card cmd-card-focus cmd-card-clear">
              <div className="cmd-card-icon">✨</div>
              <div className="cmd-card-content">
                <span className="cmd-card-label">שאר היום</span>
                <span className="cmd-card-value">כל האירועים סיימו. הזמן שלך.</span>
              </div>
            </div>
          ) : null}

          {/* 📋 Upcoming items (if any beyond main focus) */}
          {upcomingItems.length > 0 && (
            <div className="cmd-card cmd-card-upcoming">
              <div className="cmd-card-icon">📋</div>
              <div className="cmd-card-content">
                <span className="cmd-card-label">אחר כך</span>
                {upcomingItems.map((item, i) => (
                  <span key={i} className="cmd-card-value cmd-card-upcoming-item">
                    {item.text}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ⛔ Not Today */}
          {notToday && notToday.length > 0 && (
            <div className="cmd-card cmd-card-not-today">
              <div className="cmd-card-icon">⛔</div>
              <div className="cmd-card-content">
                <span className="cmd-card-label">לא היום</span>
                {notToday.map((item, i) => (
                  <span key={i} className="cmd-card-value cmd-card-strike">{item}</span>
                ))}
              </div>
            </div>
          )}

          {/* ⚠️ Warning */}
          {warning && (
            <div className="cmd-card cmd-card-warning">
              <div className="cmd-card-icon">⚠️</div>
              <div className="cmd-card-content">
                <span className="cmd-card-label">
                  שים לב
                  {sleepConfidence === 'low' && warning.includes('שינה') && (
                    <span className="cmd-confidence-tag"> · נתונים חלקיים</span>
                  )}
                </span>
                <span className="cmd-card-value">{warning}</span>
              </div>
            </div>
          )}

          {/* ✅ Decision Action — time-anchored */}
          {smallAction && (
            <div className="cmd-card cmd-card-action">
              <div className="cmd-card-icon">⚡</div>
              <div className="cmd-card-content">
                <span className="cmd-card-label">החלטה</span>
                <span className="cmd-card-value">{smallAction}</span>
              </div>
            </div>
          )}
        </div>

        {/* Past events — visually downgraded, collapsed at bottom */}
        {pastItems.length > 0 && (
          <div className="cmd-completed">
            <span className="cmd-completed-label">✓ הושלם</span>
            <div className="cmd-completed-items">
              {pastItems.map((item, i) => (
                <span key={i} className="cmd-completed-item">
                  {item.text}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Heavy day message */}
        {load.level === 'heavy' && load.message && (
          <p className="cmd-heavy-msg">{load.message}</p>
        )}

        {/* No brief fallback */}
        {!brief && (
          <div className="cmd-empty">
            <p className="cmd-empty-text">אין תדריך להיום.</p>
            <p className="cmd-empty-sub">הפעל את Decision Engine כדי ליצור אחד.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default CommandMode;

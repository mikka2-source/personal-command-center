import React, { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { toast } from '../components/ui/use-toast';
import TaskCard from '../components/TaskCard';
import './CommandMode.css';

const TODAY = new Date().toISOString().split('T')[0];

// Get current time in Asia/Nicosia timezone
function getNicosiaTime() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Nicosia' }));
}

// Morning Anchor Component
function MorningAnchor({ onComplete }) {
  const [status, setStatus] = useState(null); // null | 'done' | 'skipped'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if already completed today
    async function checkStatus() {
      if (!isSupabaseConfigured()) { setLoading(false); return; }
      try {
        const { data } = await supabase
          .from('daily_briefs')
          .select('metadata')
          .eq('user_id', 'dan')
          .eq('date', TODAY)
          .single();
        if (data?.metadata?.morning_anchor) {
          setStatus(data.metadata.morning_anchor);
        }
      } catch (err) { /* no brief yet */ }
      setLoading(false);
    }
    checkStatus();
  }, []);

  const handleAction = async (action) => {
    setStatus(action);
    if (onComplete) onComplete(action);
    if (!isSupabaseConfigured()) return;

    try {
      // Try to update existing brief's metadata
      const { data: existing } = await supabase
        .from('daily_briefs')
        .select('metadata')
        .eq('user_id', 'dan')
        .eq('date', TODAY)
        .single();

      const currentMeta = existing?.metadata || {};
      const updatedMeta = { ...currentMeta, morning_anchor: action, morning_anchor_time: new Date().toISOString() };

      if (existing) {
        const { error } = await supabase
          .from('daily_briefs')
          .update({ metadata: updatedMeta })
          .eq('user_id', 'dan')
          .eq('date', TODAY);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('daily_briefs')
          .insert({
            user_id: 'dan',
            date: TODAY,
            doing_today: [],
            not_doing_today: [],
            load_score: 0,
            metadata: updatedMeta
          });
        if (error) throw error;
      }
    } catch (err) {
      console.error('Morning anchor save error:', err);
      setStatus(null); // Rollback optimistic update
      toast({ title: "Failed to save", description: "Morning anchor wasn't saved. Try again.", variant: "destructive" });
    }
  };

  const hour = getNicosiaTime().getHours();
  // Only show before 11:00 AM
  if (hour >= 11) return null;
  if (loading) return null;

  if (status === 'done') {
    return (
      <div className="cmd-card cmd-card-anchor cmd-card-anchor-done">
        <div className="cmd-card-icon">✅</div>
        <div className="cmd-card-content">
          <span className="cmd-card-label">Morning Anchor</span>
          <span className="cmd-card-value cmd-anchor-done-text">Completed — good day starts here</span>
        </div>
      </div>
    );
  }

  if (status === 'skipped') return null;

  return (
    <div className="cmd-card cmd-card-anchor">
      <div className="cmd-card-icon">☀️</div>
      <div className="cmd-card-content">
        <span className="cmd-card-label">Morning Anchor</span>
        <span className="cmd-card-value">Review / Coffee / Light movement</span>
        <div className="cmd-anchor-actions">
          <button className="cmd-anchor-btn cmd-anchor-done" onClick={() => handleAction('done')}>
            ✅ Done
          </button>
          <button className="cmd-anchor-btn cmd-anchor-skip" onClick={() => handleAction('skipped')}>
            ⏭️ Skip
          </button>
        </div>
      </div>
    </div>
  );
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
  const [closures, setClosures] = useState({ total: 0, breakdown: [] });
  const [showClosureBreakdown, setShowClosureBreakdown] = useState(false);
  const [anchorDone, setAnchorDone] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

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

  // Calculate closures in real-time
  const calculateClosures = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    const breakdown = [];
    let total = 0;

    try {
      // 1. Tasks completed today
      const { data: doneTasks } = await supabase
        .from('tasks')
        .select('id')
        .eq('user_id', 'dan')
        .eq('completed', true)
        .gte('completed_at', `${TODAY}T00:00:00Z`)
        .lte('completed_at', `${TODAY}T23:59:59Z`);
      const taskCount = doneTasks?.length || 0;
      if (taskCount > 0) {
        breakdown.push({ label: 'Tasks', count: taskCount });
        total += taskCount;
      }

      // 2. Events that passed (end_time < now)
      const nowISO = new Date().toISOString();
      const { data: pastEvents } = await supabase
        .from('events')
        .select('id')
        .eq('user_id', 'dan')
        .gte('start_time', `${TODAY}T00:00:00Z`)
        .lte('start_time', `${TODAY}T23:59:59Z`)
        .lt('end_time', nowISO);
      const eventCount = pastEvents?.length || 0;
      if (eventCount > 0) {
        breakdown.push({ label: 'Events', count: eventCount });
        total += eventCount;
      }

      // 3. Morning anchor
      const { data: briefData } = await supabase
        .from('daily_briefs')
        .select('metadata')
        .eq('user_id', 'dan')
        .eq('date', TODAY)
        .single();
      if (briefData?.metadata?.morning_anchor === 'done') {
        breakdown.push({ label: 'Morning Anchor', count: 1 });
        total += 1;
      }

      // 4. Workouts from health_data
      const { data: healthToday } = await supabase
        .from('health_data')
        .select('*')
        .eq('user_id', 'dan')
        .eq('date', TODAY)
        .single();
      if (healthToday?.steps && healthToday.steps > 5000) {
        breakdown.push({ label: 'Exercise', count: 1 });
        total += 1;
      }
    } catch (err) {
      console.error('Closures calc error:', err);
    }

    setClosures({ total, breakdown });
  }, []);

  useEffect(() => {
    calculateClosures();
    const interval = setInterval(calculateClosures, 120000); // refresh every 2 min
    return () => clearInterval(interval);
  }, [calculateClosures, anchorDone]);

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
    if (hour < 6) return 'Good night';
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    if (hour < 21) return 'Good evening';
    return 'Good night';
  };

  const getDayString = () => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'Asia/Nicosia'
    });
  };

  // Handle task click to open TaskCard
  const handleTaskClick = (item) => {
    // Convert focus item to task format for TaskCard
    const task = {
      id: item.id || item.taskId || `temp-${Date.now()}`,
      text: item.text,
      title: item.text,
      labels: item.labels || [],
      energy_level: item.energy_level || 'medium',
      dependencies: item.dependencies || '',
      frozen: item.frozen || false,
      archived: item.archived || false,
      assignee: item.assignee || 'dan'
    };
    setSelectedTask(task);
  };

  // Handle task update from TaskCard
  const handleTaskUpdate = (updatedTask) => {
    // Refresh the brief to reflect changes
    fetchBrief();
    calculateClosures();
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
    const items = (brief.doing_today || []).map((text, index) => {
      const timeMatch = text.match(/^(\d{1,2}:\d{2})\s/);
      if (timeMatch) {
        const [h, m] = timeMatch[1].split(':').map(Number);
        const eventDate = new Date(currentTime);
        eventDate.setHours(h, m, 0, 0);
        // Estimate end as 1 hour after start
        const endDate = new Date(eventDate.getTime() + 60 * 60 * 1000);
        const status = classifyEventTime(text, eventDate, endDate);
        return { text, liveStatus: status, isEvent: true, id: `event-${index}` };
      }
      return { text, liveStatus: 'upcoming', isEvent: false, isTask: true, id: `task-${index}` };
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
    if (score >= 70) return { label: 'Heavy day', level: 'heavy', message: 'Less = more. Screen is empty on purpose.' };
    if (score >= 45) return { label: 'Medium day', level: 'medium', message: '' };
    return { label: 'Light day', level: 'light', message: '' };
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
          <h1 className="cmd-greeting">{getGreeting()}, Dan</h1>
          <p className="cmd-date">{getDayString()}</p>
          {brief?.load_score != null && (
            <div className={`cmd-load cmd-load-${load.level}`}>
              {load.label}
            </div>
          )}
        </header>

        {/* Morning Anchor — before 11 AM only */}
        <MorningAnchor onComplete={(action) => {
          if (action === 'done') setAnchorDone(true);
        }} />

        {/* The Command Cards */}
        <div className="cmd-cards">
          {/* 🎯 Main Focus — always ongoing or upcoming, never past */}
          {mainFocus ? (
            <div 
              className={`cmd-card cmd-card-focus ${mainFocus.status === 'ongoing' ? 'cmd-card-ongoing' : ''} ${mainFocus.isTask ? 'cmd-card-clickable' : ''}`}
              onClick={() => mainFocus.isTask && handleTaskClick(mainFocus)}
              style={mainFocus.isTask ? { cursor: 'pointer' } : {}}
            >
              <div className="cmd-card-icon">🎯</div>
              <div className="cmd-card-content">
                <span className="cmd-card-label">
                  {mainFocus.status === 'ongoing' ? 'Now' : 'Up Next'}
                </span>
                <span className="cmd-card-value">{mainFocus.text}</span>
                {mainFocus.status === 'ongoing' && (
                  <span className="cmd-card-badge cmd-badge-live">● Active</span>
                )}
                {mainFocus.isTask && (
                  <span className="cmd-card-badge cmd-badge-edit">✏️ Click to edit</span>
                )}
              </div>
            </div>
          ) : noActiveFocus ? (
            <div className="cmd-card cmd-card-focus cmd-card-clear">
              <div className="cmd-card-icon">✨</div>
              <div className="cmd-card-content">
                <span className="cmd-card-label">Rest of day</span>
                <span className="cmd-card-value">All events done. Time is yours.</span>
              </div>
            </div>
          ) : null}

          {/* 📋 Upcoming items (if any beyond main focus) */}
          {upcomingItems.length > 0 && (
            <div className="cmd-card cmd-card-upcoming">
              <div className="cmd-card-icon">📋</div>
              <div className="cmd-card-content">
                <span className="cmd-card-label">Later</span>
                {upcomingItems.map((item, i) => (
                  <span 
                    key={i} 
                    className={`cmd-card-value cmd-card-upcoming-item ${item.isTask ? 'cmd-card-clickable-item' : ''}`}
                    onClick={() => item.isTask && handleTaskClick(item)}
                    style={item.isTask ? { cursor: 'pointer' } : {}}
                  >
                    {item.text}
                    {item.isTask && <span className="cmd-edit-hint"> ✏️</span>}
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
                <span className="cmd-card-label">Not Today</span>
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
                  Heads up
                  {sleepConfidence === 'low' && warning.includes('sleep') && (
                    <span className="cmd-confidence-tag"> · Partial data</span>
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
                <span className="cmd-card-label">Decision</span>
                <span className="cmd-card-value">{smallAction}</span>
              </div>
            </div>
          )}
        </div>

        {/* Past events — visually downgraded, collapsed at bottom */}
        {pastItems.length > 0 && (
          <div className="cmd-completed">
            <span className="cmd-completed-label">✓ Completed</span>
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
            <p className="cmd-empty-text">No brief for today.</p>
            <p className="cmd-empty-sub">Run the Decision Engine to create one.</p>
          </div>
        )}

        {/* Closures Counter */}
        {closures.total > 0 && (
          <div
            className="cmd-closures"
            onClick={() => setShowClosureBreakdown(!showClosureBreakdown)}
          >
            <span className="cmd-closures-label">Closures today: {closures.total}</span>
            {showClosureBreakdown && closures.breakdown.length > 0 && (
              <div className="cmd-closures-breakdown">
                {closures.breakdown.map((item, i) => (
                  <span key={i} className="cmd-closures-item">
                    {item.label}: {item.count}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* TaskCard Modal */}
      {selectedTask && (
        <TaskCard
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleTaskUpdate}
        />
      )}
    </div>
  );
}

export default CommandMode;

import React, { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import './UnifiedFeed.css';

const AREA_MAP = {
  work: { label: 'XBO', color: '#3b82f6' },
  realestate: { label: 'נדל"ן', color: '#10b981' },
  health: { label: 'בריאות', color: '#22c55e' },
  family: { label: 'משפחה', color: '#f59e0b' },
  salon: { label: 'סלון', color: '#ec4899' },
  personal: { label: 'אישי', color: '#8b5cf6' },
  investments: { label: 'השקעות', color: '#6366f1' },
  sport: { label: 'ספורט', color: '#22c55e' },
  travel: { label: 'נסיעות', color: '#f97316' },
};

function getAreaInfo(area) {
  if (!area) return { label: '—', color: '#525252' };
  return AREA_MAP[area] || AREA_MAP[area.toLowerCase()] || { label: area, color: '#525252' };
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return 'עכשיו';
  if (diff < 3600) return `לפני ${Math.floor(diff / 60)} דק׳`;
  if (diff < 86400) return `לפני ${Math.floor(diff / 3600)} שע׳`;
  if (diff < 604800) return `לפני ${Math.floor(diff / 86400)} ימים`;
  return d.toLocaleDateString('he-IL');
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

function isToday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function isPast(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function UnifiedFeed() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    tasks: [], events: [], dependencies: [], projects: [], goals: [], parking: [], ai_activity: []
  });
  const [expandedSections, setExpandedSections] = useState({ 
    ai_activity: false, 
    parking: false,
    calendar: true,
    tasks: true,
    projects: true,
    dependencies: true,
    goals: true
  });
  const [completingTasks, setCompletingTasks] = useState(new Set());

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured()) { setLoading(false); return; }
    try {
      const [tasks, events, deps, projects, goals, parking, ai] = await Promise.all([
        supabase.from('tasks').select('*').eq('completed', false).order('created_at', { ascending: false }),
        supabase.from('events').select('*').order('start_time', { ascending: true }),
        supabase.from('dependencies').select('*').eq('status', 'waiting').order('created_at', { ascending: false }),
        supabase.from('projects').select('*').in('status', ['active', 'idea', 'frozen']).order('updated_at', { ascending: false }),
        supabase.from('goals').select('*').eq('status', 'active').order('priority', { ascending: false }),
        supabase.from('parking').select('*').order('created_at', { ascending: false }),
        supabase.from('ai_activity').select('*').order('timestamp', { ascending: false }).limit(10),
      ]);
      setData({
        tasks: tasks.data || [],
        events: (events.data || []).filter(e => isToday(e.start_time)),
        dependencies: deps.data || [],
        projects: projects.data || [],
        goals: goals.data || [],
        parking: parking.data || [],
        ai_activity: ai.data || [],
      });
    } catch (err) {
      console.error('Feed fetch error:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const completeTask = async (taskId) => {
    setCompletingTasks(prev => new Set([...prev, taskId]));
    try {
      await supabase.from('tasks').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', taskId);
      setTimeout(() => {
        setData(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== taskId) }));
        setCompletingTasks(prev => { const n = new Set(prev); n.delete(taskId); return n; });
      }, 400);
    } catch (err) {
      console.error('Complete task error:', err);
      setCompletingTasks(prev => { const n = new Set(prev); n.delete(taskId); return n; });
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (loading) {
    return (
      <div className="feed-container">
        <div className="feed-loading">
          <div className="feed-loading-spinner" />
          <span>טוען...</span>
        </div>
      </div>
    );
  }

  const hasNothing = !data.events.length && !data.tasks.length && !data.projects.length && 
                     !data.dependencies.length && !data.goals.length && !data.parking.length;

  return (
    <div className="feed-container">

      {hasNothing && (
        <div className="feed-empty">
          <span className="feed-empty-icon">✨</span>
          <span>הכל נקי.</span>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          CALENDAR — One unified feed with area color labels
          ═══════════════════════════════════════════════ */}
      {data.events.length > 0 && (
        <div className="feed-section">
          <button className="feed-section-header" onClick={() => toggleSection('calendar')}>
            <span>📅 היום</span>
            <span className="feed-section-count">{data.events.length}</span>
            <span className={`feed-section-arrow ${expandedSections.calendar ? 'expanded' : ''}`}>›</span>
          </button>
          {expandedSections.calendar && (
            <div className="feed-section-items">
              {data.events.map(event => {
                const area = event.category || 'work';
                const areaInfo = getAreaInfo(area);
                const past = isPast(event.end_time || event.start_time);
                return (
                  <div key={`evt-${event.id}`} className={`feed-item feed-item-event ${past ? 'feed-item-past' : ''}`}>
                    <div className="feed-event-time-col">
                      <span className="feed-event-time">{formatTime(event.start_time)}</span>
                      {event.end_time && <span className="feed-event-end">{formatTime(event.end_time)}</span>}
                    </div>
                    <div className="feed-event-bar" style={{ backgroundColor: areaInfo.color }} />
                    <div className="feed-item-content">
                      <span className="feed-item-text">{event.title}</span>
                      {event.location && <span className="feed-item-meta">📍 {event.location}</span>}
                    </div>
                    <div className="feed-item-area" style={{ backgroundColor: areaInfo.color + '18', color: areaInfo.color, borderColor: areaInfo.color + '40' }}>
                      {areaInfo.label}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          TASKS — Separate section
          ═══════════════════════════════════════════════ */}
      {data.tasks.length > 0 && (
        <div className="feed-section">
          <button className="feed-section-header" onClick={() => toggleSection('tasks')}>
            <span>📋 משימות</span>
            <span className="feed-section-count">{data.tasks.length}</span>
            <span className={`feed-section-arrow ${expandedSections.tasks ? 'expanded' : ''}`}>›</span>
          </button>
          {expandedSections.tasks && (
            <div className="feed-section-items">
              {data.tasks.map(task => {
                const areaInfo = getAreaInfo(task.area);
                const isCompleting = completingTasks.has(task.id);
                return (
                  <div key={`task-${task.id}`} className={`feed-item feed-item-task ${isCompleting ? 'feed-item-completing' : ''}`}>
                    <button className="feed-task-checkbox" onClick={() => completeTask(task.id)} disabled={isCompleting}>
                      {isCompleting ? '✓' : '○'}
                    </button>
                    <div className="feed-item-content">
                      <span className="feed-item-text">{task.text}</span>
                      {task.deadline && <span className="feed-item-meta">⏰ {new Date(task.deadline).toLocaleDateString('he-IL')}</span>}
                      {task.from_person && <span className="feed-item-meta">מ: {task.from_person}</span>}
                    </div>
                    <div className="feed-item-area" style={{ backgroundColor: areaInfo.color + '18', color: areaInfo.color, borderColor: areaInfo.color + '40' }}>
                      {areaInfo.label}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          PROJECTS — Separate section
          ═══════════════════════════════════════════════ */}
      {data.projects.length > 0 && (
        <div className="feed-section">
          <button className="feed-section-header" onClick={() => toggleSection('projects')}>
            <span>🚀 פרויקטים</span>
            <span className="feed-section-count">{data.projects.length}</span>
            <span className={`feed-section-arrow ${expandedSections.projects ? 'expanded' : ''}`}>›</span>
          </button>
          {expandedSections.projects && (
            <div className="feed-section-items">
              {data.projects.map(project => {
                const areaInfo = getAreaInfo(project.domain);
                return (
                  <div key={`proj-${project.id}`} className="feed-item feed-item-project">
                    <div className="feed-item-icon">🚀</div>
                    <div className="feed-item-content">
                      <span className="feed-item-text">{project.title}</span>
                      <span className={`feed-status-badge feed-status-${project.status}`}>{project.status === 'active' ? 'פעיל' : project.status === 'idea' ? 'רעיון' : project.status === 'frozen' ? 'מוקפא' : project.status}</span>
                      {project.notes && <span className="feed-item-meta">{project.notes}</span>}
                    </div>
                    <div className="feed-item-area" style={{ backgroundColor: areaInfo.color + '18', color: areaInfo.color, borderColor: areaInfo.color + '40' }}>
                      {areaInfo.label}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          DEPENDENCIES — Separate section
          ═══════════════════════════════════════════════ */}
      {data.dependencies.length > 0 && (
        <div className="feed-section">
          <button className="feed-section-header" onClick={() => toggleSection('dependencies')}>
            <span>⏳ תלויות</span>
            <span className="feed-section-count">{data.dependencies.length}</span>
            <span className={`feed-section-arrow ${expandedSections.dependencies ? 'expanded' : ''}`}>›</span>
          </button>
          {expandedSections.dependencies && (
            <div className="feed-section-items">
              {data.dependencies.map(dep => (
                <div key={`dep-${dep.id}`} className="feed-item feed-item-dependency">
                  <div className="feed-item-icon">⏳</div>
                  <div className="feed-item-content">
                    <span className="feed-item-text">{dep.waiting_for || 'ממתין'}</span>
                    <span className="feed-dep-direction">
                      {dep.direction === 'them' ? `← מחכה ל${dep.waiting_on}` : `→ אני חייב ל${dep.waiting_on}`}
                    </span>
                    <span className="feed-item-timestamp">{timeAgo(dep.created_at)}</span>
                  </div>
                  <div className="feed-item-area" style={{ backgroundColor: '#3b82f618', color: '#3b82f6', borderColor: '#3b82f640' }}>
                    XBO
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          GOALS — Separate section
          ═══════════════════════════════════════════════ */}
      {data.goals.length > 0 && (
        <div className="feed-section">
          <button className="feed-section-header" onClick={() => toggleSection('goals')}>
            <span>🎯 יעדים</span>
            <span className="feed-section-count">{data.goals.length}</span>
            <span className={`feed-section-arrow ${expandedSections.goals ? 'expanded' : ''}`}>›</span>
          </button>
          {expandedSections.goals && (
            <div className="feed-section-items">
              {data.goals.map(goal => {
                const areaInfo = getAreaInfo(goal.domain);
                return (
                  <div key={`goal-${goal.id}`} className="feed-item feed-item-goal">
                    <div className="feed-item-icon">🎯</div>
                    <div className="feed-item-content">
                      <span className="feed-item-text">{goal.title}</span>
                      {goal.metrics?.target && <span className="feed-item-meta">יעד: {goal.metrics.target}</span>}
                    </div>
                    <div className="feed-item-area" style={{ backgroundColor: areaInfo.color + '18', color: areaInfo.color, borderColor: areaInfo.color + '40' }}>
                      {areaInfo.label}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          MIKKA ACTIVITY — Collapsed by default
          ═══════════════════════════════════════════════ */}
      {data.ai_activity.length > 0 && (
        <div className="feed-section feed-section-muted">
          <button className="feed-section-header" onClick={() => toggleSection('ai_activity')}>
            <span>🤖 פעילות Mikka</span>
            <span className="feed-section-count">{data.ai_activity.length}</span>
            <span className={`feed-section-arrow ${expandedSections.ai_activity ? 'expanded' : ''}`}>›</span>
          </button>
          {expandedSections.ai_activity && (
            <div className="feed-section-items">
              {data.ai_activity.map(a => {
                const areaInfo = getAreaInfo(a.area);
                return (
                  <div key={`ai-${a.id}`} className="feed-item feed-item-ai">
                    <div className="feed-item-icon">🤖</div>
                    <div className="feed-item-content">
                      <span className="feed-item-text">{a.title}</span>
                      {a.description && <span className="feed-item-meta">{a.description}</span>}
                      {a.link && <a href={a.link} target="_blank" rel="noreferrer" className="feed-item-link">{a.link}</a>}
                      <span className="feed-item-timestamp">{timeAgo(a.timestamp)}</span>
                    </div>
                    <div className="feed-item-area" style={{ backgroundColor: areaInfo.color + '18', color: areaInfo.color, borderColor: areaInfo.color + '40' }}>
                      {areaInfo.label}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          שממה — Collapsed by default
          ═══════════════════════════════════════════════ */}
      {data.parking.length > 0 && (
        <div className="feed-section feed-section-muted">
          <button className="feed-section-header" onClick={() => toggleSection('parking')}>
            <span>🅿️ שממה</span>
            <span className="feed-section-count">{data.parking.length}</span>
            <span className={`feed-section-arrow ${expandedSections.parking ? 'expanded' : ''}`}>›</span>
          </button>
          {expandedSections.parking && (
            <div className="feed-section-items">
              {data.parking.map(p => {
                const areaInfo = getAreaInfo(p.domain);
                return (
                  <div key={`park-${p.id}`} className="feed-item feed-item-parking">
                    <div className="feed-item-icon">🅿️</div>
                    <div className="feed-item-content">
                      <span className="feed-item-text">{p.text}</span>
                      <span className="feed-item-timestamp">{timeAgo(p.created_at)}</span>
                    </div>
                    <div className="feed-item-area" style={{ backgroundColor: areaInfo.color + '18', color: areaInfo.color, borderColor: areaInfo.color + '40' }}>
                      {areaInfo.label}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default UnifiedFeed;

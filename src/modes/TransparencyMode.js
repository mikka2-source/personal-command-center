import React, { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import './TransparencyMode.css';

const TODAY = new Date().toISOString().split('T')[0];

function TransparencyMode() {
  const [brief, setBrief] = useState(null);
  const [health, setHealth] = useState([]);
  const [events, setEvents] = useState([]);
  const [habits, setHabits] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured()) { setLoading(false); return; }
    try {
      const startOfDay = `${TODAY}T00:00:00Z`;
      const endOfDay = `${TODAY}T23:59:59Z`;

      const [briefRes, healthRes, eventsRes, habitsRes, goalsRes] = await Promise.all([
        supabase.from('daily_briefs').select('*').eq('user_id', 'dan').eq('date', TODAY).single(),
        supabase.from('health_data').select('*').eq('user_id', 'dan').order('date', { ascending: false }).limit(7),
        supabase.from('events').select('*').gte('start_time', startOfDay).lte('start_time', endOfDay).eq('user_id', 'dan').order('start_time'),
        supabase.from('habits').select('*').eq('user_id', 'dan'),
        supabase.from('goals').select('*').eq('user_id', 'dan').eq('status', 'active'),
      ]);

      if (briefRes.data) setBrief(briefRes.data);
      if (healthRes.data) setHealth(healthRes.data);
      if (eventsRes.data) setEvents(eventsRes.data);
      if (habitsRes.data) setHabits(habitsRes.data);
      if (goalsRes.data) setGoals(goalsRes.data);
    } catch (err) {
      console.error('Transparency fetch error:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const todayHealth = health.find(h => h.date === TODAY);
  const meta = brief?.metadata || {};

  const sleepLabel = (trend) => {
    switch (trend) {
      case 'good': return { text: 'תקין', color: 'var(--green)', bg: 'var(--green-soft)' };
      case 'declining': return { text: 'ירידה', color: 'var(--amber)', bg: 'var(--amber-soft)' };
      case 'conservation': return { text: 'מצב שימור', color: 'var(--red)', bg: 'var(--red-soft)' };
      default: return { text: 'לא ידוע', color: 'var(--text-muted)', bg: 'var(--bg-muted)' };
    }
  };

  const sleep = sleepLabel(brief?.sleep_trend);

  // Detect missed habits
  const missedHabits = habits.filter(h => {
    if (!h.last_seen) return false;
    const daysSince = (Date.now() - new Date(h.last_seen)) / (1000 * 60 * 60 * 24);
    if (h.baseline_frequency === 'daily' && daysSince > 2) return true;
    if (h.baseline_frequency === '3x_week' && daysSince > 4) return true;
    if (h.baseline_frequency === 'weekly' && daysSince > 10) return true;
    return false;
  });

  if (loading) {
    return (
      <div className="brain">
        <div className="brain-loading">
          <div className="brain-pulse" />
          <span>טוען את המוח...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="brain">
      <div className="brain-container">
        <header className="brain-header">
          <h1>🧠 Show Me The Brain</h1>
          <p className="brain-sub">למה המערכת החליטה מה שהחליטה</p>
        </header>

        {/* Load Score Breakdown */}
        {brief && (
          <section className="brain-section">
            <h2 className="brain-section-title">עומס יומי — {brief.load_score}/100</h2>
            <div className="brain-load-bar">
              <div
                className="brain-load-fill"
                style={{
                  width: `${brief.load_score || 0}%`,
                  background: brief.load_score >= 70 ? 'var(--red)' : brief.load_score >= 45 ? 'var(--amber)' : 'var(--green)'
                }}
              />
            </div>
            <div className="brain-load-breakdown">
              <div className="brain-load-item">
                <span className="brain-load-label">📅 יומן</span>
                <span className="brain-load-detail">
                  {meta.calendar_hours?.toFixed(1) || 0}h • {meta.event_count || 0} אירועים
                </span>
              </div>
              <div className="brain-load-item">
                <span className="brain-load-label">💤 שינה</span>
                <span className="brain-load-detail" style={{ color: sleep.color }}>
                  {sleep.text} {meta.sleep_avg ? `• ממוצע ${meta.sleep_avg}h` : ''}
                  {meta.sleep_deficit > 0 ? ` • חסר ${meta.sleep_deficit}h` : ''}
                  {meta.sleep_confidence === 'low' && (
                    <span className="brain-confidence-inline"> · נתונים חלקיים</span>
                  )}
                </span>
              </div>
              <div className="brain-load-item">
                <span className="brain-load-label">⚡ אנרגיה</span>
                <span className="brain-load-detail">
                  תקציב: {meta.energy_budget || '—'} • נוצל: {meta.energy_used || 0}
                </span>
              </div>
            </div>
          </section>
        )}

        {/* AI Reasoning — Why these decisions */}
        {brief && (
          <section className="brain-section">
            <h2 className="brain-section-title">החלטות היום</h2>
            
            {brief.doing_today?.length > 0 && (
              <div className="brain-decision">
                <h3>✅ נבחרו לביצוע</h3>
                <ul>
                  {brief.doing_today.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {brief.not_doing_today?.length > 0 && (
              <div className="brain-decision">
                <h3>⛔ נדחו מהיום</h3>
                <ul className="brain-deferred">
                  {brief.not_doing_today.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
                <p className="brain-reason">
                  {brief.load_score >= 70
                    ? 'עומס גבוה — המערכת חתכה בכוונה.'
                    : meta.sleep_avg && meta.sleep_avg < 7
                    ? 'שינה ירודה — אנרגיה מוגבלת.'
                    : 'תעדוף לפי דדליינים ותלויות.'}
                </p>
              </div>
            )}

            {meta.all_warnings?.length > 0 && (
              <div className="brain-decision">
                <h3>⚠️ אותות</h3>
                <ul className="brain-warnings-list">
                  {meta.all_warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* Health Snapshot */}
        <section className="brain-section">
          <h2 className="brain-section-title">בריאות — היום</h2>
          {todayHealth ? (
            <div className="brain-health-grid">
              {todayHealth.sleep_hours && (
                <div className="brain-stat">
                  <span className="brain-stat-icon">💤</span>
                  <span className="brain-stat-value">{todayHealth.sleep_hours}h</span>
                  <span className="brain-stat-label">שינה</span>
                </div>
              )}
              {todayHealth.body_battery && (
                <div className="brain-stat">
                  <span className="brain-stat-icon">🔋</span>
                  <span className="brain-stat-value">{todayHealth.body_battery}</span>
                  <span className="brain-stat-label">Body Battery</span>
                </div>
              )}
              {todayHealth.stress_level && (
                <div className="brain-stat">
                  <span className="brain-stat-icon">😰</span>
                  <span className="brain-stat-value">{todayHealth.stress_level}</span>
                  <span className="brain-stat-label">לחץ</span>
                </div>
              )}
              {todayHealth.steps && (
                <div className="brain-stat">
                  <span className="brain-stat-icon">👟</span>
                  <span className="brain-stat-value">{todayHealth.steps.toLocaleString()}</span>
                  <span className="brain-stat-label">צעדים</span>
                </div>
              )}
              {todayHealth.resting_hr && (
                <div className="brain-stat">
                  <span className="brain-stat-icon">❤️</span>
                  <span className="brain-stat-value">{todayHealth.resting_hr}</span>
                  <span className="brain-stat-label">דופק מנוחה</span>
                </div>
              )}
            </div>
          ) : (
            <p className="brain-empty">אין נתוני בריאות להיום</p>
          )}
        </section>

        {/* Sleep Trend — 7 days */}
        {health.length > 0 && (() => {
          const sleepDaysWithData = health.filter(h => h.sleep_hours && parseFloat(h.sleep_hours) > 0).length;
          const isPartialSleep = sleepDaysWithData < 4;
          return (
            <section className="brain-section">
              <h2 className="brain-section-title">
                שינה — 7 ימים
                {isPartialSleep && (
                  <span className="brain-confidence-tag partial">נתונים חלקיים ({sleepDaysWithData}/7 ימים)</span>
                )}
              </h2>
              <div className="brain-sleep-chart">
                {health.slice().reverse().map(h => {
                  const hours = parseFloat(h.sleep_hours) || 0;
                  const pct = Math.min(100, (hours / 9) * 100);
                  const isLow = hours < 7;
                  return (
                    <div key={h.date} className="brain-sleep-col">
                      <span className="brain-sleep-value">{hours > 0 ? hours.toFixed(1) : '—'}</span>
                      <div className="brain-sleep-bar-bg">
                        <div
                          className={`brain-sleep-bar ${isLow ? 'low' : 'good'}`}
                          style={{ height: `${pct}%` }}
                        />
                      </div>
                      <span className="brain-sleep-date">{h.date?.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })()}

        {/* Goals Status */}
        {goals.length > 0 && (
          <section className="brain-section">
            <h2 className="brain-section-title">מטרות פעילות</h2>
            <div className="brain-goals">
              {goals.map(goal => {
                const confidence = goal.metrics?.confidence || meta.goal_confidence?.[goal.id] || 'unknown';
                const domain = goal.domain || 'personal';
                const domainLabels = { health: '🏃 בריאות', work: '💼 עבודה', personal: '🌱 אישי' };
                return (
                  <div key={goal.id} className="brain-goal">
                    <div className="brain-goal-header">
                      <span className="brain-goal-title">{goal.title}</span>
                      <span className={`brain-goal-confidence confidence-${confidence}`}>
                        {confidence === 'on_track' ? '✅ במסלול' :
                         confidence === 'behind' ? '⚠️ מאחור' :
                         confidence === 'ahead' ? '🚀 מקדים' :
                         '❓ לא ידוע'}
                      </span>
                    </div>
                    <div className="brain-goal-meta">
                      <span className="brain-goal-domain">{domainLabels[domain] || domain}</span>
                      {goal.priority && (
                        <span className="brain-goal-priority">עדיפות {goal.priority}/5</span>
                      )}
                    </div>
                    {goal.protection_rules && goal.protection_rules.length > 0 && (
                      <div className="brain-goal-rules">
                        {goal.protection_rules.map((rule, i) => (
                          <span key={i} className="brain-goal-rule">🛡️ {rule}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Missed Habits / Patterns */}
        {missedHabits.length > 0 && (
          <section className="brain-section">
            <h2 className="brain-section-title">הרגלים שנעלמו</h2>
            <div className="brain-habits">
              {missedHabits.map(h => {
                const days = Math.round((Date.now() - new Date(h.last_seen)) / (1000 * 60 * 60 * 24));
                return (
                  <div key={h.id} className="brain-habit">
                    <span className="brain-habit-name">{h.title}</span>
                    <span className="brain-habit-days">{days} ימים</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Today's Schedule */}
        {events.length > 0 && (
          <section className="brain-section">
            <h2 className="brain-section-title">לוח זמנים — היום</h2>
            <div className="brain-timeline">
              {events.map(e => {
                const time = e.start_time
                  ? new Date(e.start_time).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
                  : '';
                return (
                  <div key={e.id} className="brain-event">
                    <span className="brain-event-time">{time}</span>
                    <span className="brain-event-title">{e.title}</span>
                    {e.energy_level && (
                      <span className={`brain-tag energy-${e.energy_level}`}>{e.energy_level}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Active Projects Context */}
        {meta.active_projects?.length > 0 && (
          <section className="brain-section">
            <h2 className="brain-section-title">פרויקטים פעילים — {meta.active_projects.length}/3</h2>
            <div className="brain-projects">
              {meta.active_projects.map((p, i) => (
                <div key={i} className="brain-project">{p}</div>
              ))}
            </div>
            {meta.active_projects.length > 3 && (
              <p className="brain-over-limit">⚠️ חריגה מהמגבלה — הקפא פרויקט</p>
            )}
          </section>
        )}

        {/* Dependencies */}
        {meta.pending_dependencies?.length > 0 && (
          <section className="brain-section">
            <h2 className="brain-section-title">תלויות פתוחות</h2>
            <div className="brain-deps">
              {meta.pending_dependencies.map((d, i) => (
                <div key={i} className="brain-dep">
                  <span className="brain-dep-person">⏳ {d.person}</span>
                  <span className="brain-dep-for">{d.for}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default TransparencyMode;

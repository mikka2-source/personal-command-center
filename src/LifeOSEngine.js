import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import './LifeOSEngine.css';

const TODAY = new Date().toISOString().split('T')[0];

function LifeOSEngine() {
  const [brief, setBrief] = useState(null);
  const [events, setEvents] = useState([]);
  const [health, setHealth] = useState([]);
  const [projects, setProjects] = useState([]);
  const [dependencies, setDependencies] = useState([]);
  const [parking, setParking] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }

    const startOfDay = `${TODAY}T00:00:00Z`;
    const endOfDay = `${TODAY}T23:59:59Z`;

    const [briefRes, eventsRes, healthRes, projectsRes, depsRes, parkingRes] = await Promise.all([
      supabase.from('daily_briefs').select('*').eq('user_id', 'dan').eq('date', TODAY).single(),
      supabase.from('events').select('*').gte('start_time', startOfDay).lte('start_time', endOfDay).eq('user_id', 'dan').order('start_time'),
      supabase.from('health_data').select('*').eq('user_id', 'dan').order('date', { ascending: false }).limit(7),
      supabase.from('projects').select('*').eq('user_id', 'dan').order('status'),
      supabase.from('dependencies').select('*').eq('user_id', 'dan').eq('status', 'waiting'),
      supabase.from('parking').select('*').eq('user_id', 'dan').order('created_at', { ascending: false }).limit(20),
    ]);

    if (briefRes.data) setBrief(briefRes.data);
    if (eventsRes.data) setEvents(eventsRes.data);
    if (healthRes.data) setHealth(healthRes.data);
    if (projectsRes.data) setProjects(projectsRes.data);
    if (depsRes.data) setDependencies(depsRes.data);
    if (parkingRes.data) setParking(parkingRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'בוקר טוב';
    if (hour < 18) return 'צהריים טובים';
    return 'ערב טוב';
  };

  const formatTime = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  };

  const loadBar = (score) => {
    const filled = Math.round((score || 0) / 10);
    const empty = 10 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  };

  const sleepLabel = (trend) => {
    switch (trend) {
      case 'good': return { text: 'תקין', color: '#22c55e', icon: '✅' };
      case 'declining': return { text: 'ירידה', color: '#f59e0b', icon: '⚠️' };
      case 'conservation': return { text: 'מצב שימור', color: '#ef4444', icon: '🔴' };
      default: return { text: 'לא ידוע', color: '#64748b', icon: '❓' };
    }
  };

  const todayHealth = health.find(h => h.date === TODAY);
  const activeProjects = projects.filter(p => p.status === 'active');
  const sleep = sleepLabel(brief?.sleep_trend);

  if (loading) {
    return (
      <div className="engine-page">
        <div className="engine-loading">
          <div className="engine-spinner"></div>
          <p>Loading Decision Engine...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="engine-page">
      {/* Header */}
      <header className="engine-header">
        <div>
          <h1 className="engine-greeting">{getGreeting()}, דן</h1>
          <p className="engine-date">
            {new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="engine-load-badge">
          <span className="engine-load-number">{brief?.load_score || 0}</span>
          <span className="engine-load-label">עומס</span>
        </div>
      </header>

      {/* Brief Card */}
      {brief && (
        <section className="engine-card engine-brief">
          <h2>📋 תדריך יומי</h2>
          
          <div className="engine-brief-sections">
            {/* Doing */}
            {brief.doing_today?.length > 0 && (
              <div className="engine-brief-block">
                <h3>✅ עושים היום</h3>
                <ul>
                  {brief.doing_today.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Not doing */}
            {brief.not_doing_today?.length > 0 && (
              <div className="engine-brief-block">
                <h3>🚫 לא עושים היום</h3>
                <ul className="engine-deferred">
                  {brief.not_doing_today.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Warning */}
          {brief.warning && (
            <div className="engine-warning">
              ⚠️ {brief.warning}
            </div>
          )}

          {/* Small action */}
          {brief.small_action && (
            <div className="engine-action">
              ✨ {brief.small_action}
            </div>
          )}

          {/* Load bar */}
          <div className="engine-meters">
            <div className="engine-meter">
              <span className="engine-meter-label">עומס</span>
              <span className="engine-meter-bar">{loadBar(brief.load_score)}</span>
              <span className="engine-meter-value">{brief.load_score}/100</span>
            </div>
            <div className="engine-meter">
              <span className="engine-meter-label">שינה</span>
              <span className="engine-meter-status" style={{ color: sleep.color }}>
                {sleep.icon} {sleep.text}
              </span>
            </div>
          </div>
        </section>
      )}

      <div className="engine-grid">
        {/* Today's Events */}
        <section className="engine-card">
          <h2>📅 אירועים היום</h2>
          {events.length === 0 ? (
            <p className="engine-empty">אין אירועים</p>
          ) : (
            <div className="engine-events">
              {events.map(e => (
                <div key={e.id} className={`engine-event ${e.immutable ? 'immutable' : ''}`}>
                  <span className="engine-event-time">{formatTime(e.start_time)}</span>
                  <span className="engine-event-title">{e.title}</span>
                  <div className="engine-event-tags">
                    <span className={`engine-tag cat-${e.category}`}>{e.category}</span>
                    <span className={`engine-tag energy-${e.energy_level}`}>{e.energy_level}</span>
                    {e.immutable && <span className="engine-tag locked">🔒</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Health Snapshot */}
        <section className="engine-card">
          <h2>💚 בריאות</h2>
          {todayHealth ? (
            <div className="engine-health">
              {todayHealth.sleep_hours && (
                <div className="engine-health-stat">
                  <span className="engine-health-icon">💤</span>
                  <span className="engine-health-value">{todayHealth.sleep_hours}h</span>
                  <span className="engine-health-label">שינה</span>
                </div>
              )}
              {todayHealth.body_battery && (
                <div className="engine-health-stat">
                  <span className="engine-health-icon">🔋</span>
                  <span className="engine-health-value">{todayHealth.body_battery}</span>
                  <span className="engine-health-label">Body Battery</span>
                </div>
              )}
              {todayHealth.stress_level && (
                <div className="engine-health-stat">
                  <span className="engine-health-icon">😰</span>
                  <span className="engine-health-value">{todayHealth.stress_level}</span>
                  <span className="engine-health-label">לחץ</span>
                </div>
              )}
              {todayHealth.steps && (
                <div className="engine-health-stat">
                  <span className="engine-health-icon">👟</span>
                  <span className="engine-health-value">{todayHealth.steps.toLocaleString()}</span>
                  <span className="engine-health-label">צעדים</span>
                </div>
              )}
              {todayHealth.resting_hr && (
                <div className="engine-health-stat">
                  <span className="engine-health-icon">❤️</span>
                  <span className="engine-health-value">{todayHealth.resting_hr}</span>
                  <span className="engine-health-label">דופק מנוחה</span>
                </div>
              )}
              {todayHealth.workout_type && (
                <div className="engine-health-stat">
                  <span className="engine-health-icon">🏋️</span>
                  <span className="engine-health-value">{todayHealth.workout_type}</span>
                  <span className="engine-health-label">{todayHealth.workout_duration}min</span>
                </div>
              )}
            </div>
          ) : (
            <p className="engine-empty">אין נתוני בריאות להיום</p>
          )}

          {/* Sleep trend mini chart */}
          {health.length > 0 && (
            <div className="engine-sleep-trend">
              <h4>שינה — 7 ימים</h4>
              <div className="engine-sleep-bars">
                {health.slice().reverse().map(h => (
                  <div key={h.date} className="engine-sleep-bar-wrap">
                    <div 
                      className={`engine-sleep-bar ${(parseFloat(h.sleep_hours) || 0) < 7 ? 'low' : 'good'}`}
                      style={{ height: `${Math.min(100, ((parseFloat(h.sleep_hours) || 0) / 9) * 100)}%` }}
                    >
                      <span>{h.sleep_hours ? parseFloat(h.sleep_hours).toFixed(1) : '-'}</span>
                    </div>
                    <span className="engine-sleep-date">{h.date?.slice(5)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Active Projects */}
        <section className="engine-card">
          <h2>🚀 פרויקטים</h2>
          <div className="engine-project-counter">
            <span className={`engine-project-count ${activeProjects.length > 3 ? 'over' : ''}`}>
              {activeProjects.length}/3
            </span>
            <span className="engine-project-label">פעילים</span>
            {activeProjects.length > 3 && (
              <span className="engine-project-warning">⚠️ חריגה!</span>
            )}
          </div>
          {projects.length === 0 ? (
            <p className="engine-empty">אין פרויקטים</p>
          ) : (
            <div className="engine-projects">
              {projects.map(p => (
                <div key={p.id} className={`engine-project status-${p.status}`}>
                  <div className="engine-project-header">
                    <span className="engine-project-title">{p.title}</span>
                    <span className={`engine-tag status-${p.status}`}>{p.status}</span>
                  </div>
                  <span className="engine-project-domain">{p.domain}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Dependencies */}
        <section className="engine-card">
          <h2>🔗 תלויות</h2>
          {dependencies.length === 0 ? (
            <p className="engine-empty">אין תלויות פתוחות</p>
          ) : (
            <div className="engine-deps">
              {dependencies.map(d => {
                const days = Math.round((Date.now() - new Date(d.created_at)) / (1000*60*60*24));
                return (
                  <div key={d.id} className={`engine-dep ${days > 5 ? 'stale' : ''}`}>
                    <span className="engine-dep-dir">{d.direction === 'them' ? '⏳' : '📤'}</span>
                    <div className="engine-dep-info">
                      <span className="engine-dep-person">{d.waiting_on}</span>
                      <span className="engine-dep-desc">{d.waiting_for}</span>
                    </div>
                    <span className="engine-dep-days">{days}d</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Parking / שממה */}
        <section className="engine-card engine-parking">
          <h2>🏜️ שממה</h2>
          <p className="engine-parking-sub">רעיונות, אולי, סתם רעש</p>
          {parking.length === 0 ? (
            <p className="engine-empty">ריק</p>
          ) : (
            <div className="engine-parking-list">
              {parking.map(p => (
                <div key={p.id} className="engine-parking-item">
                  <span>{p.text}</span>
                  {p.domain && <span className="engine-tag">{p.domain}</span>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default LifeOSEngine;

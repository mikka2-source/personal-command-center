import React, { useState, useEffect, useCallback } from 'react';
import './LifeDashboard.css';
import ActivityFeed from './ActivityFeed';
import DailyBrief from './DailyBrief';
import * as mikka from './mikkaApi';
import * as db from './persistence';

function LifeDashboard({ onNavigate }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lifeAreas, setLifeAreas] = useState([]);
  const [activities, setActivities] = useState([]);
  const [insights, setInsights] = useState([]);
  const [morningRoutine, setMorningRoutine] = useState({
    supplements: false, workout: false, protein: false, meditation: false
  });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [areas, acts, ins, routine] = await Promise.all([
      mikka.loadLifeAreas(),
      mikka.loadActivities(20),
      mikka.loadInsights(5),
      db.loadMorningRoutine()
    ]);
    setLifeAreas(areas);
    setActivities(acts);
    setInsights(ins);
    if (routine) setMorningRoutine(routine);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'בוקר טוב';
    if (hour < 18) return 'צהריים טובים';
    return 'ערב טוב';
  };

  const formatDate = () => {
    return currentTime.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const formatTime = () => {
    return currentTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'good': return '#22c55e';
      case 'attention': return '#f59e0b';
      case 'urgent': return '#ef4444';
      default: return '#64748b';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'good': return 'Good';
      case 'attention': return 'Needs Attention';
      case 'urgent': return 'Urgent';
      default: return 'Normal';
    }
  };

  // Calculate life pulse
  const getLifePulse = () => {
    if (lifeAreas.length === 0) return { score: 0, label: 'Loading...' };
    const scores = { good: 3, normal: 2, attention: 1, urgent: 0 };
    const total = lifeAreas.reduce((acc, a) => acc + (scores[a.status] || 2), 0);
    const max = lifeAreas.length * 3;
    const pct = Math.round((total / max) * 100);
    if (pct >= 80) return { score: pct, label: 'Excellent', color: '#22c55e' };
    if (pct >= 60) return { score: pct, label: 'Good', color: '#3b82f6' };
    if (pct >= 40) return { score: pct, label: 'Needs Attention', color: '#f59e0b' };
    return { score: pct, label: 'Critical', color: '#ef4444' };
  };

  const routineItems = [
    { key: 'supplements', label: 'תוספים', icon: '💊' },
    { key: 'workout', label: 'אימון', icon: '💪' },
    { key: 'protein', label: 'חלבון', icon: '🥤' },
    { key: 'meditation', label: 'מדיטציה', icon: '🧘' }
  ];

  const toggleRoutine = async (key) => {
    const updated = { ...morningRoutine, [key]: !morningRoutine[key] };
    setMorningRoutine(updated);
    await db.saveMorningRoutine(updated);
  };

  const routineCompleted = Object.values(morningRoutine).filter(Boolean).length;
  const pulse = getLifePulse();

  if (loading) {
    return (
      <div className="life-dashboard">
        <div className="ld-loading">
          <div className="ld-loading-spinner"></div>
          <p>Loading your Life OS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="life-dashboard">
      {/* Header */}
      <header className="ld-header">
        <div className="ld-header-left">
          <h1 className="ld-greeting">{getGreeting()}, דן</h1>
          <p className="ld-date">{formatDate()} • {formatTime()}</p>
        </div>
        <div className="ld-header-right">
          <div className="ld-pulse" style={{ '--pulse-color': pulse.color }}>
            <div className="ld-pulse-ring"></div>
            <div className="ld-pulse-score">{pulse.score}</div>
            <div className="ld-pulse-label">{pulse.label}</div>
          </div>
        </div>
      </header>

      {/* Insights Bar */}
      {insights.length > 0 && (
        <div className="ld-insights-bar">
          {insights.slice(0, 3).map(insight => (
            <div key={insight.id} className={`ld-insight ld-insight-${insight.priority}`}>
              <span className="ld-insight-icon">
                {insight.type === 'alert' ? '⚠️' : insight.type === 'reminder' ? '🔔' : '💡'}
              </span>
              <span className="ld-insight-text">{insight.title}</span>
              <button 
                className="ld-insight-dismiss"
                onClick={() => {
                  mikka.dismissInsight(insight.id);
                  setInsights(prev => prev.filter(i => i.id !== insight.id));
                }}
              >✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="ld-content">
        {/* Left: Daily Brief + Life Areas + Morning Routine */}
        <div className="ld-main">
          {/* Daily Brief from Decision Engine */}
          <DailyBrief />

          {/* Life Areas Grid */}
          <section className="ld-section">
            <div className="ld-section-header">
              <h2>Life Areas</h2>
              <span className="ld-section-count">{lifeAreas.length} areas</span>
            </div>
            <div className="ld-areas-grid">
              {lifeAreas.map((area, idx) => (
                <div
                  key={area.id}
                  className="ld-area-card"
                  style={{ 
                    '--area-color': area.color,
                    animationDelay: `${idx * 0.05}s`
                  }}
                >
                  <div className="ld-area-top">
                    <span className="ld-area-icon">{area.icon}</span>
                    <div className="ld-area-status" style={{ background: getStatusColor(area.status) }}>
                      {getStatusLabel(area.status)}
                    </div>
                  </div>
                  <div className="ld-area-name">{area.name}</div>
                  {area.last_activity && (
                    <div className="ld-area-activity">
                      Last: {new Date(area.last_activity).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  )}
                  <div className="ld-area-bar" style={{ background: area.color }}></div>
                </div>
              ))}
            </div>
          </section>

          {/* Morning Routine */}
          <section className="ld-section">
            <div className="ld-section-header">
              <h2>🌅 שגרת בוקר</h2>
              <span className="ld-section-count">
                {routineCompleted === 4 ? '✅ הושלם' : `${routineCompleted}/4`}
              </span>
            </div>
            <div className="ld-routine-grid">
              {routineItems.map(item => (
                <button
                  key={item.key}
                  className={`ld-routine-item ${morningRoutine[item.key] ? 'done' : ''}`}
                  onClick={() => toggleRoutine(item.key)}
                >
                  <span className="ld-routine-icon">{item.icon}</span>
                  <span className="ld-routine-label">{item.label}</span>
                  {morningRoutine[item.key] && <span className="ld-routine-check">✓</span>}
                </button>
              ))}
            </div>
          </section>

          {/* Quick Actions */}
          <section className="ld-section">
            <div className="ld-section-header">
              <h2>Quick Actions</h2>
            </div>
            <div className="ld-quick-actions">
              <button className="ld-action-btn" onClick={() => onNavigate('tasks')}>
                <span>📋</span> Tasks
              </button>
              <button className="ld-action-btn" onClick={() => onNavigate('mikka')}>
                <span>🤖</span> Mikka Feed
              </button>
              <button className="ld-action-btn" onClick={() => onNavigate('people')}>
                <span>👥</span> People
              </button>
            </div>
          </section>
        </div>

        {/* Right: Activity Feed */}
        <aside className="ld-feed">
          <div className="ld-section-header">
            <h2>🤖 Recent Activity</h2>
            <button className="ld-see-all" onClick={() => onNavigate('mikka')}>See all →</button>
          </div>
          <ActivityFeed activities={activities} compact />
        </aside>
      </div>
    </div>
  );
}

export default LifeDashboard;

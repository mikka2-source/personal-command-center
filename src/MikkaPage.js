import React, { useState, useEffect } from 'react';
import './MikkaPage.css';
import ActivityFeed from './ActivityFeed';
import * as mikka from './mikkaApi';

function MikkaPage() {
  const [activities, setActivities] = useState([]);
  const [insights, setInsights] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [acts, ins] = await Promise.all([
        mikka.loadActivities(50),
        mikka.loadInsights(20)
      ]);
      setActivities(acts);
      setInsights(ins);
      setLoading(false);
    };
    load();
  }, []);

  const filteredActivities = filter === 'all' 
    ? activities 
    : activities.filter(a => a.type === filter);

  const handleMarkRead = async (id) => {
    await mikka.markActivityRead(id);
    setActivities(prev => prev.map(a => a.id === id ? { ...a, read: true } : a));
  };

  const handleDismissInsight = async (id) => {
    await mikka.dismissInsight(id);
    setInsights(prev => prev.filter(i => i.id !== id));
  };

  const filters = [
    { key: 'all', label: 'All', icon: '📋' },
    { key: 'deploy', label: 'Deploys', icon: '🚀' },
    { key: 'task', label: 'Tasks', icon: '✅' },
    { key: 'research', label: 'Research', icon: '🔍' },
    { key: 'conversation', label: 'Conversations', icon: '💬' },
  ];

  if (loading) {
    return (
      <div className="mikka-page">
        <div className="mp-loading">Loading Mikka activity...</div>
      </div>
    );
  }

  return (
    <div className="mikka-page">
      <header className="mp-header">
        <div>
          <h1>🤖 Mikka</h1>
          <p className="mp-subtitle">AI Activity Feed & Insights</p>
        </div>
        <div className="mp-stats">
          <div className="mp-stat">
            <span className="mp-stat-num">{activities.length}</span>
            <span className="mp-stat-label">Activities</span>
          </div>
          <div className="mp-stat">
            <span className="mp-stat-num">{activities.filter(a => !a.read).length}</span>
            <span className="mp-stat-label">Unread</span>
          </div>
          <div className="mp-stat">
            <span className="mp-stat-num">{insights.length}</span>
            <span className="mp-stat-label">Insights</span>
          </div>
        </div>
      </header>

      {/* Active Insights */}
      {insights.length > 0 && (
        <section className="mp-insights">
          <h3>💡 Active Insights</h3>
          <div className="mp-insights-list">
            {insights.map(insight => (
              <div key={insight.id} className={`mp-insight-card mp-priority-${insight.priority}`}>
                <div className="mp-insight-header">
                  <span className="mp-insight-type">
                    {insight.type === 'alert' ? '⚠️' : insight.type === 'reminder' ? '🔔' : insight.type === 'suggestion' ? '💭' : '💡'}
                    {insight.type}
                  </span>
                  {insight.area && <span className="mp-insight-area">{insight.area}</span>}
                  <button className="mp-insight-close" onClick={() => handleDismissInsight(insight.id)}>✕</button>
                </div>
                <h4>{insight.title}</h4>
                {insight.description && <p>{insight.description}</p>}
                {insight.action_url && (
                  <a href={insight.action_url} target="_blank" rel="noreferrer" className="mp-insight-action">
                    Open →
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Filters */}
      <div className="mp-filters">
        {filters.map(f => (
          <button
            key={f.key}
            className={`mp-filter ${filter === f.key ? 'active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            <span>{f.icon}</span> {f.label}
            {f.key !== 'all' && (
              <span className="mp-filter-count">
                {activities.filter(a => a.type === f.key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Activity Feed */}
      <div className="mp-feed">
        <ActivityFeed 
          activities={filteredActivities}
          onMarkRead={handleMarkRead}
        />
      </div>
    </div>
  );
}

export default MikkaPage;

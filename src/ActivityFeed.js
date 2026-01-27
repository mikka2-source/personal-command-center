import React from 'react';
import './ActivityFeed.css';

const TYPE_CONFIG = {
  task: { icon: '✅', label: 'Task' },
  deploy: { icon: '🚀', label: 'Deploy' },
  research: { icon: '🔍', label: 'Research' },
  conversation: { icon: '💬', label: 'Conversation' },
  insight: { icon: '💡', label: 'Insight' },
  alert: { icon: '⚠️', label: 'Alert' },
};

const AREA_COLORS = {
  work: '#3b82f6',
  realestate: '#10b981',
  family: '#f59e0b',
  health: '#22c55e',
  salon: '#ec4899',
  fluidity: '#8b5cf6',
  development: '#06b6d4',
  investments: '#f97316',
  personal: '#94a3b8',
};

function formatTimeAgo(timestamp) {
  const now = new Date();
  const then = new Date(timestamp);
  const diff = Math.floor((now - then) / 1000);
  
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ActivityFeed({ activities, compact = false, onMarkRead }) {
  if (!activities || activities.length === 0) {
    return (
      <div className="af-empty">
        <div className="af-empty-icon">🤖</div>
        <p>No activity yet</p>
        <span>Mikka will log activities here</span>
      </div>
    );
  }

  return (
    <div className={`activity-feed ${compact ? 'af-compact' : ''}`}>
      {activities.map((activity, idx) => {
        const config = TYPE_CONFIG[activity.type] || TYPE_CONFIG.task;
        const areaColor = AREA_COLORS[activity.area] || AREA_COLORS.personal;
        
        return (
          <div
            key={activity.id}
            className={`af-item ${activity.read ? 'af-read' : 'af-unread'}`}
            style={{ animationDelay: `${idx * 0.05}s`, '--area-color': areaColor }}
            onClick={() => {
              if (activity.link) {
                window.open(activity.link, '_blank');
              }
              if (onMarkRead && !activity.read) {
                onMarkRead(activity.id);
              }
            }}
          >
            <div className="af-timeline">
              <div className="af-dot" style={{ background: areaColor }}></div>
              {idx < activities.length - 1 && <div className="af-line"></div>}
            </div>
            
            <div className="af-content">
              <div className="af-header">
                <span className="af-type-icon">{config.icon}</span>
                <span className="af-type-label" style={{ color: areaColor }}>
                  {config.label}
                </span>
                <span className="af-time">{formatTimeAgo(activity.timestamp)}</span>
              </div>
              
              <h4 className="af-title">{activity.title}</h4>
              
              {!compact && activity.description && (
                <p className="af-description">{activity.description}</p>
              )}
              
              {activity.link && (
                <div className="af-link">
                  <span>🔗</span> {new URL(activity.link).hostname}
                </div>
              )}
              
              <div className="af-area-tag" style={{ 
                background: `${areaColor}15`,
                color: areaColor,
                borderColor: `${areaColor}30`
              }}>
                {activity.area}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ActivityFeed;

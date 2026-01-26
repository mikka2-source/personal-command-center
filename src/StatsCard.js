import React from 'react';
import './StatsCard.css';

function StatsCard({ tasks }) {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(task => task.completed).length;
  const remainingTasks = totalTasks - completedTasks;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="stats-card">
      <h2>📊 Task Statistics</h2>
      <div className="stats-grid">
        <div className="stat-item">
          <div className="stat-value">{totalTasks}</div>
          <div className="stat-label">Total</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{completedTasks}</div>
          <div className="stat-label">Done</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{remainingTasks}</div>
          <div className="stat-label">Left</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{completionRate}%</div>
          <div className="stat-label">Rate</div>
        </div>
      </div>
    </div>
  );
}

export default StatsCard;

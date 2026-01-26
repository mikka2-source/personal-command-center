import React from 'react';
import './QuickStats.css';

function QuickStats() {
  const stats = [
    { label: 'TOTAL INVESTED', value: '$600,000' },
    { label: 'CURRENT VALUE', value: '$847,340' },
    { label: 'TOTAL GAIN', value: '+41.2%', positive: true }
  ];

  return (
    <div className="quick-stats">
      <h2>Quick Stats</h2>
      <div className="quick-stats-grid">
        {stats.map((stat, index) => (
          <div key={index} className="quick-stat-item">
            <div className="quick-stat-label">{stat.label}</div>
            <div className={`quick-stat-value ${stat.positive ? 'positive' : ''}`}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default QuickStats;

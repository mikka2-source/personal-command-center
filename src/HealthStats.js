import React from 'react';
import './HealthStats.css';

function HealthStats() {
  const stats = [
    { icon: '😴', label: 'SLEEP SCORE', value: '82' },
    { icon: '⚡', label: 'BODY BATTERY', value: '68' },
    { icon: '⚖️', label: 'WEIGHT', value: '78.5kg' }
  ];

  const stepsData = {
    current: 4235,
    goal: 10000,
    percentage: 42.35
  };

  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (stepsData.percentage / 100) * circumference;

  return (
    <div className="health-stats">
      <h2>💪 Health Snapshot</h2>
      <div className="health-grid">
        {stats.map((stat, index) => (
          <div key={index} className="health-value">
            <div className="health-icon">{stat.icon}</div>
            <div className="health-number">{stat.value}</div>
            <div className="health-label">{stat.label}</div>
          </div>
        ))}
        <div className="health-value steps-container">
          <div className="steps-progress-container">
            <svg className="steps-progress-svg" width="120" height="120">
              <circle
                className="steps-progress-ring-background"
                cx="60"
                cy="60"
                r="45"
              />
              <circle
                className="steps-progress-ring"
                cx="60"
                cy="60"
                r="45"
                style={{
                  strokeDasharray: `${circumference} ${circumference}`,
                  strokeDashoffset: strokeDashoffset
                }}
              />
            </svg>
            <div className="steps-progress-content">
              <div className="health-icon">👟</div>
              <div className="health-number">{stepsData.current.toLocaleString()}</div>
              <div className="steps-goal">of {stepsData.goal.toLocaleString()}</div>
            </div>
          </div>
          <div className="health-label">STEPS</div>
        </div>
      </div>
    </div>
  );
}

export default HealthStats;

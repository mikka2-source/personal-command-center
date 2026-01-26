import React from 'react';
import './StreakCounter.css';

function StreakCounter() {
  const currentStreak = 5;
  const targetStreak = 30;
  const percentage = (currentStreak / targetStreak) * 100;
  const circumference = 2 * Math.PI * 60;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="streak-counter">
      <h2>🔥 Streak</h2>
      <div className="streak-content">
        <div className="streak-circle-container">
          <svg className="streak-circle-svg" width="150" height="150">
            <circle
              className="streak-circle-bg"
              cx="75"
              cy="75"
              r="60"
            />
            <circle
              className="streak-circle-progress"
              cx="75"
              cy="75"
              r="60"
              style={{
                strokeDasharray: `${circumference} ${circumference}`,
                strokeDashoffset: strokeDashoffset
              }}
            />
          </svg>
          <div className="streak-number">
            <div className="current-streak">{currentStreak}</div>
            <div className="streak-label">DAYS</div>
          </div>
        </div>
        <div className="streak-info">
          <div className="streak-target">Target: {targetStreak} days</div>
          <div className="streak-percentage">{Math.round(percentage)}% COMPLETE</div>
        </div>
      </div>
    </div>
  );
}

export default StreakCounter;

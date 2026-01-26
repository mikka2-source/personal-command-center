import React from 'react';
import './GoalsCard.css';

function GoalsCard() {
  const goals = [
    { icon: '👟', label: 'STEPS', current: 4235, target: 10000, unit: '' },
    { icon: '⏰', label: 'SLEEP', current: 7.4, target: 8, unit: 'h' },
    { icon: '💪', label: 'WORKOUT', current: 0, target: 1, unit: '' }
  ];

  const getPercentage = (current, target) => {
    return Math.min(Math.round((current / target) * 100), 100);
  };

  const getColor = (percentage) => {
    if (percentage >= 80) return '#10b981';
    if (percentage >= 40) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="goals-card">
      <h2>🎯 Daily Goals</h2>
      <div className="goals-list">
        {goals.map((goal, index) => {
          const percentage = getPercentage(goal.current, goal.target);
          const color = getColor(percentage);
          return (
            <div key={index} className="goal-item">
              <div className="goal-header">
                <div className="goal-info">
                  <span className="goal-icon">{goal.icon}</span>
                  <span className="goal-label">{goal.label}</span>
                </div>
                <div className="goal-percentage" style={{ color }}>
                  {percentage}%
                </div>
              </div>
              <div className="goal-progress-bar">
                <div
                  className="goal-progress-fill"
                  style={{ width: `${percentage}%`, backgroundColor: color }}
                />
              </div>
              <div className="goal-stats">
                {goal.current}{goal.unit} / {goal.target}{goal.unit}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default GoalsCard;

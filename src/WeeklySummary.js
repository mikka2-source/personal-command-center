import React from 'react';
import './WeeklySummary.css';

function WeeklySummary() {
  const weeklyData = {
    steps: [8200, 9500, 7800, 10200, 8800, 9200, 8500],
    sleepScores: [78, 82, 80, 85, 79, 83, 81],
    bodyBattery: [65, 70, 68, 72, 66, 71, 69]
  };

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const avgSteps = Math.round(weeklyData.steps.reduce((a, b) => a + b) / weeklyData.steps.length);
  const avgSleep = Math.round(weeklyData.sleepScores.reduce((a, b) => a + b) / weeklyData.sleepScores.length);
  const avgBodyBattery = Math.round(weeklyData.bodyBattery.reduce((a, b) => a + b) / weeklyData.bodyBattery.length);

  const maxSteps = Math.max(...weeklyData.steps);
  const maxSleep = Math.max(...weeklyData.sleepScores);
  const maxBodyBattery = Math.max(...weeklyData.bodyBattery);

  return (
    <div className="weekly-summary">
      <h2>📊 Weekly Summary</h2>
      <div className="weekly-stats">
        <div className="weekly-stat-item">
          <div className="weekly-stat-label">AVG STEPS</div>
          <div className="weekly-stat-value">{avgSteps.toLocaleString()}</div>
        </div>
        <div className="weekly-stat-item">
          <div className="weekly-stat-label">AVG SLEEP</div>
          <div className="weekly-stat-value">{avgSleep}</div>
        </div>
        <div className="weekly-stat-item">
          <div className="weekly-stat-label">AVG BODY BATTERY</div>
          <div className="weekly-stat-value">{avgBodyBattery}</div>
        </div>
      </div>
      <div className="weekly-charts">
        <div className="chart-section">
          <div className="chart-label">STEPS</div>
          <div className="chart-bars">
            {weeklyData.steps.map((value, index) => (
              <div key={index} className="chart-bar-wrapper">
                <div
                  className="chart-bar"
                  style={{ height: `${(value / maxSteps) * 100}%` }}
                />
                <div className="chart-day">{days[index]}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="chart-section">
          <div className="chart-label">SLEEP SCORE</div>
          <div className="chart-bars">
            {weeklyData.sleepScores.map((value, index) => (
              <div key={index} className="chart-bar-wrapper">
                <div
                  className="chart-bar"
                  style={{ height: `${(value / maxSleep) * 100}%` }}
                />
                <div className="chart-day">{days[index]}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="chart-section">
          <div className="chart-label">BODY BATTERY</div>
          <div className="chart-bars">
            {weeklyData.bodyBattery.map((value, index) => (
              <div key={index} className="chart-bar-wrapper">
                <div
                  className="chart-bar"
                  style={{ height: `${(value / maxBodyBattery) * 100}%` }}
                />
                <div className="chart-day">{days[index]}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default WeeklySummary;

import React from 'react';
import './DailyFocus.css';

function DailyFocus({ focus, onComplete, onSetFocus, areas }) {
  const getArea = (areaId) => areas.find(a => a.id === areaId) || areas[0];

  if (!focus) {
    return (
      <div className="daily-focus card empty">
        <div className="focus-prompt">
          <div className="focus-icon">🎯</div>
          <h2>מה הדבר הכי חשוב להיום?</h2>
          <p>בחר משימה אחת שחייבת לקרות היום</p>
          <button onClick={onSetFocus} className="set-focus-btn">
            הגדר Focus
          </button>
        </div>
      </div>
    );
  }

  const area = getArea(focus.area);

  return (
    <div className={`daily-focus card ${focus.completed ? 'completed' : ''}`}>
      <div className="card-header">
        <h3 className="card-title">🎯 Focus של היום</h3>
        <span className="area-badge" style={{ color: area.color }}>
          {area.icon} {area.name}
        </span>
      </div>
      
      <div className="focus-content">
        <div className="focus-task" onClick={onComplete}>
          <div className={`focus-checkbox ${focus.completed ? 'checked' : ''}`}>
            {focus.completed && '✓'}
          </div>
          <span className={`focus-text ${focus.completed ? 'done' : ''}`}>
            {focus.text}
          </span>
        </div>
        
        {focus.completed && (
          <div className="focus-completed-message">
            🎉 כל הכבוד! סיימת את המשימה העיקרית של היום
          </div>
        )}
      </div>
    </div>
  );
}

export default DailyFocus;

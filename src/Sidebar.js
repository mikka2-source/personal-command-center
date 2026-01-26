import React from 'react';
import './Sidebar.css';

function Sidebar({ 
  morningRoutine, 
  setMorningRoutine, 
  meetings, 
  waitingFor, 
  activeProjects,
  areas 
}) {
  const getArea = (areaId) => areas.find(a => a.id === areaId) || areas[0];

  const toggleRoutine = (key) => {
    setMorningRoutine(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const routineItems = [
    { key: 'supplements', label: 'תוספים', icon: '💊' },
    { key: 'workout', label: 'אימון', icon: '💪' },
    { key: 'protein', label: 'חלבון', icon: '🥤' },
    { key: 'meditation', label: 'מדיטציה', icon: '🧘' }
  ];

  const completedCount = Object.values(morningRoutine).filter(Boolean).length;

  return (
    <aside className="sidebar">
      {/* Morning Routine */}
      <div className="sidebar-card">
        <div className="sidebar-header">
          <h3>🌅 שגרת בוקר</h3>
          <span className="routine-progress">{completedCount}/4</span>
        </div>
        <div className="routine-grid">
          {routineItems.map(item => (
            <button
              key={item.key}
              className={`routine-item ${morningRoutine[item.key] ? 'done' : ''}`}
              onClick={() => toggleRoutine(item.key)}
            >
              <span className="routine-icon">{item.icon}</span>
              <span className="routine-label">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Today's Meetings */}
      <div className="sidebar-card">
        <div className="sidebar-header">
          <h3>📅 פגישות היום</h3>
        </div>
        {meetings.length === 0 ? (
          <div className="sidebar-empty">
            <p>אין פגישות היום</p>
            <button className="connect-btn">חבר יומן</button>
          </div>
        ) : (
          <div className="meetings-list">
            {meetings.map(meeting => (
              <div key={meeting.id} className="meeting-item">
                <div className="meeting-time">{meeting.time}</div>
                <div className="meeting-info">
                  <div className="meeting-title">{meeting.title}</div>
                  {meeting.with && (
                    <div className="meeting-with">עם {meeting.with}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Waiting For */}
      <div className="sidebar-card">
        <div className="sidebar-header">
          <h3>⏳ מחכה לאחרים</h3>
          <span className="count-badge">{waitingFor.length}</span>
        </div>
        {waitingFor.length === 0 ? (
          <div className="sidebar-empty">
            <p>לא מחכה לכלום</p>
          </div>
        ) : (
          <div className="waiting-list">
            {waitingFor.map(item => (
              <div key={item.id} className="waiting-item">
                <div className="waiting-text">{item.text}</div>
                <div className="waiting-meta">
                  <span className="waiting-person">{item.person}</span>
                  <span className="waiting-days">{item.days} ימים</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Projects */}
      <div className="sidebar-card">
        <div className="sidebar-header">
          <h3>📁 פרויקטים פעילים</h3>
        </div>
        <div className="projects-list">
          {activeProjects.map(project => {
            const area = getArea(project.area);
            return (
              <div key={project.id} className="project-item">
                <div className="project-name">
                  <span className="project-area-icon">{area.icon}</span>
                  {project.name}
                </div>
                {project.nextStep && (
                  <div className="project-next">→ {project.nextStep}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;

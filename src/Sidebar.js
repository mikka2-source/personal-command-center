import React, { useState } from 'react';
import './Sidebar.css';

function Sidebar({ 
  morningRoutine, 
  setMorningRoutine, 
  meetings, 
  waitingFor, 
  activeProjects,
  areas,
  currentTime 
}) {
  const [routineExpanded, setRoutineExpanded] = useState(true);
  const [showMeetingModal, setShowMeetingModal] = useState(null);

  const getArea = (areaId) => areas.find(a => a.id === areaId) || areas[0];

  const toggleRoutine = (key) => {
    setMorningRoutine(key, !morningRoutine[key]);
  };

  const routineItems = [
    { key: 'supplements', label: 'תוספים', icon: '💊' },
    { key: 'workout', label: 'אימון', icon: '💪' },
    { key: 'protein', label: 'חלבון', icon: '🥤' },
    { key: 'meditation', label: 'מדיטציה', icon: '🧘' }
  ];

  const completedCount = Object.values(morningRoutine).filter(Boolean).length;
  const isRoutineComplete = completedCount === routineItems.length;

  // Format time from ISO string or Date
  const formatMeetingTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('he-IL', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  // Calculate meeting duration in minutes
  const getMeetingDuration = (meeting) => {
    if (!meeting.start || !meeting.end) return null;
    const start = new Date(meeting.start);
    const end = new Date(meeting.end);
    const minutes = Math.round((end - start) / 60000);
    if (minutes < 60) return `${minutes} דק׳`;
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    if (remainingMins === 0) return `${hours} שע׳`;
    return `${hours}:${String(remainingMins).padStart(2, '0')} שע׳`;
  };

  // Get meeting status based on current time
  const getMeetingStatus = (meeting) => {
    if (!currentTime || !meeting.start) return 'waiting';
    
    const now = currentTime.getTime();
    const startTime = new Date(meeting.start).getTime();
    const endTime = meeting.end ? new Date(meeting.end).getTime() : startTime + 3600000; // Default 1hr
    
    if (now > endTime) return 'done';
    if (now >= startTime && now <= endTime) return 'now';
    return 'waiting';
  };

  // Sort meetings: ongoing first, then upcoming, then past at bottom
  const sortedMeetings = [...meetings].sort((a, b) => {
    const statusOrder = { 'now': 0, 'waiting': 1, 'done': 2 };
    const statusA = getMeetingStatus(a);
    const statusB = getMeetingStatus(b);
    
    if (statusOrder[statusA] !== statusOrder[statusB]) {
      return statusOrder[statusA] - statusOrder[statusB];
    }
    
    // Within same status, sort by time
    return new Date(a.start) - new Date(b.start);
  });

  // Status emoji and styling
  const getStatusIndicator = (status) => {
    switch (status) {
      case 'done': return { emoji: '✅', className: 'done' };
      case 'now': return { emoji: '⏳', className: 'now' };
      default: return { emoji: '🕐', className: 'waiting' };
    }
  };

  // Meeting prep/summary modal
  const MeetingActionModal = ({ meeting, type, onClose }) => {
    const isPrep = type === 'prep';
    
    return (
      <div className="meeting-modal-overlay" onClick={onClose}>
        <div className="meeting-modal" onClick={e => e.stopPropagation()}>
          <div className="meeting-modal-header">
            <h3>{isPrep ? '📋 הכנה לפגישה' : '📝 סיכום פגישה'}</h3>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
          <div className="meeting-modal-content">
            <div className="meeting-modal-title">{meeting.title}</div>
            <div className="meeting-modal-time">
              {formatMeetingTime(meeting.start)} - {formatMeetingTime(meeting.end)}
            </div>
            
            {isPrep ? (
              <div className="meeting-prep-content">
                <h4>📌 נושאים לדיון:</h4>
                <ul>
                  <li>מה המטרה העיקרית של הפגישה?</li>
                  <li>מה התוצאה הרצויה?</li>
                  <li>אילו החלטות צריך לקבל?</li>
                </ul>
                <h4>📎 הכנות נדרשות:</h4>
                <ul>
                  <li>מסמכים להכין</li>
                  <li>נתונים לאסוף</li>
                  <li>שאלות להכין</li>
                </ul>
                <button className="ai-assist-btn">
                  🤖 בקש מ-AI לעזור בהכנה
                </button>
              </div>
            ) : (
              <div className="meeting-summary-content">
                <h4>📝 סיכום הפגישה:</h4>
                <textarea 
                  placeholder="מה נדון? מה הוחלט? מה הצעדים הבאים?"
                  className="summary-textarea"
                />
                <h4>✅ משימות שיצאו מהפגישה:</h4>
                <textarea 
                  placeholder="רשום משימות, כל משימה בשורה חדשה"
                  className="tasks-textarea"
                />
                <button className="ai-assist-btn">
                  🤖 בקש מ-AI לסכם
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <aside className="sidebar">
      {/* Morning Routine */}
      <div className="sidebar-card">
        <div 
          className={`sidebar-header ${isRoutineComplete ? 'clickable' : ''}`}
          onClick={() => isRoutineComplete && setRoutineExpanded(!routineExpanded)}
        >
          <h3>🌅 שגרת בוקר</h3>
          {isRoutineComplete ? (
            <span className="routine-complete">
              ✅ הושלם {!routineExpanded && '▸'}
            </span>
          ) : (
            <span className="routine-progress">{completedCount}/4</span>
          )}
        </div>
        
        {(!isRoutineComplete || routineExpanded) && (
          <div className="routine-grid">
            {routineItems.map(item => (
              <button
                key={item.key}
                className={`routine-item ${morningRoutine[item.key] ? 'done' : ''}`}
                onClick={() => toggleRoutine(item.key)}
              >
                <span className="routine-icon">{item.icon}</span>
                <span className="routine-label">{item.label}</span>
                {morningRoutine[item.key] && <span className="routine-check">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Today's Meetings */}
      <div className="sidebar-card">
        <div className="sidebar-header">
          <h3>📅 פגישות היום</h3>
          {meetings.length > 0 && (
            <span className="count-badge">{meetings.length}</span>
          )}
        </div>
        {meetings.length === 0 ? (
          <div className="sidebar-empty">
            <p>אין פגישות היום</p>
          </div>
        ) : (
          <div className="meetings-list">
            {sortedMeetings.map((meeting, idx) => {
              const status = getMeetingStatus(meeting);
              const statusInfo = getStatusIndicator(status);
              
              return (
                <div 
                  key={meeting.id || idx} 
                  className={`meeting-item ${statusInfo.className}`}
                >
                  <div className="meeting-time-status">
                    <span className="meeting-time">{formatMeetingTime(meeting.start)}</span>
                    <span className="meeting-status">{statusInfo.emoji}</span>
                  </div>
                  <div className="meeting-info">
                    <div className="meeting-title">{meeting.title}</div>
                    {meeting.location && (
                      <div className="meeting-location">📍 {meeting.location}</div>
                    )}
                    {getMeetingDuration(meeting) && (
                      <div className="meeting-duration">{getMeetingDuration(meeting)}</div>
                    )}
                    <div className="meeting-actions">
                      {status === 'waiting' && (
                        <button 
                          className="meeting-action-btn prep"
                          onClick={() => setShowMeetingModal({ meeting, type: 'prep' })}
                        >
                          📋 הכנה
                        </button>
                      )}
                      {(status === 'done' || status === 'now') && (
                        <button 
                          className="meeting-action-btn summary"
                          onClick={() => setShowMeetingModal({ meeting, type: 'summary' })}
                        >
                          📝 סיכום
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
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
            {waitingFor.map(item => {
              // Calculate days since
              const daysSince = item.since 
                ? Math.floor((Date.now() - new Date(item.since)) / (1000 * 60 * 60 * 24))
                : item.days || 0;
              
              return (
                <div key={item.id} className="waiting-item">
                  <div className="waiting-text">{item.text}</div>
                  <div className="waiting-meta">
                    <span className="waiting-person">{item.person}</span>
                    <span className="waiting-days">{daysSince} ימים</span>
                  </div>
                </div>
              );
            })}
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
              <div key={project.id} className={`project-item ${project.urgent ? 'urgent' : ''}`}>
                <div className="project-name">
                  <span className="project-area-icon">{area.icon}</span>
                  {project.name}
                  {project.urgent && <span className="urgent-badge">🔥</span>}
                </div>
                {project.nextStep && (
                  <div className="project-next">→ {project.nextStep}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Meeting Modal */}
      {showMeetingModal && (
        <MeetingActionModal 
          meeting={showMeetingModal.meeting}
          type={showMeetingModal.type}
          onClose={() => setShowMeetingModal(null)}
        />
      )}
    </aside>
  );
}

export default Sidebar;

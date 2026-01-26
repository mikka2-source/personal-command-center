import React, { useState } from 'react';
import './TaskList.css';

function TaskList({ tasks, onToggle, onMove, areas }) {
  const [showLater, setShowLater] = useState(false);

  const getArea = (areaId) => areas.find(a => a.id === areaId) || areas[0];

  const TaskItem = ({ task, priority }) => {
    const area = getArea(task.area);
    
    return (
      <div className={`task-item ${task.completed ? 'completed' : ''}`}>
        <div 
          className={`task-checkbox ${task.completed ? 'checked' : ''}`}
          onClick={() => onToggle(priority, task.id)}
        >
          {task.completed && '✓'}
        </div>
        
        <div className="task-content">
          <span className={`task-text ${task.completed ? 'done' : ''}`}>
            {task.text}
          </span>
          <div className="task-meta">
            <span className="area-badge" style={{ color: area.color }}>
              {area.icon}
            </span>
            {task.owner === 'pa' && <span className="owner-badge">PA</span>}
            {task.from && <span className="from-badge">מ: {task.from}</span>}
          </div>
        </div>
      </div>
    );
  };

  const TaskSection = ({ title, items, priority, limit }) => {
    const displayItems = limit ? items.slice(0, limit) : items;
    const hasMore = limit && items.length > limit;

    return (
      <div className="task-section">
        <div className="section-header">
          <h4 className="section-title">{title}</h4>
          <span className="section-count">{items.length}</span>
        </div>
        
        {items.length === 0 ? (
          <div className="section-empty">אין משימות</div>
        ) : (
          <>
            <div className="task-list">
              {displayItems.map(task => (
                <TaskItem key={task.id} task={task} priority={priority} />
              ))}
            </div>
            {hasMore && (
              <div className="section-more">+ {items.length - limit} נוספים</div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="task-list-container card">
      <div className="card-header">
        <h3 className="card-title">✅ משימות</h3>
      </div>

      {/* Now - Most Urgent (1-2 items) */}
      <TaskSection 
        title="עכשיו" 
        items={tasks.now} 
        priority="now"
        limit={2}
      />

      {/* Today (max 5) */}
      <TaskSection 
        title="היום" 
        items={tasks.today} 
        priority="today"
        limit={5}
      />

      {/* Later - Collapsed by default */}
      <div className="task-section later">
        <div 
          className="section-header clickable"
          onClick={() => setShowLater(!showLater)}
        >
          <h4 className="section-title">
            {showLater ? '▼' : '▶'} מאוחר יותר
          </h4>
          <span className="section-count">{tasks.later.length}</span>
        </div>
        
        {showLater && tasks.later.length > 0 && (
          <div className="task-list">
            {tasks.later.map(task => (
              <TaskItem key={task.id} task={task} priority="later" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default TaskList;

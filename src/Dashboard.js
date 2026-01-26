import React, { useState, useEffect } from 'react';
import './Dashboard.css';
import DailyFocus from './DailyFocus';
import TaskList from './TaskList';
import Sidebar from './Sidebar';
import QuickCapture from './QuickCapture';

// Life Areas - Fixed, no custom tags
const LIFE_AREAS = [
  { id: 'work', name: 'Work', icon: '💼', color: '#3b82f6' },
  { id: 'realestate', name: 'Real Estate', icon: '🏢', color: '#10b981' },
  { id: 'investments', name: 'Investments', icon: '📊', color: '#8b5cf6' },
  { id: 'personal', name: 'Personal', icon: '👤', color: '#f59e0b' },
  { id: 'salon', name: 'Beauty Salon', icon: '💅', color: '#ec4899' },
  { id: 'health', name: 'Sports / Health', icon: '🏃', color: '#22c55e' }
];

function Dashboard() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showCapture, setShowCapture] = useState(false);
  
  // Focus task for the day
  const [dailyFocus, setDailyFocus] = useState(null);
  
  // Tasks organized by priority
  const [tasks, setTasks] = useState({
    now: [],
    today: [],
    later: []
  });

  // Sidebar data
  const [morningRoutine, setMorningRoutine] = useState({
    supplements: false,
    workout: false,
    protein: false,
    meditation: false
  });

  const [meetings, setMeetings] = useState([]);
  
  const [waitingFor, setWaitingFor] = useState([]);
  
  const [activeProjects, setActiveProjects] = useState([
    { id: 1, name: 'Personal Command Center', area: 'personal', nextStep: 'Calendar integration' },
    { id: 2, name: 'FLUIDITY Exit Strategy', area: 'work', nextStep: 'Prepare buyer deck' },
    { id: 3, name: 'KEEPER Exit Strategy', area: 'work', nextStep: 'Patent documentation' }
  ]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'בוקר טוב';
    if (hour < 18) return 'צהריים טובים';
    return 'ערב טוב';
  };

  const formatDate = () => {
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    return currentTime.toLocaleDateString('he-IL', options);
  };

  const formatTime = () => {
    return currentTime.toLocaleTimeString('he-IL', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const handleAddTask = (task) => {
    const newTask = {
      id: Date.now(),
      text: task.text,
      area: task.area || 'personal',
      owner: task.owner || 'me',
      from: task.from || null,
      project: task.project || null,
      completed: false,
      createdAt: new Date()
    };

    if (task.priority === 'focus') {
      setDailyFocus(newTask);
    } else {
      setTasks(prev => ({
        ...prev,
        [task.priority || 'today']: [...prev[task.priority || 'today'], newTask]
      }));
    }
    setShowCapture(false);
  };

  const toggleTask = (priority, taskId) => {
    setTasks(prev => ({
      ...prev,
      [priority]: prev[priority].map(task =>
        task.id === taskId ? { ...task, completed: !task.completed } : task
      )
    }));
  };

  const moveTask = (fromPriority, toPriority, taskId) => {
    const task = tasks[fromPriority].find(t => t.id === taskId);
    if (task) {
      setTasks(prev => ({
        ...prev,
        [fromPriority]: prev[fromPriority].filter(t => t.id !== taskId),
        [toPriority]: [...prev[toPriority], task]
      }));
    }
  };

  const completeFocus = () => {
    if (dailyFocus) {
      setDailyFocus({ ...dailyFocus, completed: true });
    }
  };

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <h1>{getGreeting()}, דן</h1>
          <p className="date-time">{formatDate()} • {formatTime()}</p>
        </div>
        <button 
          className="quick-capture-btn"
          onClick={() => setShowCapture(true)}
        >
          + הוסף
        </button>
      </header>

      {/* Main Content */}
      <div className="dashboard-main">
        {/* Center Column - Primary */}
        <main className="main-content">
          {/* Daily Focus - THE one thing */}
          <DailyFocus 
            focus={dailyFocus}
            onComplete={completeFocus}
            onSetFocus={() => setShowCapture(true)}
            areas={LIFE_AREAS}
          />

          {/* Task List */}
          <TaskList 
            tasks={tasks}
            onToggle={toggleTask}
            onMove={moveTask}
            areas={LIFE_AREAS}
          />
        </main>

        {/* Sidebar */}
        <Sidebar 
          morningRoutine={morningRoutine}
          setMorningRoutine={setMorningRoutine}
          meetings={meetings}
          waitingFor={waitingFor}
          activeProjects={activeProjects}
          areas={LIFE_AREAS}
        />
      </div>

      {/* Quick Capture Modal */}
      {showCapture && (
        <QuickCapture 
          onAdd={handleAddTask}
          onClose={() => setShowCapture(false)}
          areas={LIFE_AREAS}
          hasFocus={!!dailyFocus}
        />
      )}
    </div>
  );
}

export default Dashboard;

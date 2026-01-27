import React, { useState, useEffect, useCallback } from 'react';
import './Dashboard.css';
import DailyFocus from './DailyFocus';
import TaskList from './TaskList';
import Sidebar from './Sidebar';
import QuickCapture from './QuickCapture';
import * as db from './persistence';

// Life Areas - Fixed, no custom tags
const LIFE_AREAS = [
  { id: 'work', name: 'Work', icon: '💼', color: '#3b82f6' },
  { id: 'realestate', name: 'Real Estate', icon: '🏢', color: '#10b981' },
  { id: 'investments', name: 'Investments', icon: '📊', color: '#8b5cf6' },
  { id: 'personal', name: 'Personal', icon: '👤', color: '#f59e0b' },
  { id: 'salon', name: 'Beauty Salon', icon: '💅', color: '#ec4899' },
  { id: 'health', name: 'Sports / Health', icon: '🏃', color: '#22c55e' }
];

// Local storage keys
const STORAGE_KEYS = {
  tasks: 'pcc_tasks',
  dailyFocus: 'pcc_dailyFocus',
  morningRoutine: 'pcc_morningRoutine',
  completedToday: 'pcc_completedToday',
  lastResetDate: 'pcc_lastResetDate',
  undoHistory: 'pcc_undoHistory'
};

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

  // Completed tasks today (for undo/history)
  const [completedToday, setCompletedToday] = useState([]);
  
  // Undo history stack
  const [undoHistory, setUndoHistory] = useState([]);

  // Sidebar data
  const [morningRoutine, setMorningRoutine] = useState({
    supplements: false,
    workout: false,
    protein: false,
    meditation: false
  });

  const [meetings, setMeetings] = useState([]);
  
  const [waitingFor, setWaitingFor] = useState([]);
  
  const [activeProjects, setActiveProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Check and reset daily data at midnight
  const checkDailyReset = useCallback(() => {
    const today = new Date().toDateString();
    const lastReset = localStorage.getItem(STORAGE_KEYS.lastResetDate);
    
    if (lastReset !== today) {
      // Reset morning routine
      setMorningRoutine({
        supplements: false,
        workout: false,
        protein: false,
        meditation: false
      });
      // Clear completed today
      setCompletedToday([]);
      // Clear undo history
      setUndoHistory([]);
      // Update last reset date
      localStorage.setItem(STORAGE_KEYS.lastResetDate, today);
    }
  }, []);

  // Save state to localStorage
  const saveToStorage = useCallback((key, data) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (err) {
      console.warn('Failed to save to localStorage:', err);
    }
  }, []);

  // Load state from localStorage
  const loadFromStorage = useCallback((key, defaultValue) => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch (err) {
      console.warn('Failed to load from localStorage:', err);
      return defaultValue;
    }
  }, []);

  // Persist data changes (localStorage + Supabase)
  useEffect(() => {
    if (!loading) {
      db.saveTasks(tasks);
    }
  }, [tasks, loading]);

  useEffect(() => {
    if (!loading) {
      db.saveDailyFocus(dailyFocus);
    }
  }, [dailyFocus, loading]);

  useEffect(() => {
    if (!loading) {
      db.saveMorningRoutine(morningRoutine);
    }
  }, [morningRoutine, loading]);

  useEffect(() => {
    if (!loading) {
      db.saveCompletedToday(completedToday);
    }
  }, [completedToday, loading]);

  // Fetch calendar data
  const fetchCalendar = useCallback(async () => {
    try {
      const calRes = await fetch('/api/calendar');
      if (calRes.ok) {
        const calData = await calRes.json();
        if (calData.meetings) setMeetings(calData.meetings);
      }
    } catch (err) {
      console.log('Calendar API not available');
    }
  }, []);

  // Fetch data from APIs on mount (with localStorage fallback)
  useEffect(() => {
    const fetchData = async () => {
      // Check for daily reset first
      checkDailyReset();
      
      // Load from persistence layer (Supabase with localStorage fallback)
      const [storedTasks, storedFocus, storedRoutine, storedCompleted] = await Promise.all([
        db.loadTasks(),
        db.loadDailyFocus(),
        db.loadMorningRoutine(),
        db.loadCompletedToday()
      ]);
      
      const hasTasks = storedTasks && (storedTasks.now?.length || storedTasks.today?.length || storedTasks.later?.length);
      
      if (hasTasks) setTasks(storedTasks);
      if (storedFocus) setDailyFocus(storedFocus);
      if (storedRoutine) setMorningRoutine(storedRoutine);
      setCompletedToday(storedCompleted);

      try {
        // Fetch seed data from API only on first load (no existing data)
        if (!hasTasks && !storedFocus) {
          const dataRes = await fetch('/api/data');
          if (dataRes.ok) {
            const data = await dataRes.json();
            if (data.dailyFocus && !storedFocus) setDailyFocus(data.dailyFocus);
            if (data.tasks && !hasTasks) setTasks(data.tasks);
            if (data.morningRoutine && !storedRoutine) setMorningRoutine(data.morningRoutine);
            if (data.waitingFor) setWaitingFor(data.waitingFor);
            if (data.activeProjects) setActiveProjects(data.activeProjects);
          }
        }
        
        // Always fetch fresh calendar data
        await fetchCalendar();
      } catch (err) {
        console.log('API not available, using local data');
      }
      setLoading(false);
    };
    
    fetchData();
  }, [checkDailyReset, loadFromStorage, fetchCalendar]);

  // Refresh calendar every 5 minutes
  useEffect(() => {
    const calendarInterval = setInterval(fetchCalendar, 5 * 60 * 1000);
    return () => clearInterval(calendarInterval);
  }, [fetchCalendar]);

  // Update time every minute and check for midnight reset
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      checkDailyReset();
    }, 60000);
    return () => clearInterval(timer);
  }, [checkDailyReset]);

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

  // Add to undo history
  const pushUndo = (action) => {
    setUndoHistory(prev => [...prev.slice(-9), action]); // Keep last 10 actions
  };

  // Undo last action
  const handleUndo = () => {
    if (undoHistory.length === 0) return;
    
    const lastAction = undoHistory[undoHistory.length - 1];
    setUndoHistory(prev => prev.slice(0, -1));

    switch (lastAction.type) {
      case 'complete_task':
        // Restore task to its original position
        setTasks(prev => ({
          ...prev,
          [lastAction.priority]: [...prev[lastAction.priority], { ...lastAction.task, done: false, completed: false }]
        }));
        setCompletedToday(prev => prev.filter(t => t.id !== lastAction.task.id));
        break;
      case 'complete_focus':
        setDailyFocus(prev => prev ? { ...prev, completed: false } : null);
        break;
      case 'toggle_routine':
        setMorningRoutine(prev => ({
          ...prev,
          [lastAction.key]: lastAction.previousValue
        }));
        break;
      default:
        break;
    }
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
      done: false,
      createdAt: new Date().toISOString()
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
    const task = tasks[priority].find(t => t.id === taskId);
    if (!task) return;

    const isCompleting = !task.done && !task.completed;
    
    if (isCompleting) {
      // Save undo action
      pushUndo({ type: 'complete_task', task: { ...task }, priority });
      
      // Move to completed
      setTasks(prev => ({
        ...prev,
        [priority]: prev[priority].filter(t => t.id !== taskId)
      }));
      setCompletedToday(prev => [...prev, { 
        ...task, 
        done: true, 
        completed: true, 
        completedAt: new Date().toISOString() 
      }]);
      
      // Sync to Supabase
      db.completeTask(task);
    } else {
      // Toggle back (uncomplete)
      setTasks(prev => ({
        ...prev,
        [priority]: prev[priority].map(t =>
          t.id === taskId ? { ...t, completed: !t.completed, done: !t.done } : t
        )
      }));
    }
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
    if (dailyFocus && !dailyFocus.completed) {
      pushUndo({ type: 'complete_focus' });
      setDailyFocus({ ...dailyFocus, completed: true });
    }
  };

  const handleRoutineToggle = (key, newValue) => {
    pushUndo({ 
      type: 'toggle_routine', 
      key, 
      previousValue: morningRoutine[key] 
    });
    setMorningRoutine(prev => ({
      ...prev,
      [key]: newValue
    }));
  };

  // Restore a completed task
  const restoreTask = (taskId) => {
    const task = completedToday.find(t => t.id === taskId);
    if (!task) return;
    
    setCompletedToday(prev => prev.filter(t => t.id !== taskId));
    setTasks(prev => ({
      ...prev,
      today: [...prev.today, { ...task, done: false, completed: false }]
    }));
    
    // Sync to Supabase
    db.restoreCompletedTask(taskId, 'today');
  };

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <h1>{getGreeting()}, דן</h1>
          <p className="date-time">{formatDate()} • {formatTime()}</p>
        </div>
        <div className="header-actions">
          {undoHistory.length > 0 && (
            <button className="undo-btn" onClick={handleUndo} title="בטל פעולה אחרונה">
              ↩️ בטל
            </button>
          )}
          <button 
            className="quick-capture-btn"
            onClick={() => setShowCapture(true)}
          >
            + הוסף
          </button>
        </div>
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
            completedToday={completedToday}
            onToggle={toggleTask}
            onMove={moveTask}
            onRestore={restoreTask}
            areas={LIFE_AREAS}
          />
        </main>

        {/* Sidebar */}
        <Sidebar 
          morningRoutine={morningRoutine}
          setMorningRoutine={handleRoutineToggle}
          meetings={meetings}
          waitingFor={waitingFor}
          activeProjects={activeProjects}
          areas={LIFE_AREAS}
          currentTime={currentTime}
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

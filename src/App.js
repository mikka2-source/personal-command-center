import React, { useState, useEffect } from 'react';
import './App.css';
import CommandMode from './modes/CommandMode';
import TransparencyMode from './modes/TransparencyMode';
import WorkbenchMode from './modes/WorkbenchMode';
import HorizonMode from './modes/HorizonMode';
import CalendarMode from './modes/CalendarMode';
import PAInbox from './components/PAInbox';
import DayClose from './components/DayClose';
import GoldenDemo from './pages/GoldenDemo';
import { Toaster } from './components/ui/toaster';

// Check if we're in dev mode
const isDev = process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost';

const MODES = {
  command: { label: 'Command', icon: '⚡' },
  transparency: { label: 'Brain', icon: '🧠' },
  workbench: { label: 'Workbench', icon: '🔧' },
  horizon: { label: 'Horizon', icon: '🔭' },
  calendar: { label: 'Calendar', icon: '📅' },
  'pa-inbox': { label: 'PA Inbox', icon: '📥' },
  // Dev-only modes
  ...(isDev && { 'golden-demo': { label: 'Golden', icon: '✨' } }),
};

// Get current hour in Asia/Nicosia timezone
function getNicosiaHour() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Nicosia' })).getHours();
}

function App() {
  const [mode, setMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') || 'command';
  });
  const [showDayClose, setShowDayClose] = useState(false);
  const [dayCloseDismissed, setDayCloseDismissed] = useState(false);

  useEffect(() => {
    // Remove old dark mode
    document.body.classList.remove('dark-mode');
    document.body.classList.add('light-mode');
  }, []);

  // Auto-show DayClose after 21:00 (once per session)
  useEffect(() => {
    const checkDayClose = () => {
      const hour = getNicosiaHour();
      if (hour >= 21 && !dayCloseDismissed && !showDayClose) {
        setShowDayClose(true);
      }
    };
    checkDayClose();
    const interval = setInterval(checkDayClose, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [dayCloseDismissed, showDayClose]);

  const handleModeChange = (newMode) => {
    setMode(newMode);
    const url = new URL(window.location);
    if (newMode === 'command') {
      url.searchParams.delete('mode');
    } else {
      url.searchParams.set('mode', newMode);
    }
    window.history.pushState({}, '', url);
  };

  useEffect(() => {
    const handlePop = () => {
      const params = new URLSearchParams(window.location.search);
      setMode(params.get('mode') || 'command');
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const handleDayCloseClose = () => {
    setShowDayClose(false);
    setDayCloseDismissed(true);
  };

  const renderMode = () => {
    switch (mode) {
      case 'transparency':
        return <TransparencyMode />;
      case 'workbench':
        return <WorkbenchMode />;
      case 'horizon':
        return <HorizonMode />;
      case 'calendar':
        return <CalendarMode />;
      case 'pa-inbox':
        return <PAInbox />;
      case 'golden-demo':
        return <GoldenDemo />;
      case 'command':
      default:
        return <CommandMode />;
    }
  };

  return (
    <div className="app">
      {renderMode()}

      {/* Mode Switcher — bottom pill */}
      <nav className="mode-switcher">
        {Object.entries(MODES).map(([key, { label, icon }]) => (
          <button
            key={key}
            className={`mode-btn ${mode === key ? 'mode-active' : ''}`}
            onClick={() => handleModeChange(key)}
          >
            <span className="mode-icon">{icon}</span>
            <span className="mode-label">{label}</span>
          </button>
        ))}
      </nav>

      {/* Day Close button (visible after 21:00) */}
      {getNicosiaHour() >= 21 && !showDayClose && (
        <button
          className="day-close-trigger"
          onClick={() => setShowDayClose(true)}
          title="Day Close"
        >
          🌙
        </button>
      )}

      {/* Day Close Modal */}
      {showDayClose && <DayClose onClose={handleDayCloseClose} />}
      
      {/* Global Toast Notifications */}
      <Toaster />
    </div>
  );
}

export default App;

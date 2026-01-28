import React, { useState, useEffect } from 'react';
import './App.css';
import CommandMode from './modes/CommandMode';
import TransparencyMode from './modes/TransparencyMode';
import WorkbenchMode from './modes/WorkbenchMode';

const MODES = {
  command: { label: 'Command', icon: '⚡' },
  transparency: { label: 'Brain', icon: '🧠' },
  workbench: { label: 'Workbench', icon: '🔧' },
};

function App() {
  const [mode, setMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') || 'command';
  });

  useEffect(() => {
    // Remove old dark mode
    document.body.classList.remove('dark-mode');
    document.body.classList.add('light-mode');
  }, []);

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

  const renderMode = () => {
    switch (mode) {
      case 'transparency':
        return <TransparencyMode />;
      case 'workbench':
        return <WorkbenchMode />;
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
    </div>
  );
}

export default App;

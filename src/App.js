import React, { useState, useEffect } from 'react';
import './App.css';
import Dashboard from './Dashboard';
import DarkModeToggle from './DarkModeToggle';
import TradingAnalytics from './TradingAnalytics';

function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [view, setView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') || 'dashboard';
  });

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  return (
    <div className="App">
      <DarkModeToggle darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
      <div className="app-nav">
        <button className={view === 'dashboard' ? 'nav-active' : ''} onClick={() => setView('dashboard')}>🏠 Dashboard</button>
        <button className={view === 'trading' ? 'nav-active' : ''} onClick={() => setView('trading')}>📊 Trading</button>
      </div>
      {view === 'dashboard' && <Dashboard />}
      {view === 'trading' && <TradingAnalytics />}
    </div>
  );
}

export default App;

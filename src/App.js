import React, { useState, useEffect } from 'react';
import './App.css';
import Dashboard from './Dashboard';
import DarkModeToggle from './DarkModeToggle';

function App() {
  const [darkMode, setDarkMode] = useState(true);

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
      <Dashboard />
    </div>
  );
}

export default App;

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';
import Dashboard from './Dashboard';
import RapydResearch from './RapydResearch';
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
    <Router>
      <div className="App">
        <DarkModeToggle darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/rapyd" element={<RapydResearch />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

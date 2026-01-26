import React from 'react';
import './DarkModeToggle.css';

function DarkModeToggle({ darkMode, toggleDarkMode }) {
  return (
    <button className="dark-mode-toggle" onClick={toggleDarkMode}>
      {darkMode ? '☀️' : '🌙'}
    </button>
  );
}

export default DarkModeToggle;

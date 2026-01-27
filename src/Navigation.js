import React, { useState } from 'react';
import './Navigation.css';

const NAV_ITEMS = [
  { id: 'home', icon: '🏠', label: 'Home' },
  { id: 'engine', icon: '🧠', label: 'Engine' },
  { id: 'tasks', icon: '📋', label: 'Tasks' },
  { id: 'mikka', icon: '🤖', label: 'Mikka' },
  { id: 'people', icon: '👥', label: 'People' },
  { id: 'areas', icon: '📊', label: 'Areas' },
  { id: 'settings', icon: '⚙️', label: 'Settings' },
];

function Navigation({ currentView, onNavigate }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNav = (id) => {
    onNavigate(id);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile hamburger */}
      <button 
        className="nav-mobile-toggle" 
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? '✕' : '☰'}
      </button>

      <nav className={`nav-sidebar ${collapsed ? 'nav-collapsed' : ''} ${mobileOpen ? 'nav-mobile-open' : ''}`}>
        {/* Logo */}
        <div className="nav-logo" onClick={() => handleNav('home')}>
          <span className="nav-logo-icon">⚡</span>
          {!collapsed && <span className="nav-logo-text">Life OS</span>}
        </div>

        {/* Nav Items */}
        <div className="nav-items">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`nav-item ${currentView === item.id ? 'nav-active' : ''}`}
              onClick={() => handleNav(item.id)}
              title={collapsed ? item.label : undefined}
            >
              <span className="nav-item-icon">{item.icon}</span>
              {!collapsed && <span className="nav-item-label">{item.label}</span>}
            </button>
          ))}
        </div>

        {/* Bottom */}
        <div className="nav-bottom">
          <button 
            className="nav-collapse-btn"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? '→' : '←'}
          </button>
        </div>
      </nav>

      {/* Mobile overlay */}
      {mobileOpen && <div className="nav-overlay" onClick={() => setMobileOpen(false)} />}
    </>
  );
}

export default Navigation;

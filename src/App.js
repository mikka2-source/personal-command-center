import React, { useState, useEffect } from 'react';
import './App.css';
import Navigation from './Navigation';
import LifeDashboard from './LifeDashboard';
import LifeOSEngine from './LifeOSEngine';
import Dashboard from './Dashboard';
import MikkaPage from './MikkaPage';
import PlaceholderPage from './PlaceholderPage';

function App() {
  const [view, setView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') || 'home';
  });

  useEffect(() => {
    // Always dark mode
    document.body.classList.add('dark-mode');
  }, []);

  // Update URL when view changes
  const handleNavigate = (newView) => {
    setView(newView);
    const url = new URL(window.location);
    if (newView === 'home') {
      url.searchParams.delete('view');
    } else {
      url.searchParams.set('view', newView);
    }
    window.history.pushState({}, '', url);
  };

  // Handle browser back/forward
  useEffect(() => {
    const handlePop = () => {
      const params = new URLSearchParams(window.location.search);
      setView(params.get('view') || 'home');
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const renderView = () => {
    switch (view) {
      case 'home':
        return <LifeDashboard onNavigate={handleNavigate} />;
      case 'engine':
        return <LifeOSEngine />;
      case 'tasks':
        return <Dashboard />;
      case 'mikka':
        return <MikkaPage />;
      case 'people':
      case 'areas':
      case 'settings':
        return <PlaceholderPage page={view} />;
      default:
        return <LifeDashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="App">
      <Navigation currentView={view} onNavigate={handleNavigate} />
      <div className="app-content">
        {renderView()}
      </div>
    </div>
  );
}

export default App;

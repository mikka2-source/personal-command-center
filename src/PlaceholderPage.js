import React from 'react';

const pages = {
  people: {
    icon: '👥',
    title: 'People',
    subtitle: 'Relationship tracking & follow-ups',
    description: 'Track your contacts, meetings, and follow-ups across all life areas. Coming soon.'
  },
  areas: {
    icon: '📊',
    title: 'Life Areas',
    subtitle: 'Deep dive into each area',
    description: 'Detailed view of each life area with metrics, goals, and progress tracking. Coming soon.'
  },
  settings: {
    icon: '⚙️',
    title: 'Settings',
    subtitle: 'Configure your Life OS',
    description: 'Customize areas, notifications, integrations, and preferences. Coming soon.'
  }
};

function PlaceholderPage({ page }) {
  const config = pages[page] || pages.settings;

  return (
    <div style={{
      maxWidth: 600,
      margin: '0 auto',
      padding: '80px 32px',
      textAlign: 'center',
      direction: 'rtl'
    }}>
      <div style={{ fontSize: '4rem', marginBottom: 20 }}>{config.icon}</div>
      <h1 style={{ 
        fontSize: '1.8rem', 
        fontWeight: 700, 
        color: '#f1f5f9', 
        margin: '0 0 8px' 
      }}>{config.title}</h1>
      <p style={{ 
        fontSize: '0.95rem', 
        color: '#94a3b8', 
        margin: '0 0 24px' 
      }}>{config.subtitle}</p>
      <div style={{
        background: '#12121a',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 16,
        padding: '32px 24px',
        color: '#64748b',
        fontSize: '0.9rem',
        lineHeight: 1.6
      }}>
        {config.description}
        <div style={{ 
          marginTop: 20, 
          padding: '10px 20px', 
          background: 'rgba(59,130,246,0.1)', 
          borderRadius: 10, 
          display: 'inline-block',
          color: '#93c5fd',
          fontSize: '0.85rem',
          fontWeight: 500
        }}>
          🚧 Under Construction
        </div>
      </div>
    </div>
  );
}

export default PlaceholderPage;

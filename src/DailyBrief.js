import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import './DailyBrief.css';

function DailyBrief() {
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBrief() {
      if (!isSupabaseConfigured()) {
        setLoading(false);
        return;
      }
      
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('daily_briefs')
        .select('*')
        .eq('user_id', 'dan')
        .eq('date', today)
        .single();
      
      if (!error && data) {
        setBrief(data);
      }
      setLoading(false);
    }
    fetchBrief();
  }, []);

  if (loading) {
    return (
      <div className="daily-brief">
        <div className="db-loading">טוען...</div>
      </div>
    );
  }

  if (!brief) {
    return null; // Don't show if no brief today
  }

  const loadScore = brief.load_score || 0;
  const filled = Math.round(loadScore / 10);
  const empty = 10 - filled;

  const getSleepLabel = (trend) => {
    switch (trend) {
      case 'good': return '✅ תקין';
      case 'declining': return '⚠️ ירידה';
      case 'conservation': return '🔴 שימור';
      default: return '❓';
    }
  };

  const getLoadColor = (score) => {
    if (score <= 30) return '#22c55e';
    if (score <= 60) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="daily-brief">
      <div className="db-header">
        <h2>🧠 סיכום יומי</h2>
        <div className="db-load" style={{ color: getLoadColor(loadScore) }}>
          <span className="db-load-bar">{'█'.repeat(filled)}{'░'.repeat(empty)}</span>
          <span className="db-load-score">{loadScore}/100</span>
        </div>
      </div>

      {/* Doing today */}
      {brief.doing_today && brief.doing_today.length > 0 && (
        <div className="db-section">
          <h3>📋 עושים היום</h3>
          <ul className="db-list db-doing">
            {brief.doing_today.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Not doing */}
      {brief.not_doing_today && brief.not_doing_today.length > 0 && (
        <div className="db-section">
          <h3>🚫 לא היום</h3>
          <ul className="db-list db-not-doing">
            {brief.not_doing_today.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Warning */}
      {brief.warning && (
        <div className="db-warning">
          ⚠️ {brief.warning}
        </div>
      )}

      {/* Small action */}
      {brief.small_action && (
        <div className="db-action">
          ✨ {brief.small_action}
        </div>
      )}

      {/* Footer stats */}
      <div className="db-footer">
        <span>שינה: {getSleepLabel(brief.sleep_trend)}</span>
        {brief.metadata?.body_battery && (
          <span>🔋 {brief.metadata.body_battery}</span>
        )}
        {brief.metadata?.event_count !== undefined && (
          <span>📅 {brief.metadata.event_count} אירועים</span>
        )}
      </div>
    </div>
  );
}

export default DailyBrief;

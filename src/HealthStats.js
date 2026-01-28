import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import './HealthStats.css';

function HealthStats() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHealth() {
      if (!isSupabaseConfigured()) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('health_data')
        .select('*')
        .eq('user_id', 'dan')
        .order('date', { ascending: false })
        .limit(1)
        .single();

      if (!error && data) {
        setHealth(data);
      }
      setLoading(false);
    }
    fetchHealth();
  }, []);

  // Use real data if available, otherwise defaults
  const sleepHours = health?.sleep_hours || null;
  const bodyBattery = health?.body_battery || null;
  const restingHr = health?.resting_hr || null;
  const steps = health?.steps || null;
  const stressLevel = health?.stress_level || null;
  const workoutType = health?.workout_type || null;
  const workoutDuration = health?.workout_duration || null;

  // Determine if sleep data is missing vs actually bad
  const hasSleepData = sleepHours !== null && sleepHours !== undefined && parseFloat(sleepHours) > 0;

  const stats = [];
  if (hasSleepData) {
    stats.push({ icon: '😴', label: 'שינה', value: `${sleepHours}h` });
  } else if (health && !hasSleepData) {
    // Explicitly show "no data" instead of hiding or implying bad sleep
    stats.push({ icon: '😴', label: 'שינה', value: 'אין נתונים', muted: true });
  }
  if (bodyBattery) stats.push({ icon: '🔋', label: 'סוללת גוף', value: bodyBattery });
  if (restingHr) stats.push({ icon: '❤️', label: 'דופק מנוחה', value: restingHr });
  if (stressLevel) stats.push({ icon: '😰', label: 'סטרס', value: stressLevel });
  if (workoutType) stats.push({ icon: '🏋️', label: workoutType, value: workoutDuration ? `${workoutDuration}m` : '✓' });

  const stepsGoal = 10000;
  const stepsPercentage = steps ? Math.min(100, (steps / stepsGoal) * 100) : 0;
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (stepsPercentage / 100) * circumference;

  if (loading) return null;
  if (stats.length === 0 && !steps) return null;

  return (
    <div className="health-stats">
      <h2>💪 בריאות</h2>
      <div className="health-grid">
        {stats.map((stat, index) => (
          <div key={index} className={`health-value${stat.muted ? ' health-value-muted' : ''}`}>
            <div className="health-icon">{stat.icon}</div>
            <div className="health-number">{stat.value}</div>
            <div className="health-label">{stat.label}</div>
          </div>
        ))}
        {steps && (
          <div className="health-value steps-container">
            <div className="steps-progress-container">
              <svg className="steps-progress-svg" width="120" height="120">
                <circle className="steps-progress-ring-background" cx="60" cy="60" r="45" />
                <circle
                  className="steps-progress-ring"
                  cx="60" cy="60" r="45"
                  style={{
                    strokeDasharray: `${circumference} ${circumference}`,
                    strokeDashoffset: strokeDashoffset
                  }}
                />
              </svg>
              <div className="steps-progress-content">
                <div className="health-icon">👟</div>
                <div className="health-number">{steps.toLocaleString()}</div>
                <div className="steps-goal">of {stepsGoal.toLocaleString()}</div>
              </div>
            </div>
            <div className="health-label">צעדים</div>
          </div>
        )}
      </div>
      {health?.date && (
        <div className="health-date">
          עדכון אחרון: {new Date(health.date).toLocaleDateString('he-IL')}
        </div>
      )}
    </div>
  );
}

export default HealthStats;

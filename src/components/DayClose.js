/**
 * Day Close Component - Soft Close Model
 * 
 * State Machine:
 * - auto: System closes the day automatically (no interaction needed)
 * - partial: User saw summary but didn't engage
 * - reviewed: User explicitly reviewed and confirmed
 * 
 * Layers:
 * - A: Auto summary (always generated)
 * - B: Awareness tap (optional — "I saw this")
 * - C: Prep for tomorrow (optional — set intentions)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { useToast } from './ui/use-toast';
import './DayClose.css';

const TODAY = new Date().toISOString().split('T')[0];

function DayClose({ onClose }) {
  const { toast } = useToast();
  const [state, setState] = useState('loading'); // loading | auto | partial | reviewed | closed
  const [summary, setSummary] = useState(null);
  const [showTomorrow, setShowTomorrow] = useState(false);
  const [tomorrowNote, setTomorrowNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Lock body scroll when modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Generate auto summary
  const generateSummary = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setState('auto');
      setSummary({
        closures: 0,
        highlights: [],
        health: null,
        mood: 'unknown'
      });
      return;
    }

    try {
      // Get today's closures
      const [tasksRes, eventsRes, briefRes, healthRes] = await Promise.all([
        supabase.from('tasks')
          .select('*')
          .eq('user_id', 'dan')
          .eq('completed', true)
          .gte('completed_at', `${TODAY}T00:00:00Z`)
          .lte('completed_at', `${TODAY}T23:59:59Z`),
        supabase.from('events')
          .select('*')
          .eq('user_id', 'dan')
          .gte('start_time', `${TODAY}T00:00:00Z`)
          .lte('start_time', `${TODAY}T23:59:59Z`),
        supabase.from('daily_briefs')
          .select('*')
          .eq('user_id', 'dan')
          .eq('date', TODAY)
          .single(),
        supabase.from('health_data')
          .select('*')
          .eq('user_id', 'dan')
          .eq('date', TODAY)
          .single()
      ]);

      const doneTasks = tasksRes.data || [];
      const events = eventsRes.data || [];
      const brief = briefRes.data;
      const health = healthRes.data;

      // Count closures
      let closures = doneTasks.length;
      const now = new Date();
      const pastEvents = events.filter(e => new Date(e.end_time || e.start_time) < now);
      closures += pastEvents.length;

      // Check morning anchor
      if (brief?.metadata?.morning_anchor === 'done') {
        closures += 1;
      }

      // Build highlights
      const highlights = [];
      if (doneTasks.length > 0) {
        highlights.push(`✅ ${doneTasks.length} tasks completed`);
      }
      if (pastEvents.length > 0) {
        highlights.push(`📅 ${pastEvents.length} events`);
      }
      if (health?.steps > 5000) {
        highlights.push(`👟 ${health.steps.toLocaleString()} steps`);
      }
      if (health?.workout_type) {
        highlights.push(`🏋️ ${health.workout_type}`);
      }

      // Determine mood based on closures and health
      let mood = 'neutral';
      if (closures >= 5 && (health?.body_battery > 50 || !health)) {
        mood = 'productive';
      } else if (closures < 2 && health?.body_battery < 30) {
        mood = 'low';
      }

      setSummary({
        closures,
        highlights,
        health: {
          sleep: health?.sleep_hours,
          battery: health?.body_battery,
          steps: health?.steps
        },
        mood
      });

      // Check if day close already exists
      const { data: existing } = await supabase
        .from('day_close')
        .select('*')
        .eq('user_id', 'dan')
        .eq('date', TODAY)
        .single();

      if (existing) {
        setState(existing.state);
      } else {
        setState('auto');
      }
    } catch (err) {
      console.error('Generate summary error:', err);
      setState('auto');
    }
  }, []);

  useEffect(() => {
    generateSummary();
  }, [generateSummary]);

  const saveDayClose = useCallback(async (closeState, note = null) => {
    if (!isSupabaseConfigured()) {
      setState('closed');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('day_close').upsert({
        user_id: 'dan',
        date: TODAY,
        state: closeState,
        summary: summary,
        tomorrow_note: note,
        closed_at: new Date().toISOString()
      }, { onConflict: 'user_id,date' });

      if (error) throw error;
      setState('closed');
    } catch (err) {
      console.error('Save day close error:', err);
      toast({ title: "Day close failed", description: "Could not save. Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [summary, toast]);

  // Auto-close after 30 seconds if no interaction
  useEffect(() => {
    if (state === 'auto') {
      const timer = setTimeout(() => {
        saveDayClose('auto');
      }, 30000);
      return () => clearTimeout(timer);
    }
  }, [state, saveDayClose]);

  const handleAcknowledge = () => {
    setState('partial');
    saveDayClose('partial');
  };

  const handleReview = () => {
    setShowTomorrow(true);
  };

  const handleConfirmReview = () => {
    saveDayClose('reviewed', tomorrowNote || null);
  };

  const getMoodEmoji = () => {
    switch (summary?.mood) {
      case 'productive': return '🌟';
      case 'low': return '😴';
      default: return '🌙';
    }
  };

  const getMoodMessage = () => {
    switch (summary?.mood) {
      case 'productive': return 'Productive day!';
      case 'low': return 'Tough day — tomorrow will be better';
      default: return 'Normal day';
    }
  };

  if (state === 'loading') {
    return (
      <div className="day-close-overlay">
        <div className="day-close">
          <div className="day-close-loading">
            <div className="day-close-spinner" />
            <p>Summarizing the day...</p>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'closed') {
    return (
      <div className="day-close-overlay" onClick={onClose}>
        <div className="day-close day-close-done" onClick={e => e.stopPropagation()}>
          <div className="day-close-check">✓</div>
          <p>Day closed. Good night! 🌙</p>
        </div>
      </div>
    );
  }

  return (
    <div className="day-close-overlay" onClick={onClose}>
      <div className="day-close" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <header className="day-close-header">
          <span className="day-close-emoji">{getMoodEmoji()}</span>
          <h2>Day Close</h2>
          <p className="day-close-date">{new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </header>

        {/* Layer A: Auto Summary */}
        <section className="day-close-summary">
          <div className="day-close-stat day-close-stat-main">
            <span className="day-close-stat-value">{summary?.closures || 0}</span>
            <span className="day-close-stat-label">Today's Closures</span>
          </div>

          {summary?.highlights?.length > 0 && (
            <div className="day-close-highlights">
              {summary.highlights.map((h, i) => (
                <span key={i} className="day-close-highlight">{h}</span>
              ))}
            </div>
          )}

          <p className="day-close-mood">{getMoodMessage()}</p>
        </section>

        {/* Layer B: Awareness (tap to acknowledge) */}
        {!showTomorrow && state === 'auto' && (
          <div className="day-close-actions">
            <button className="day-close-btn day-close-btn-ack" onClick={handleAcknowledge}>
              👋 Got it
            </button>
            <button className="day-close-btn day-close-btn-review" onClick={handleReview}>
              ✍️ Review
            </button>
          </div>
        )}

        {/* Layer C: Prep for Tomorrow */}
        {showTomorrow && (
          <section className="day-close-tomorrow">
            <h3>Tomorrow</h3>
            <textarea
              className="day-close-tomorrow-input"
              placeholder="One thing important for tomorrow..."
              value={tomorrowNote}
              onChange={e => setTomorrowNote(e.target.value)}
              rows={3}
            />
            <button
              className="day-close-btn day-close-btn-confirm"
              onClick={handleConfirmReview}
              disabled={saving}
            >
              {saving ? 'Saving...' : '✅ Close Day'}
            </button>
          </section>
        )}

        {/* Auto-close indicator */}
        {state === 'auto' && !showTomorrow && (
          <p className="day-close-auto-note">
            Day will auto-close in a few seconds...
          </p>
        )}
      </div>
    </div>
  );
}

export default DayClose;

/**
 * Task Card Component
 * 
 * Editable task view that logs all changes as learning signals.
 * 
 * Fields:
 * - Title/wording
 * - Labels
 * - Energy level
 * - Dependencies
 * - Freeze/Archive
 * - Owner/Assignee (for PA model)
 */

import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { toast } from './ui/use-toast';
import './TaskCard.css';

const ENERGY_LEVELS = [
  { value: 'low', label: 'Low', icon: '🌙', color: '#22c55e' },
  { value: 'medium', label: 'Medium', icon: '☀️', color: '#f59e0b' },
  { value: 'high', label: 'High', icon: '⚡', color: '#ef4444' }
];

const LABELS = [
  { value: 'work', label: 'Work', color: '#6366f1' },
  { value: 'family', label: 'Family', color: '#ec4899', override: true },
  { value: 'health', label: 'Health', color: '#22c55e' },
  { value: 'personal', label: 'Personal', color: '#8b5cf6' },
  { value: 'urgent', label: 'Urgent', color: '#ef4444' },
  { value: 'waiting', label: 'Waiting', color: '#64748b' }
];

const TIME_ESTIMATES = [
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' }
];

const URGENCY_LEVELS = [
  { value: 'now', label: 'This Week', icon: '🔴', color: '#ef4444' },
  { value: 'soon', label: 'This Month', icon: '🟡', color: '#f59e0b' },
  { value: 'later', label: 'Someday', icon: '🟢', color: '#22c55e' }
];

function TaskCard({ task, onClose, onUpdate }) {
  const [editedTask, setEditedTask] = useState({ ...task });
  const [originalTask] = useState({ ...task });
  const [saving, setSaving] = useState(false);
  const [showConfirmArchive, setShowConfirmArchive] = useState(false);

  // Track which fields were edited
  const [editedFields, setEditedFields] = useState([]);

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

  const handleFieldChange = (field, value) => {
    setEditedTask(prev => ({ ...prev, [field]: value }));
    if (!editedFields.includes(field)) {
      setEditedFields(prev => [...prev, field]);
    }
  };

  const toggleLabel = (labelValue) => {
    const currentLabels = editedTask.labels || [];
    const newLabels = currentLabels.includes(labelValue)
      ? currentLabels.filter(l => l !== labelValue)
      : [...currentLabels, labelValue];
    handleFieldChange('labels', newLabels);
  };

  const hasFamilyOverride = () => {
    return (editedTask.labels || []).includes('family');
  };

  const saveChanges = async () => {
    if (!isSupabaseConfigured()) return;
    setSaving(true);

    try {
      // 1. Save the task update
      const { error: taskError } = await supabase
        .from('tasks')
        .update({
          text: editedTask.text,
          title: editedTask.title || editedTask.text,
          labels: editedTask.labels,
          energy_level: editedTask.energy_level,
          dependencies: editedTask.dependencies,
          frozen: editedTask.frozen,
          archived: editedTask.archived,
          assignee: editedTask.assignee,
          family_override: hasFamilyOverride(),
          estimated_minutes: editedTask.estimated_minutes || 30,
          lane: editedTask.lane || 'later',
          updated_at: new Date().toISOString()
        })
        .eq('id', task.id);

      if (taskError) throw taskError;

      // 2. Log correction signal for AI learning
      if (editedFields.length > 0) {
        await logCorrectionSignal();
      }

      toast({
        title: "✓ Saved",
        description: "Task updated successfully",
      });

      if (onUpdate) onUpdate(editedTask);
      onClose();
    } catch (err) {
      console.error('Save task error:', err);
      toast({
        title: "Save failed",
        description: "Could not save task. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const logCorrectionSignal = async () => {
    const corrections = editedFields.map(field => ({
      field,
      original: originalTask[field],
      corrected: editedTask[field],
      timestamp: new Date().toISOString()
    }));

    try {
      await supabase.from('correction_signals').insert({
        user_id: 'dan',
        entity_type: 'task',
        entity_id: task.id,
        corrections,
        created_at: new Date().toISOString()
      });
    } catch (err) {
      console.error('Log correction signal error:', err);
      // Don't fail the save if logging fails
    }
  };

  const handleArchive = async () => {
    handleFieldChange('archived', true);
    setShowConfirmArchive(false);
  };

  const handleFreeze = () => {
    handleFieldChange('frozen', !editedTask.frozen);
  };

  return (
    <div className="task-card-overlay" onClick={onClose}>
      <div className="task-card" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <header className="task-card-header">
          <h2>Edit Task</h2>
          <button className="task-card-close" onClick={onClose}>✕</button>
        </header>

        {/* Title/Text */}
        <div className="task-card-field">
          <label>Task Description</label>
          <textarea
            className="task-card-textarea"
            value={editedTask.text || editedTask.title || ''}
            onChange={e => handleFieldChange('text', e.target.value)}
            rows={3}
          />
        </div>

        {/* Energy Level */}
        <div className="task-card-field">
          <label>Energy Level</label>
          <div className="task-card-energy">
            {ENERGY_LEVELS.map(level => (
              <button
                key={level.value}
                className={`task-card-energy-btn ${editedTask.energy_level === level.value ? 'active' : ''}`}
                style={{ '--energy-color': level.color }}
                onClick={() => handleFieldChange('energy_level', level.value)}
              >
                <span className="task-card-energy-icon">{level.icon}</span>
                <span>{level.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Time Estimate */}
        <div className="task-card-field">
          <label>⏱️ Time Estimate</label>
          <select
            className="task-card-select"
            value={editedTask.estimated_minutes || 30}
            onChange={e => handleFieldChange('estimated_minutes', parseInt(e.target.value))}
          >
            {TIME_ESTIMATES.map(time => (
              <option key={time.value} value={time.value}>{time.label}</option>
            ))}
          </select>
        </div>

        {/* Urgency */}
        <div className="task-card-field">
          <label>🚨 Urgency</label>
          <div className="task-card-urgency">
            {URGENCY_LEVELS.map(level => (
              <button
                key={level.value}
                className={`task-card-urgency-btn ${(editedTask.lane || 'later') === level.value ? 'active' : ''}`}
                style={{ '--urgency-color': level.color }}
                onClick={() => handleFieldChange('lane', level.value)}
              >
                <span>{level.icon}</span>
                <span>{level.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Labels */}
        <div className="task-card-field">
          <label>Labels</label>
          <div className="task-card-labels">
            {LABELS.map(label => (
              <button
                key={label.value}
                className={`task-card-label ${(editedTask.labels || []).includes(label.value) ? 'active' : ''}`}
                style={{ '--label-color': label.color }}
                onClick={() => toggleLabel(label.value)}
              >
                {label.label}
                {label.override && (
                  <span className="task-card-override-badge" title="Always takes priority">👑</span>
                )}
              </button>
            ))}
          </div>
          {hasFamilyOverride() && (
            <p className="task-card-override-note">
              🏠 Family tasks take priority over work conflicts
            </p>
          )}
        </div>

        {/* Assignee (for PA model) */}
        <div className="task-card-field">
          <label>Assignee</label>
          <select
            className="task-card-select"
            value={editedTask.assignee || 'dan'}
            onChange={e => handleFieldChange('assignee', e.target.value)}
          >
            <option value="dan">Dan</option>
            <option value="pa">Personal Assistant</option>
            <option value="mikka">Mikka</option>
          </select>
        </div>

        {/* Dependencies */}
        <div className="task-card-field">
          <label>Dependencies</label>
          <input
            type="text"
            className="task-card-input"
            placeholder="Waiting for..."
            value={editedTask.dependencies || ''}
            onChange={e => handleFieldChange('dependencies', e.target.value)}
          />
        </div>

        {/* Actions row */}
        <div className="task-card-actions-row">
          <button
            className={`task-card-action-btn ${editedTask.frozen ? 'active' : ''}`}
            onClick={handleFreeze}
          >
            {editedTask.frozen ? '🔓 Unfreeze' : '🔒 Freeze'}
          </button>
          <button
            className="task-card-action-btn danger"
            onClick={() => setShowConfirmArchive(true)}
          >
            📦 Archive
          </button>
        </div>

        {/* Archive confirmation */}
        {showConfirmArchive && (
          <div className="task-card-confirm">
            <p>Move to archive?</p>
            <div className="task-card-confirm-actions">
              <button onClick={handleArchive}>Yes</button>
              <button onClick={() => setShowConfirmArchive(false)}>No</button>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="task-card-footer">
          <button className="task-card-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="task-card-save"
            onClick={saveChanges}
            disabled={saving || editedFields.length === 0}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </footer>

        {/* Edit indicator */}
        {editedFields.length > 0 && (
          <div className="task-card-edit-indicator">
            ✏️ {editedFields.length} fields changed
          </div>
        )}
      </div>
    </div>
  );
}

export default TaskCard;

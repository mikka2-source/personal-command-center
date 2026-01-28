/**
 * PA Inbox Component
 * 
 * View for Personal Assistant showing:
 * - Tasks assigned to PA
 * - Status updates
 * - Mark done capability
 * 
 * PA Permissions:
 * - Can view: Tasks, Horizon, Goals (read-only)
 * - Can write: Task status, Mark done, Accept assignments
 * - Cannot access: Command, Brain, System rules
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import './PAInbox.css';

function PAInbox() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | pending | done

  const fetchTasks = useCallback(async () => {
    if (!isSupabaseConfigured()) { setLoading(false); return; }

    try {
      let query = supabase
        .from('tasks')
        .select('*')
        .eq('assignee', 'pa')
        .eq('archived', false)
        .order('created_at', { ascending: false });

      if (filter === 'pending') {
        query = query.eq('completed', false);
      } else if (filter === 'done') {
        query = query.eq('completed', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      setTasks(data || []);
    } catch (err) {
      console.error('PA fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const markDone = async (taskId) => {
    if (!isSupabaseConfigured()) return;

    try {
      await supabase
        .from('tasks')
        .update({
          completed: true,
          completed_at: new Date().toISOString(),
          closed_by: 'pa'
        })
        .eq('id', taskId);

      // Refresh list
      fetchTasks();
    } catch (err) {
      console.error('Mark done error:', err);
    }
  };

  const getEnergyIcon = (level) => {
    switch (level) {
      case 'low': return '🌙';
      case 'medium': return '☀️';
      case 'high': return '⚡';
      default: return '•';
    }
  };

  if (loading) {
    return (
      <div className="pa-inbox">
        <div className="pa-loading">Loading...</div>
      </div>
    );
  }

  const pendingCount = tasks.filter(t => !t.completed).length;

  return (
    <div className="pa-inbox">
      <header className="pa-header">
        <h1>📥 PA Inbox</h1>
        <span className="pa-badge">{pendingCount} pending</span>
      </header>

      <div className="pa-filters">
        <button
          className={`pa-filter ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button
          className={`pa-filter ${filter === 'pending' ? 'active' : ''}`}
          onClick={() => setFilter('pending')}
        >
          Pending
        </button>
        <button
          className={`pa-filter ${filter === 'done' ? 'active' : ''}`}
          onClick={() => setFilter('done')}
        >
          Completed
        </button>
      </div>

      {tasks.length === 0 ? (
        <div className="pa-empty">
          <p>No tasks in Inbox</p>
        </div>
      ) : (
        <div className="pa-tasks">
          {tasks.map(task => (
            <div key={task.id} className={`pa-task ${task.completed ? 'done' : ''}`}>
              <div className="pa-task-main">
                <span className="pa-task-energy">{getEnergyIcon(task.energy_level)}</span>
                <div className="pa-task-content">
                  <span className="pa-task-text">{task.text || task.title}</span>
                  {task.labels?.length > 0 && (
                    <div className="pa-task-labels">
                      {task.labels.map((label, i) => (
                        <span key={i} className="pa-task-label">{label}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {!task.completed && (
                <button
                  className="pa-task-done"
                  onClick={() => markDone(task.id)}
                >
                  ✓ Done
                </button>
              )}
              {task.completed && (
                <span className="pa-task-closed">
                  ✓ Closed by {task.closed_by || 'PA'}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PAInbox;

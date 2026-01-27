/**
 * Persistence layer with Supabase + localStorage fallback.
 * Single-user (Dan), no auth needed.
 * 
 * Tables: tasks, daily_focus, morning_routine, completed_tasks
 */
import { supabase, isSupabaseConfigured } from './supabaseClient';

const USER_ID = 'dan'; // Single user

// ─── localStorage helpers ───────────────────────────────────────
function localGet(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function localSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('localStorage write failed:', err);
  }
}

// ─── Tasks ──────────────────────────────────────────────────────

export async function loadTasks() {
  // Always load from localStorage first (instant)
  const local = localGet('pcc_tasks', { now: [], today: [], later: [] });

  if (!isSupabaseConfigured()) return local;

  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', USER_ID)
      .eq('completed', false)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Group by priority
    const tasks = { now: [], today: [], later: [] };
    (data || []).forEach(row => {
      const task = dbToTask(row);
      if (tasks[task.priority]) {
        tasks[task.priority].push(task);
      }
    });

    // Sync back to localStorage
    localSet('pcc_tasks', tasks);
    return tasks;
  } catch (err) {
    console.warn('Supabase tasks load failed, using localStorage:', err.message);
    return local;
  }
}

export async function saveTasks(tasks) {
  // Always save to localStorage
  localSet('pcc_tasks', tasks);

  if (!isSupabaseConfigured()) return;

  try {
    // Upsert all tasks
    const rows = [];
    for (const [priority, items] of Object.entries(tasks)) {
      items.forEach(task => {
        rows.push(taskToDb(task, priority));
      });
    }

    if (rows.length > 0) {
      const { error } = await supabase
        .from('tasks')
        .upsert(rows, { onConflict: 'id' });
      if (error) throw error;
    }
  } catch (err) {
    console.warn('Supabase tasks save failed:', err.message);
  }
}

export async function addTask(task, priority) {
  if (!isSupabaseConfigured()) return;

  try {
    const { error } = await supabase
      .from('tasks')
      .insert(taskToDb(task, priority));
    if (error) throw error;
  } catch (err) {
    console.warn('Supabase addTask failed:', err.message);
  }
}

export async function completeTask(task) {
  if (!isSupabaseConfigured()) return;

  try {
    // Mark as completed in tasks table
    const { error: updateErr } = await supabase
      .from('tasks')
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq('id', task.id);
    if (updateErr) throw updateErr;

    // Add to completed_tasks
    const { error: insertErr } = await supabase
      .from('completed_tasks')
      .insert({
        task_id: task.id,
        user_id: USER_ID,
        text: task.text,
        area: task.area || 'personal',
        completed_at: new Date().toISOString(),
        completed_date: new Date().toISOString().split('T')[0]
      });
    if (insertErr) throw insertErr;
  } catch (err) {
    console.warn('Supabase completeTask failed:', err.message);
  }
}

export async function restoreCompletedTask(taskId, priority = 'today') {
  if (!isSupabaseConfigured()) return;

  try {
    // Un-complete in tasks table
    await supabase
      .from('tasks')
      .update({ completed: false, completed_at: null })
      .eq('id', taskId);

    // Remove from completed_tasks
    await supabase
      .from('completed_tasks')
      .delete()
      .eq('task_id', taskId);
  } catch (err) {
    console.warn('Supabase restoreTask failed:', err.message);
  }
}

// ─── Daily Focus ────────────────────────────────────────────────

export async function loadDailyFocus() {
  const local = localGet('pcc_dailyFocus', null);
  if (!isSupabaseConfigured()) return local;

  try {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('daily_focus')
      .select('*')
      .eq('user_id', USER_ID)
      .eq('date', today)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    if (!data) return local;

    const focus = {
      id: data.id,
      text: data.text,
      area: data.area || 'personal',
      completed: data.completed || false,
      createdAt: data.created_at
    };

    localSet('pcc_dailyFocus', focus);
    return focus;
  } catch (err) {
    console.warn('Supabase dailyFocus load failed:', err.message);
    return local;
  }
}

export async function saveDailyFocus(focus) {
  localSet('pcc_dailyFocus', focus);
  if (!isSupabaseConfigured() || !focus) return;

  try {
    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase
      .from('daily_focus')
      .upsert({
        id: focus.id,
        user_id: USER_ID,
        date: today,
        text: focus.text,
        area: focus.area || 'personal',
        completed: focus.completed || false,
        created_at: focus.createdAt || new Date().toISOString()
      }, { onConflict: 'user_id,date' });
    if (error) throw error;
  } catch (err) {
    console.warn('Supabase saveDailyFocus failed:', err.message);
  }
}

// ─── Morning Routine ────────────────────────────────────────────

export async function loadMorningRoutine() {
  const defaultRoutine = {
    supplements: false,
    workout: false,
    protein: false,
    meditation: false
  };
  const local = localGet('pcc_morningRoutine', defaultRoutine);
  if (!isSupabaseConfigured()) return local;

  try {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('morning_routine')
      .select('*')
      .eq('user_id', USER_ID)
      .eq('date', today)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return local;

    const routine = {
      supplements: data.supplements || false,
      workout: data.workout || false,
      protein: data.protein || false,
      meditation: data.meditation || false
    };

    localSet('pcc_morningRoutine', routine);
    return routine;
  } catch (err) {
    console.warn('Supabase morningRoutine load failed:', err.message);
    return local;
  }
}

export async function saveMorningRoutine(routine) {
  localSet('pcc_morningRoutine', routine);
  if (!isSupabaseConfigured()) return;

  try {
    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase
      .from('morning_routine')
      .upsert({
        user_id: USER_ID,
        date: today,
        supplements: routine.supplements || false,
        workout: routine.workout || false,
        protein: routine.protein || false,
        meditation: routine.meditation || false
      }, { onConflict: 'user_id,date' });
    if (error) throw error;
  } catch (err) {
    console.warn('Supabase saveMorningRoutine failed:', err.message);
  }
}

// ─── Completed Tasks (today) ────────────────────────────────────

export async function loadCompletedToday() {
  const local = localGet('pcc_completedToday', []);
  if (!isSupabaseConfigured()) return local;

  try {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('completed_tasks')
      .select('*')
      .eq('user_id', USER_ID)
      .eq('completed_date', today)
      .order('completed_at', { ascending: true });

    if (error) throw error;

    const completed = (data || []).map(row => ({
      id: row.task_id,
      text: row.text,
      area: row.area || 'personal',
      done: true,
      completed: true,
      completedAt: row.completed_at
    }));

    localSet('pcc_completedToday', completed);
    return completed;
  } catch (err) {
    console.warn('Supabase completedToday load failed:', err.message);
    return local;
  }
}

export async function saveCompletedToday(items) {
  localSet('pcc_completedToday', items);
  // completed_tasks are managed via completeTask/restoreCompletedTask
}

// ─── DB <-> App Converters ──────────────────────────────────────

function taskToDb(task, priority) {
  return {
    id: task.id,
    user_id: USER_ID,
    text: task.text,
    area: task.area || 'personal',
    priority: priority,
    owner: task.owner || 'me',
    from_person: task.from || null,
    project: task.project || null,
    completed: task.completed || task.done || false,
    completed_at: task.completedAt || null,
    created_at: task.createdAt || new Date().toISOString()
  };
}

function dbToTask(row) {
  return {
    id: row.id,
    text: row.text,
    area: row.area || 'personal',
    priority: row.priority || 'today',
    owner: row.owner || 'me',
    from: row.from_person || null,
    project: row.project || null,
    completed: row.completed || false,
    done: row.completed || false,
    createdAt: row.created_at,
    completedAt: row.completed_at
  };
}

#!/usr/bin/env node
/**
 * Life OS Chat Parser — API Layer
 * 
 * Called by Mikka (AI) to persist parsed entities from chat.
 * Usage: node chat-parser.js <action> <json_data>
 * 
 * Actions:
 *   add-task       — Create a new task
 *   add-event      — Create a new event
 *   add-project    — Create/update a project
 *   add-goal       — Create a goal
 *   add-trip       — Create a trip
 *   add-dependency  — Track a dependency
 *   add-parking    — Send to שממה
 *   add-activity   — Log AI activity
 *   update-task    — Update task status
 *   update-project — Update project status
 *   resolve-dep    — Resolve a dependency
 *   get-state      — Get current system state (for decision making)
 *   get-tasks      — Get open tasks
 *   get-projects   — Get active projects
 *   get-deps       — Get pending dependencies
 *   get-parking    — Get שממה items
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://frbdzhddqbkuzwaqwvwi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyYmR6aGRkcWJrdXp3YXF3dndpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MTYxNzEsImV4cCI6MjA4NTA5MjE3MX0.yLOrB38FQ3F_6r7wpVq2z8aVdOjSFuea9nyqP6xzkKE';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const USER_ID = 'dan';

// ─── Actions ──────────────────────────────────────────

async function addTask(data) {
  const task = {
    id: data.id || `task-${Date.now()}`,
    user_id: USER_ID,
    text: data.text,
    area: data.area || 'personal',
    priority: 'today', // will be overridden by engine
    owner: data.owner || 'me',
    from_person: data.from || null,
    project: data.project || null,
    completed: false,
    deadline: data.deadline || null,
    dependency: data.dependency || null,
    task_type: data.type || 'manual',
    energy_cost: data.energy || 'mid',
    status: data.status || 'open',
    created_at: new Date().toISOString()
  };
  const { data: result, error } = await supabase.from('tasks').upsert(task, { onConflict: 'id' }).select();
  if (error) throw error;
  
  // Log activity
  await logActivity('task', `משימה חדשה: ${task.text}`, null, task.area);
  
  return result[0];
}

async function addEvent(data) {
  const event = {
    id: data.id || `evt-${Date.now()}`,
    user_id: USER_ID,
    source: 'chat',
    title: data.title,
    start_time: data.start_time || null,
    end_time: data.end_time || null,
    category: data.category || 'personal',
    energy_level: data.energy || 'mid',
    immutable: data.immutable !== false,
    location: data.location || null,
    metadata: data.metadata || {}
  };
  const { data: result, error } = await supabase.from('events').upsert(event, { onConflict: 'id' }).select();
  if (error) throw error;
  
  await logActivity('event', `אירוע: ${event.title}`, null, event.category);
  return result[0];
}

async function addProject(data) {
  // Check max 3 active projects
  const { count } = await supabase.from('projects').select('*', { count: 'exact', head: true })
    .eq('user_id', USER_ID).eq('status', 'active');
  
  const status = data.status || 'idea';
  if (status === 'active' && count >= 3) {
    throw new Error(`⛔ מקסימום 3 פרויקטים פעילים. יש כרגע ${count}. צריך להקפיא אחד קודם.`);
  }
  
  const project = {
    id: data.id || `proj-${Date.now()}`,
    user_id: USER_ID,
    title: data.title,
    status: status,
    domain: data.domain || 'work',
    goal_link: data.goal || null,
    required_energy: data.energy || 'mid',
    dependencies: data.dependencies || [],
    notes: data.notes || null,
    updated_at: new Date().toISOString()
  };
  const { data: result, error } = await supabase.from('projects').upsert(project, { onConflict: 'id' }).select();
  if (error) throw error;
  
  await logActivity('project', `פרויקט ${status === 'active' ? 'הופעל' : 'נוצר'}: ${project.title}`, null, project.domain);
  return result[0];
}

async function addGoal(data) {
  const goal = {
    id: data.id || `goal-${Date.now()}`,
    user_id: USER_ID,
    title: data.title,
    domain: data.domain || 'personal',
    priority: data.priority || 5,
    metrics: data.metrics || {},
    protection_rules: data.protection_rules || [],
    status: 'active'
  };
  const { data: result, error } = await supabase.from('goals').upsert(goal, { onConflict: 'id' }).select();
  if (error) throw error;
  
  await logActivity('goal', `יעד חדש: ${goal.title}`, null, goal.domain);
  return result[0];
}

async function addTrip(data) {
  const trip = {
    id: data.id || `trip-${Date.now()}`,
    user_id: USER_ID,
    title: data.title,
    location: data.location || null,
    start_date: data.start_date,
    end_date: data.end_date,
    prep_tasks: data.prep_tasks || [],
    cooldown_days: data.cooldown_days || 1,
    metadata: data.metadata || {}
  };
  const { data: result, error } = await supabase.from('trips').upsert(trip, { onConflict: 'id' }).select();
  if (error) throw error;
  
  await logActivity('trip', `נסיעה: ${trip.title} (${trip.location})`, null, 'travel');
  return result[0];
}

async function addDependency(data) {
  const dep = {
    user_id: USER_ID,
    task_id: data.task_id || null,
    waiting_on: data.waiting_on,
    waiting_for: data.waiting_for || null,
    direction: data.direction || 'them',
    status: 'waiting'
  };
  const { data: result, error } = await supabase.from('dependencies').insert(dep).select();
  if (error) throw error;
  
  const dirText = dep.direction === 'me' ? 'אני חייב ל' : 'מחכה ל';
  await logActivity('dependency', `${dirText}${dep.waiting_on}: ${dep.waiting_for || ''}`, null, 'work');
  return result[0];
}

async function addParking(data) {
  const item = {
    id: data.id || `park-${Date.now()}`,
    user_id: USER_ID,
    text: data.text,
    source: data.source || 'chat',
    domain: data.domain || null
  };
  const { data: result, error } = await supabase.from('parking').insert(item).select();
  if (error) throw error;
  return result[0];
}

async function updateTask(data) {
  const updates = {};
  if (data.status) updates.status = data.status;
  if (data.completed !== undefined) {
    updates.completed = data.completed;
    if (data.completed) updates.completed_at = new Date().toISOString();
  }
  if (data.text) updates.text = data.text;
  if (data.deadline) updates.deadline = data.deadline;
  if (data.dependency) updates.dependency = data.dependency;
  
  const { data: result, error } = await supabase.from('tasks')
    .update(updates).eq('id', data.id).select();
  if (error) throw error;
  
  if (data.completed) {
    // Also add to completed_tasks
    const task = result[0];
    await supabase.from('completed_tasks').insert({
      task_id: task.id, user_id: USER_ID, text: task.text, area: task.area
    });
    await logActivity('task', `✅ הושלם: ${task.text}`, null, task.area);
  }
  return result[0];
}

async function updateProject(data) {
  if (data.status === 'active') {
    const { count } = await supabase.from('projects').select('*', { count: 'exact', head: true })
      .eq('user_id', USER_ID).eq('status', 'active').neq('id', data.id);
    if (count >= 3) throw new Error(`⛔ מקסימום 3 פרויקטים פעילים.`);
  }
  
  const updates = { updated_at: new Date().toISOString() };
  if (data.status) updates.status = data.status;
  if (data.notes) updates.notes = data.notes;
  if (data.title) updates.title = data.title;
  
  const { data: result, error } = await supabase.from('projects')
    .update(updates).eq('id', data.id).select();
  if (error) throw error;
  return result[0];
}

async function resolveDep(data) {
  const { data: result, error } = await supabase.from('dependencies')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('id', data.id).select();
  if (error) throw error;
  return result[0];
}

// ─── Read State ──────────────────────────────────────

async function getState() {
  const [tasks, projects, deps, parking, health, briefs] = await Promise.all([
    supabase.from('tasks').select('*').eq('user_id', USER_ID).eq('completed', false).order('created_at'),
    supabase.from('projects').select('*').eq('user_id', USER_ID).in('status', ['active', 'idea']).order('updated_at', { ascending: false }),
    supabase.from('dependencies').select('*').eq('user_id', USER_ID).eq('status', 'waiting').order('created_at'),
    supabase.from('parking').select('*').eq('user_id', USER_ID).order('created_at', { ascending: false }).limit(20),
    supabase.from('health_data').select('*').eq('user_id', USER_ID).order('date', { ascending: false }).limit(7),
    supabase.from('daily_briefs').select('*').eq('user_id', USER_ID).order('date', { ascending: false }).limit(1)
  ]);
  
  return {
    tasks: tasks.data || [],
    projects: projects.data || [],
    active_projects: (projects.data || []).filter(p => p.status === 'active').length,
    max_projects: 3,
    dependencies: deps.data || [],
    parking: parking.data || [],
    health: health.data || [],
    latest_brief: briefs.data?.[0] || null
  };
}

async function getTasks() {
  const { data } = await supabase.from('tasks').select('*')
    .eq('user_id', USER_ID).eq('completed', false).order('created_at');
  return data || [];
}

async function getProjects() {
  const { data } = await supabase.from('projects').select('*')
    .eq('user_id', USER_ID).in('status', ['active', 'idea', 'frozen']).order('updated_at', { ascending: false });
  return data || [];
}

async function getDeps() {
  const { data } = await supabase.from('dependencies').select('*')
    .eq('user_id', USER_ID).eq('status', 'waiting').order('created_at');
  return data || [];
}

async function getParking() {
  const { data } = await supabase.from('parking').select('*')
    .eq('user_id', USER_ID).order('created_at', { ascending: false });
  return data || [];
}

// ─── Activity Log ─────────────────────────────────────

async function logActivity(type, title, description, area) {
  await supabase.from('ai_activity').insert({
    user_id: USER_ID,
    type: type,
    title: title,
    description: description || null,
    area: area || 'personal'
  });
}

// ─── CLI Runner ───────────────────────────────────────

const actions = {
  'add-task': addTask,
  'add-event': addEvent,
  'add-project': addProject,
  'add-goal': addGoal,
  'add-trip': addTrip,
  'add-dependency': addDependency,
  'add-parking': addParking,
  'add-activity': (d) => logActivity(d.type, d.title, d.description, d.area),
  'update-task': updateTask,
  'update-project': updateProject,
  'resolve-dep': resolveDep,
  'get-state': getState,
  'get-tasks': getTasks,
  'get-projects': getProjects,
  'get-deps': getDeps,
  'get-parking': getParking,
};

async function main() {
  const action = process.argv[2];
  const jsonArg = process.argv[3];
  
  if (!action || !actions[action]) {
    console.log('Available actions:', Object.keys(actions).join(', '));
    process.exit(1);
  }
  
  const data = jsonArg ? JSON.parse(jsonArg) : {};
  
  try {
    const result = await actions[action](data);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();

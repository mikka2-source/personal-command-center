/**
 * Mikka API Layer
 * Clean interface for the AI (Mikka) to interact with Dan's Life OS.
 * All functions use Supabase with localStorage fallback.
 * 
 * Usage from AI: Call these via Supabase REST API or import directly.
 * 
 * ## API Reference
 * 
 * ### Activity Feed
 * - addActivity({ type, title, description, area, link, metadata })
 *   Types: task, deploy, research, conversation, insight, alert
 * 
 * ### Tasks
 * - createTask({ text, area, priority, owner, from, project })
 * - completeTaskById(taskId)
 * 
 * ### Insights
 * - addInsight({ type, title, description, area, priority, action_url })
 *   Types: insight, alert, reminder, suggestion
 *   Priority: low, normal, high, urgent
 * 
 * ### Life Areas
 * - updateAreaStatus(areaId, { status, notes })
 *   Status: normal, attention, good, urgent
 * 
 * ### People
 * - addPerson({ name, company, role, area, notes })
 * - updateFollowup(personId, nextDate)
 */

import { supabase, isSupabaseConfigured } from './supabaseClient';

const USER_ID = 'dan';

// ─── Activity Feed ──────────────────────────────────────────────

export async function addActivity({ type, title, description, area = 'personal', link = null, metadata = {} }) {
  if (!isSupabaseConfigured()) {
    // localStorage fallback
    const activities = JSON.parse(localStorage.getItem('pcc_activities') || '[]');
    activities.unshift({
      id: Date.now(),
      user_id: USER_ID,
      timestamp: new Date().toISOString(),
      type, title, description, area, link, metadata,
      read: false
    });
    localStorage.setItem('pcc_activities', JSON.stringify(activities.slice(0, 100)));
    return;
  }

  try {
    const { error } = await supabase.from('ai_activity').insert({
      user_id: USER_ID, type, title, description, area, link, metadata
    });
    if (error) throw error;
  } catch (err) {
    console.warn('addActivity failed:', err.message);
  }
}

export async function loadActivities(limit = 50) {
  const local = JSON.parse(localStorage.getItem('pcc_activities') || '[]');
  if (!isSupabaseConfigured()) return local;

  try {
    const { data, error } = await supabase
      .from('ai_activity')
      .select('*')
      .eq('user_id', USER_ID)
      .order('timestamp', { ascending: false })
      .limit(limit);
    if (error) throw error;
    localStorage.setItem('pcc_activities', JSON.stringify(data || []));
    return data || [];
  } catch (err) {
    console.warn('loadActivities failed:', err.message);
    return local;
  }
}

export async function markActivityRead(activityId) {
  if (!isSupabaseConfigured()) return;
  try {
    await supabase.from('ai_activity').update({ read: true }).eq('id', activityId);
  } catch (err) {
    console.warn('markActivityRead failed:', err.message);
  }
}

// ─── Life Areas ─────────────────────────────────────────────────

export async function loadLifeAreas() {
  const defaultAreas = [
    { id: 'work', name: 'XBO', icon: '💼', color: '#3b82f6', status: 'normal' },
    { id: 'realestate', name: 'DSP Properties', icon: '🏢', color: '#10b981', status: 'normal' },
    { id: 'family', name: 'Family', icon: '👨‍👩‍👧', color: '#f59e0b', status: 'normal' },
    { id: 'health', name: 'Health & Fitness', icon: '💪', color: '#22c55e', status: 'normal' },
    { id: 'salon', name: 'Beauty Salon', icon: '💅', color: '#ec4899', status: 'normal' },
    { id: 'fluidity', name: 'FLUIDITY/KEEPER', icon: '🔗', color: '#8b5cf6', status: 'normal' },
    { id: 'development', name: 'Personal Development', icon: '📚', color: '#06b6d4', status: 'normal' },
    { id: 'investments', name: 'Investments', icon: '📊', color: '#f97316', status: 'normal' }
  ];

  const local = JSON.parse(localStorage.getItem('pcc_lifeAreas') || 'null') || defaultAreas;
  if (!isSupabaseConfigured()) return local;

  try {
    const { data, error } = await supabase
      .from('life_areas')
      .select('*')
      .eq('user_id', USER_ID);
    if (error) throw error;
    if (!data || data.length === 0) return defaultAreas;
    localStorage.setItem('pcc_lifeAreas', JSON.stringify(data));
    return data;
  } catch (err) {
    console.warn('loadLifeAreas failed:', err.message);
    return local;
  }
}

export async function updateAreaStatus(areaId, updates) {
  if (!isSupabaseConfigured()) return;
  try {
    const { error } = await supabase
      .from('life_areas')
      .update({ ...updates, last_activity: new Date().toISOString() })
      .eq('id', areaId);
    if (error) throw error;
  } catch (err) {
    console.warn('updateAreaStatus failed:', err.message);
  }
}

// ─── Insights ───────────────────────────────────────────────────

export async function addInsight({ type, title, description, area, priority = 'normal', action_url = null }) {
  if (!isSupabaseConfigured()) {
    const insights = JSON.parse(localStorage.getItem('pcc_insights') || '[]');
    insights.unshift({
      id: Date.now(), user_id: USER_ID, timestamp: new Date().toISOString(),
      type, title, description, area, priority, dismissed: false, action_url
    });
    localStorage.setItem('pcc_insights', JSON.stringify(insights.slice(0, 50)));
    return;
  }

  try {
    const { error } = await supabase.from('insights').insert({
      user_id: USER_ID, type, title, description, area, priority, action_url
    });
    if (error) throw error;
  } catch (err) {
    console.warn('addInsight failed:', err.message);
  }
}

export async function loadInsights(limit = 20) {
  const local = JSON.parse(localStorage.getItem('pcc_insights') || '[]');
  if (!isSupabaseConfigured()) return local;

  try {
    const { data, error } = await supabase
      .from('insights')
      .select('*')
      .eq('user_id', USER_ID)
      .eq('dismissed', false)
      .order('timestamp', { ascending: false })
      .limit(limit);
    if (error) throw error;
    localStorage.setItem('pcc_insights', JSON.stringify(data || []));
    return data || [];
  } catch (err) {
    console.warn('loadInsights failed:', err.message);
    return local;
  }
}

export async function dismissInsight(insightId) {
  if (!isSupabaseConfigured()) return;
  try {
    await supabase.from('insights').update({ dismissed: true }).eq('id', insightId);
  } catch (err) {
    console.warn('dismissInsight failed:', err.message);
  }
}

// ─── People ─────────────────────────────────────────────────────

export async function loadPeople() {
  const local = JSON.parse(localStorage.getItem('pcc_people') || '[]');
  if (!isSupabaseConfigured()) return local;

  try {
    const { data, error } = await supabase
      .from('people')
      .select('*')
      .eq('user_id', USER_ID)
      .order('last_contact', { ascending: false });
    if (error) throw error;
    localStorage.setItem('pcc_people', JSON.stringify(data || []));
    return data || [];
  } catch (err) {
    console.warn('loadPeople failed:', err.message);
    return local;
  }
}

export async function addPerson({ name, company, role, area = 'work', notes = '' }) {
  if (!isSupabaseConfigured()) return;
  try {
    const { error } = await supabase.from('people').insert({
      user_id: USER_ID, name, company, role, area, notes,
      last_contact: new Date().toISOString()
    });
    if (error) throw error;
  } catch (err) {
    console.warn('addPerson failed:', err.message);
  }
}

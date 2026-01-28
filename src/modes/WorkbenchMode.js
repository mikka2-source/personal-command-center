import React, { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './WorkbenchMode.css';

// ─── Sortable Item ───
function SortableItem({ id, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 0,
  };

  return (
    <div ref={setNodeRef} style={style} className="wb-item" {...attributes}>
      <div className="wb-drag-handle" {...listeners}>⠿</div>
      {children}
    </div>
  );
}

// ─── Area Map ───
const AREA_MAP = {
  work: { label: 'XBO', color: '#3b82f6' },
  realestate: { label: 'נדל"ן', color: '#10b981' },
  health: { label: 'בריאות', color: '#22c55e' },
  family: { label: 'משפחה', color: '#f59e0b' },
  salon: { label: 'סלון', color: '#ec4899' },
  personal: { label: 'אישי', color: '#8b5cf6' },
  investments: { label: 'השקעות', color: '#6366f1' },
  sport: { label: 'ספורט', color: '#22c55e' },
  travel: { label: 'נסיעות', color: '#f97316' },
};

function getArea(a) {
  if (!a) return { label: '—', color: '#a8a29e' };
  return AREA_MAP[a] || AREA_MAP[a?.toLowerCase()] || { label: a, color: '#a8a29e' };
}

function WorkbenchMode() {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [dependencies, setDependencies] = useState([]);
  const [parking, setParking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tasks');
  const [completingTasks, setCompletingTasks] = useState(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured()) { setLoading(false); return; }
    try {
      const [tasksRes, projRes, depsRes, parkRes] = await Promise.all([
        supabase.from('tasks').select('*').eq('completed', false).order('derived_priority', { ascending: false }),
        supabase.from('projects').select('*').in('status', ['active', 'idea', 'frozen']).order('updated_at', { ascending: false }),
        supabase.from('dependencies').select('*').eq('status', 'waiting').order('created_at', { ascending: false }),
        supabase.from('parking').select('*').order('created_at', { ascending: false }),
      ]);

      if (tasksRes.data) setTasks(tasksRes.data);
      if (projRes.data) setProjects(projRes.data);
      if (depsRes.data) setDependencies(depsRes.data);
      if (parkRes.data) setParking(parkRes.data);
    } catch (err) {
      console.error('Workbench fetch error:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    if (activeTab === 'tasks') {
      setTasks((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    } else if (activeTab === 'parking') {
      setParking((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const completeTask = async (taskId) => {
    setCompletingTasks(prev => new Set([...prev, taskId]));
    try {
      if (isSupabaseConfigured()) {
        await supabase.from('tasks').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', taskId);
      }
      setTimeout(() => {
        setTasks(prev => prev.filter(t => t.id !== taskId));
        setCompletingTasks(prev => { const n = new Set(prev); n.delete(taskId); return n; });
      }, 300);
    } catch (err) {
      console.error('Complete error:', err);
      setCompletingTasks(prev => { const n = new Set(prev); n.delete(taskId); return n; });
    }
  };

  const resolveDep = async (depId) => {
    try {
      if (isSupabaseConfigured()) {
        await supabase.from('dependencies').update({ status: 'resolved' }).eq('id', depId);
      }
      setDependencies(prev => prev.filter(d => d.id !== depId));
    } catch (err) {
      console.error('Resolve dep error:', err);
    }
  };

  const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const days = Math.round((Date.now() - new Date(dateStr)) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'היום';
    if (days === 1) return 'אתמול';
    return `${days} ימים`;
  };

  const TABS = [
    { id: 'tasks', label: 'משימות', count: tasks.length, icon: '📋' },
    { id: 'projects', label: 'פרויקטים', count: projects.length, icon: '🚀' },
    { id: 'dependencies', label: 'תלויות', count: dependencies.length, icon: '🔗' },
    { id: 'parking', label: 'שממה', count: parking.length, icon: '🏜️' },
  ];

  if (loading) {
    return (
      <div className="wb">
        <div className="wb-loading">
          <div className="wb-pulse" />
          <span>טוען...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="wb">
      <div className="wb-container">
        <header className="wb-header">
          <h1>🔧 Workbench</h1>
          <p className="wb-sub">תחזוקה, סידור, סקירה שבועית</p>
        </header>

        {/* Tabs */}
        <div className="wb-tabs">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`wb-tab ${activeTab === tab.id ? 'wb-tab-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              <span className="wb-tab-count">{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Tasks */}
        {activeTab === 'tasks' && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
              <div className="wb-list">
                {tasks.length === 0 && <p className="wb-empty">אין משימות פתוחות ✨</p>}
                {tasks.map(task => {
                  const area = getArea(task.area);
                  const isCompleting = completingTasks.has(task.id);
                  return (
                    <SortableItem key={task.id} id={task.id}>
                      <button
                        className={`wb-checkbox ${isCompleting ? 'completing' : ''}`}
                        onClick={() => completeTask(task.id)}
                        disabled={isCompleting}
                      >
                        {isCompleting ? '✓' : ''}
                      </button>
                      <div className="wb-item-content">
                        <span className={`wb-item-text ${isCompleting ? 'done' : ''}`}>{task.text}</span>
                        <div className="wb-item-meta">
                          {task.deadline && (
                            <span className="wb-meta-tag">⏰ {new Date(task.deadline).toLocaleDateString('he-IL')}</span>
                          )}
                          {task.from_person && (
                            <span className="wb-meta-tag">מ: {task.from_person}</span>
                          )}
                          {task.energy_cost && (
                            <span className={`wb-meta-tag energy-${task.energy_cost}`}>{task.energy_cost}</span>
                          )}
                        </div>
                      </div>
                      <div className="wb-area-tag" style={{ background: area.color + '15', color: area.color }}>
                        {area.label}
                      </div>
                    </SortableItem>
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {/* Projects */}
        {activeTab === 'projects' && (
          <div className="wb-list">
            {projects.length === 0 && <p className="wb-empty">אין פרויקטים</p>}
            {projects.map(project => {
              const area = getArea(project.domain);
              return (
                <div key={project.id} className="wb-item">
                  <div className={`wb-status-dot status-${project.status}`} />
                  <div className="wb-item-content">
                    <span className="wb-item-text">{project.title}</span>
                    <div className="wb-item-meta">
                      <span className={`wb-status-label status-${project.status}`}>
                        {project.status === 'active' ? 'פעיל' : project.status === 'idea' ? 'רעיון' : project.status === 'frozen' ? 'מוקפא' : project.status}
                      </span>
                      {project.notes && <span className="wb-meta-tag">{project.notes}</span>}
                    </div>
                  </div>
                  <div className="wb-area-tag" style={{ background: area.color + '15', color: area.color }}>
                    {area.label}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Dependencies */}
        {activeTab === 'dependencies' && (
          <div className="wb-list">
            {dependencies.length === 0 && <p className="wb-empty">אין תלויות פתוחות ✨</p>}
            {dependencies.map(dep => {
              const days = Math.round((Date.now() - new Date(dep.created_at)) / (1000 * 60 * 60 * 24));
              const isStale = days > 5;
              return (
                <div key={dep.id} className={`wb-item ${isStale ? 'wb-item-stale' : ''}`}>
                  <span className="wb-dep-icon">{dep.direction === 'them' ? '⏳' : '📤'}</span>
                  <div className="wb-item-content">
                    <span className="wb-item-text">
                      {dep.direction === 'them' ? `מחכה ל${dep.waiting_on}` : `אני חייב ל${dep.waiting_on}`}
                    </span>
                    <div className="wb-item-meta">
                      <span className="wb-meta-tag">{dep.waiting_for}</span>
                      <span className={`wb-meta-tag ${isStale ? 'stale' : ''}`}>{timeAgo(dep.created_at)}</span>
                    </div>
                  </div>
                  <button className="wb-resolve-btn" onClick={() => resolveDep(dep.id)} title="סיים תלות">
                    ✓
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Parking / שממה */}
        {activeTab === 'parking' && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={parking.map(p => p.id)} strategy={verticalListSortingStrategy}>
              <div className="wb-list">
                {parking.length === 0 && <p className="wb-empty">שממה ריקה</p>}
                {parking.map(item => {
                  const area = getArea(item.domain);
                  return (
                    <SortableItem key={item.id} id={item.id}>
                      <div className="wb-item-content">
                        <span className="wb-item-text">{item.text}</span>
                        <div className="wb-item-meta">
                          <span className="wb-meta-tag">{timeAgo(item.created_at)}</span>
                        </div>
                      </div>
                      <div className="wb-area-tag" style={{ background: area.color + '15', color: area.color }}>
                        {area.label}
                      </div>
                    </SortableItem>
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}

export default WorkbenchMode;

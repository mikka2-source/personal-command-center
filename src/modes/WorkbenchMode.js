import React, { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { toast } from '../components/ui/use-toast';
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

// Golden Components
import {
  ListRow,
  ListContainer,
  Modal,
  Button,
  Badge,
  Input,
  Textarea,
} from '../components/golden';

import './WorkbenchMode.css';

// ─── Sortable Wrapper for ListRow ───
function SortableListRow({ id, children, ...props }) {
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
    <div ref={setNodeRef} style={style} {...attributes}>
      <div className="flex items-center">
        <div className="wb-drag-handle cursor-grab px-2 text-muted-foreground opacity-40 hover:opacity-80" {...listeners}>
          ⠿
        </div>
        <div className="flex-1">
          <ListRow id={id} {...props}>
            {children}
          </ListRow>
        </div>
      </div>
    </div>
  );
}

// ─── Area Map ───
const AREA_MAP = {
  work: { label: 'XBO', color: '#3b82f6' },
  realestate: { label: 'Real Estate', color: '#10b981' },
  health: { label: 'Health', color: '#22c55e' },
  family: { label: 'Family', color: '#f59e0b' },
  salon: { label: 'Salon', color: '#ec4899' },
  personal: { label: 'Personal', color: '#8b5cf6' },
  investments: { label: 'Investments', color: '#6366f1' },
  sport: { label: 'Sport', color: '#22c55e' },
  travel: { label: 'Travel', color: '#f97316' },
};

function getArea(a) {
  if (!a) return { label: '—', color: '#a8a29e' };
  return AREA_MAP[a] || AREA_MAP[a?.toLowerCase()] || { label: a, color: '#a8a29e' };
}

// ─── Energy Levels ───
const ENERGY_LEVELS = [
  { value: 'low', label: 'Low', icon: '🌙', color: '#22c55e' },
  { value: 'medium', label: 'Medium', icon: '☀️', color: '#f59e0b' },
  { value: 'high', label: 'High', icon: '⚡', color: '#ef4444' }
];

// ─── Labels ───
const LABELS = [
  { value: 'work', label: 'Work', color: '#6366f1' },
  { value: 'family', label: 'Family', color: '#ec4899', override: true },
  { value: 'health', label: 'Health', color: '#22c55e' },
  { value: 'personal', label: 'Personal', color: '#8b5cf6' },
  { value: 'urgent', label: 'Urgent', color: '#ef4444' },
  { value: 'waiting', label: 'Waiting', color: '#64748b' }
];

// ─── Edit Modal Content ───
function EditModalContent({ item, type, onChange, onArchive, onFreeze }) {
  const hasFamilyOverride = () => (item.labels || []).includes('family');

  const toggleLabel = (labelValue) => {
    const currentLabels = item.labels || [];
    const newLabels = currentLabels.includes(labelValue)
      ? currentLabels.filter(l => l !== labelValue)
      : [...currentLabels, labelValue];
    onChange('labels', newLabels);
  };

  return (
    <div className="space-y-4">
      {/* Title/Text */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Description</label>
        <Textarea
          value={item.text || item.title || ''}
          onChange={e => onChange('text', e.target.value)}
          rows={3}
          className="resize-none"
        />
      </div>

      {/* Energy Level */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Energy Level</label>
        <div className="flex gap-2">
          {ENERGY_LEVELS.map(level => (
            <button
              key={level.value}
              onClick={() => onChange('energy_level', level.value)}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg border transition-colors ${
                item.energy_level === level.value 
                  ? 'border-primary bg-primary/10' 
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <span>{level.icon}</span>
              <span className="text-sm">{level.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Labels */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Labels</label>
        <div className="flex flex-wrap gap-2">
          {LABELS.map(label => (
            <button
              key={label.value}
              onClick={() => toggleLabel(label.value)}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                (item.labels || []).includes(label.value)
                  ? 'text-white'
                  : 'border border-border hover:border-primary/50'
              }`}
              style={{
                backgroundColor: (item.labels || []).includes(label.value) ? label.color : 'transparent',
                color: (item.labels || []).includes(label.value) ? 'white' : undefined
              }}
            >
              {label.label}
              {label.override && <span className="ml-1" title="Always takes priority">👑</span>}
            </button>
          ))}
        </div>
        {hasFamilyOverride() && (
          <p className="text-sm text-muted-foreground">
            🏠 Family tasks take priority over work conflicts
          </p>
        )}
      </div>

      {/* Assignee */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Assignee</label>
        <select
          className="w-full h-10 px-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          value={item.assignee || 'dan'}
          onChange={e => onChange('assignee', e.target.value)}
        >
          <option value="dan">Dan</option>
          <option value="pa">Personal Assistant</option>
          <option value="mikka">Mikka</option>
        </select>
      </div>

      {/* Dependencies */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Dependencies</label>
        <Input
          placeholder="Waiting for..."
          value={item.dependencies || ''}
          onChange={e => onChange('dependencies', e.target.value)}
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 pt-2">
        <Button
          variant={item.frozen ? "default" : "outline"}
          onClick={onFreeze}
          className="flex-1"
        >
          {item.frozen ? '🔓 Unfreeze' : '🔒 Freeze'}
        </Button>
        <Button
          variant="destructive"
          onClick={onArchive}
          className="flex-1"
        >
          📦 Archive
        </Button>
      </div>
    </div>
  );
}

function WorkbenchMode() {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [dependencies, setDependencies] = useState([]);
  const [parking, setParking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tasks');
  const [completingTasks, setCompletingTasks] = useState(new Set());
  
  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editType, setEditType] = useState(null);
  const [editedFields, setEditedFields] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

  // Selection state using Golden hook (reserved for future use)
  // const taskSelection = useListSelection(tasks);

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
        const { error } = await supabase.from('tasks').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', taskId);
        if (error) throw error;
      }
      setTimeout(() => {
        setTasks(prev => prev.filter(t => t.id !== taskId));
        setCompletingTasks(prev => { const n = new Set(prev); n.delete(taskId); return n; });
      }, 300);
      toast({ title: "✓ Task completed" });
    } catch (err) {
      console.error('Complete error:', err);
      setCompletingTasks(prev => { const n = new Set(prev); n.delete(taskId); return n; });
      toast({ title: "Failed to complete task", variant: "destructive" });
    }
  };

  const resolveDep = async (depId) => {
    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('dependencies').update({ status: 'resolved' }).eq('id', depId);
        if (error) throw error;
      }
      setDependencies(prev => prev.filter(d => d.id !== depId));
      toast({ title: "✓ Dependency resolved" });
    } catch (err) {
      console.error('Resolve dep error:', err);
      toast({ title: "Failed to resolve dependency", variant: "destructive" });
    }
  };

  const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const days = Math.round((Date.now() - new Date(dateStr)) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days`;
  };

  // ─── Edit Modal Logic ───
  const openEditModal = (item, type) => {
    setEditingItem({ ...item });
    setEditType(type);
    setEditedFields([]);
    setShowArchiveConfirm(false);
    setEditModalOpen(true);
  };

  const handleFieldChange = (field, value) => {
    setEditingItem(prev => ({ ...prev, [field]: value }));
    if (!editedFields.includes(field)) {
      setEditedFields(prev => [...prev, field]);
    }
  };

  const handleSaveEdit = async () => {
    if (!isSupabaseConfigured() || !editingItem) return;
    setSaving(true);

    const table = editType === 'task' ? 'tasks' : editType === 'project' ? 'projects' : 'parking';
    const hasFamilyOverride = (editingItem.labels || []).includes('family');

    try {
      // Log correction signal for learning
      if (editedFields.length > 0) {
        await supabase.from('correction_signals').insert({
          user_id: 'dan',
          entity_type: editType,
          entity_id: editingItem.id,
          corrections: editedFields.map(field => ({
            field,
            corrected: editingItem[field],
            timestamp: new Date().toISOString()
          })),
          created_at: new Date().toISOString()
        });
      }

      // Update the item
      const updateData = {
        text: editingItem.text,
        labels: editingItem.labels,
        energy_level: editingItem.energy_level,
        frozen: editingItem.frozen,
        archived: editingItem.archived,
        assignee: editingItem.assignee,
        dependencies: editingItem.dependencies,
        family_override: hasFamilyOverride,
        updated_at: new Date().toISOString()
      };

      if (editType === 'project') {
        updateData.title = editingItem.text || editingItem.title;
        updateData.status = editingItem.frozen ? 'frozen' : 'active';
      }

      const { error } = await supabase.from(table).update(updateData).eq('id', editingItem.id);
      if (error) throw error;
      
      toast({ title: "✓ Saved", description: `${editType.charAt(0).toUpperCase() + editType.slice(1)} updated` });
      
      // Refresh data
      fetchAll();
      setEditModalOpen(false);
    } catch (err) {
      console.error('Save edit error:', err);
      toast({ title: "Save failed", description: "Could not save changes. Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    handleFieldChange('archived', true);
    setShowArchiveConfirm(false);
    await handleSaveEdit();
  };

  const handleFreeze = () => {
    handleFieldChange('frozen', !editingItem?.frozen);
  };

  // ─── Bulk Actions (reserved for future use) ───
  // const bulkCompleteTasks = async () => {
  //   const ids = taskSelection.selectedIds;
  //   for (const id of ids) {
  //     await completeTask(id);
  //   }
  //   taskSelection.clearSelection();
  // };

  const TABS = [
    { id: 'tasks', label: 'Tasks', count: tasks.length, icon: '📋' },
    { id: 'projects', label: 'Projects', count: projects.length, icon: '🚀' },
    { id: 'dependencies', label: 'Dependencies', count: dependencies.length, icon: '🔗' },
    { id: 'parking', label: 'Parking', count: parking.length, icon: '🏜️' },
  ];

  if (loading) {
    return (
      <div className="wb">
        <div className="wb-loading">
          <div className="wb-pulse" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="wb">
      <div className="wb-container">
        <header className="wb-header">
          <h1>🔧 Workbench</h1>
          <p className="wb-sub">Maintenance, organization, weekly review</p>
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

        {/* Tasks Tab */}
        {activeTab === 'tasks' && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
              <ListContainer
                emptyState="No open tasks ✨"
              >
                {tasks.map(task => {
                  const area = getArea(task.area);
                  const isCompleting = completingTasks.has(task.id);
                  return (
                    <SortableListRow
                      key={task.id}
                      id={task.id}
                      onEdit={(id) => openEditModal(task, 'task')}
                      disabled={isCompleting}
                      className={isCompleting ? 'opacity-50' : ''}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <button
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                            isCompleting 
                              ? 'bg-green-500 border-green-500 text-white' 
                              : 'border-border hover:border-green-500 hover:bg-green-500/10'
                          }`}
                          onClick={(e) => { e.stopPropagation(); completeTask(task.id); }}
                          disabled={isCompleting}
                        >
                          {isCompleting && '✓'}
                        </button>
                        <div className="flex-1 min-w-0">
                          <span className={`font-medium ${isCompleting ? 'line-through text-muted-foreground' : ''}`}>
                            {task.text}
                          </span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {task.deadline && (
                              <span className="text-xs text-muted-foreground">
                                ⏰ {new Date(task.deadline).toLocaleDateString('en-US')}
                              </span>
                            )}
                            {task.from_person && (
                              <span className="text-xs text-muted-foreground">From: {task.from_person}</span>
                            )}
                            {task.energy_cost && (
                              <Badge variant={task.energy_cost === 'high' ? 'destructive' : task.energy_cost === 'medium' ? 'warning' : 'secondary'}>
                                {task.energy_cost}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Badge 
                          variant="outline"
                          style={{ backgroundColor: area.color + '15', color: area.color, borderColor: area.color + '30' }}
                        >
                          {area.label}
                        </Badge>
                      </div>
                    </SortableListRow>
                  );
                })}
              </ListContainer>
            </SortableContext>
          </DndContext>
        )}

        {/* Projects Tab */}
        {activeTab === 'projects' && (
          <ListContainer emptyState="No projects">
            {projects.map(project => {
              const area = getArea(project.domain);
              return (
                <ListRow
                  key={project.id}
                  id={project.id}
                  onClick={() => openEditModal(project, 'project')}
                  onEdit={() => openEditModal(project, 'project')}
                >
                  <div className="flex items-center gap-3 w-full">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      project.status === 'active' ? 'bg-green-500' : 
                      project.status === 'idea' ? 'bg-blue-500' : 
                      'bg-muted-foreground'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{project.title}</span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <Badge variant={
                          project.status === 'active' ? 'done' : 
                          project.status === 'idea' ? 'waiting' : 
                          'secondary'
                        }>
                          {project.status === 'active' ? 'Active' : project.status === 'idea' ? 'Idea' : 'Frozen'}
                        </Badge>
                        {project.notes && (
                          <span className="text-xs text-muted-foreground">{project.notes}</span>
                        )}
                      </div>
                    </div>
                    <Badge 
                      variant="outline"
                      style={{ backgroundColor: area.color + '15', color: area.color, borderColor: area.color + '30' }}
                    >
                      {area.label}
                    </Badge>
                  </div>
                </ListRow>
              );
            })}
          </ListContainer>
        )}

        {/* Dependencies Tab */}
        {activeTab === 'dependencies' && (
          <ListContainer emptyState="No open dependencies ✨">
            {dependencies.map(dep => {
              const days = Math.round((Date.now() - new Date(dep.created_at)) / (1000 * 60 * 60 * 24));
              const isStale = days > 5;
              return (
                <ListRow
                  key={dep.id}
                  id={dep.id}
                  className={isStale ? 'border-l-2 border-l-red-500' : ''}
                >
                  <div className="flex items-center gap-3 w-full">
                    <span className="text-lg shrink-0">{dep.direction === 'them' ? '⏳' : '📤'}</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">
                        {dep.direction === 'them' ? `Waiting for ${dep.waiting_on}` : `I owe ${dep.waiting_on}`}
                      </span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">{dep.waiting_for}</span>
                        <span className={`text-xs ${isStale ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>
                          {timeAgo(dep.created_at)}
                        </span>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => resolveDep(dep.id)}
                      className="shrink-0"
                    >
                      ✓ Done
                    </Button>
                  </div>
                </ListRow>
              );
            })}
          </ListContainer>
        )}

        {/* Parking Tab */}
        {activeTab === 'parking' && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={parking.map(p => p.id)} strategy={verticalListSortingStrategy}>
              <ListContainer emptyState="Parking lot empty">
                {parking.map(item => {
                  const area = getArea(item.domain);
                  return (
                    <SortableListRow
                      key={item.id}
                      id={item.id}
                      onClick={() => openEditModal(item, 'parking')}
                      onEdit={() => openEditModal(item, 'parking')}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <div className="flex-1 min-w-0">
                          <span className="font-medium">{item.text}</span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">{timeAgo(item.created_at)}</span>
                          </div>
                        </div>
                        <Badge 
                          variant="outline"
                          style={{ backgroundColor: area.color + '15', color: area.color, borderColor: area.color + '30' }}
                        >
                          {area.label}
                        </Badge>
                      </div>
                    </SortableListRow>
                  );
                })}
              </ListContainer>
            </SortableContext>
          </DndContext>
        )}

        {/* Edit Modal */}
        <Modal
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          title="Edit Item"
          size="default"
          footer={
            <>
              {showArchiveConfirm ? (
                <div className="flex items-center gap-2 w-full">
                  <span className="text-sm flex-1">Move to archive?</span>
                  <Button variant="ghost" onClick={() => setShowArchiveConfirm(false)}>No</Button>
                  <Button variant="destructive" onClick={handleArchive}>Yes</Button>
                </div>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => setEditModalOpen(false)}>Cancel</Button>
                  <Button onClick={handleSaveEdit} disabled={saving || editedFields.length === 0}>
                    {saving ? 'Saving...' : 'Save'}
                  </Button>
                </>
              )}
            </>
          }
        >
          {editingItem && (
            <EditModalContent
              item={editingItem}
              type={editType}
              onChange={handleFieldChange}
              onArchive={() => setShowArchiveConfirm(true)}
              onFreeze={handleFreeze}
            />
          )}
          {editedFields.length > 0 && (
            <div className="text-xs text-muted-foreground text-center mt-2">
              ✏️ {editedFields.length} fields changed
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
}

export default WorkbenchMode;

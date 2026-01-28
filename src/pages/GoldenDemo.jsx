import React, { useState } from "react";
import {
  TaskCard,
  Modal,
  ConfirmModal,
  AlertModal,
  useModal,
  ListRow,
  ListContainer,
  useListSelection,
  Button,
  Input,
  Textarea,
  Badge,
  Checkbox,
} from "../components/golden";

/**
 * Golden Components Demo Page
 * 
 * A dedicated test/demo page to validate Golden Components in isolation
 * BEFORE migrating the rest of the app.
 */

// Demo data
const DEMO_TASKS = [
  { id: "1", title: "Review design mockups", description: "Check the new Linear-style components", status: "in-progress", priority: "high" },
  { id: "2", title: "Implement modal focus trap", description: "Ensure Tab key stays inside modal", status: "done" },
  { id: "3", title: "Add keyboard shortcuts", description: "Escape to close, Cmd+Enter to save", status: "todo" },
  { id: "4", title: "Test on mobile devices", description: "Touch interactions and responsive layout", status: "waiting" },
];

const DEMO_LIST_ITEMS = [
  { id: "item-1", name: "Design System", description: "Core component library" },
  { id: "item-2", name: "API Integration", description: "Backend connection layer" },
  { id: "item-3", name: "Authentication", description: "User login and sessions" },
  { id: "item-4", name: "Dashboard", description: "Main overview screen" },
  { id: "item-5", name: "Settings Page", description: "User preferences" },
  { id: "item-6", name: "Notifications", description: "Real-time alerts system" },
];

// Checklist component for quality checks
function QualityChecklist({ items }) {
  const [checked, setChecked] = useState({});
  
  return (
    <div className="bg-muted/30 rounded-lg p-4 mt-4">
      <h4 className="text-sm font-medium mb-3 text-muted-foreground">Quality Checks</h4>
      <div className="space-y-2">
        {items.map((item, i) => (
          <label key={i} className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={checked[i] || false}
              onCheckedChange={(val) => setChecked({ ...checked, [i]: val })}
            />
            <span className={checked[i] ? "line-through text-muted-foreground" : ""}>
              {item}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

// Section wrapper component
function Section({ title, description, children }) {
  return (
    <section className="mb-12">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {children}
    </section>
  );
}

// ============================================================================
// TASK CARD SECTION
// ============================================================================
function TaskCardSection() {
  const [tasks, setTasks] = useState(DEMO_TASKS);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [saveStatus, setSaveStatus] = useState(null);

  const handleUpdate = async (id, updates) => {
    setSaveStatus("saving");
    // Simulate API call
    await new Promise((r) => setTimeout(r, 500));
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus(null), 1500);
  };

  const handleStatusChange = async (id, status) => {
    await new Promise((r) => setTimeout(r, 300));
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
  };

  const handleDelete = (id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleAddTask = (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const newTask = {
      id: `new-${Date.now()}`,
      title: newTaskTitle.trim(),
      description: "",
      status: "todo",
    };
    setTasks((prev) => [newTask, ...prev]);
    setNewTaskTitle("");
  };

  return (
    <Section
      title="1. TaskCard"
      description="Linear-style task cards with inline editing, optimistic updates, and keyboard navigation"
    >
      {/* Save status indicator */}
      {saveStatus && (
        <div className="mb-4 text-sm">
          {saveStatus === "saving" && (
            <span className="text-amber-500 flex items-center gap-2">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
              Saving...
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="text-green-500">✓ Saved</span>
          )}
        </div>
      )}

      {/* Inline create new task */}
      <form onSubmit={handleAddTask} className="mb-4">
        <div className="flex gap-2">
          <Input
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="Add a new task... (press Enter)"
            className="flex-1"
          />
          <Button type="submit" disabled={!newTaskTitle.trim()}>
            Add
          </Button>
        </div>
      </form>

      {/* Task list */}
      <div className="space-y-3">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onUpdate={handleUpdate}
            onStatusChange={handleStatusChange}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {/* Test instructions */}
      <div className="mt-4 p-4 bg-muted/50 rounded-lg text-sm">
        <strong>Test Cases:</strong>
        <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
          <li>Click card → opens detail dialog</li>
          <li>Click checkbox → toggles done/todo (without opening dialog)</li>
          <li>In dialog: click title/description to edit</li>
          <li>Escape to cancel editing or close dialog</li>
          <li>Cmd/Ctrl+Enter to save while editing</li>
          <li>Try selecting text in the card (should work)</li>
          <li>Tab through elements for keyboard navigation</li>
        </ul>
      </div>

      <QualityChecklist
        items={[
          "Text editing feels native (select/cut/copy/paste/undo/redo)",
          "Keyboard navigation works (Tab, Enter, Escape)",
          "Save/persist is clear (Saving... → Saved feedback)",
          "No dead clicks (every interactive element responds)",
          "Works on mobile (touch interactions)",
        ]}
      />
    </Section>
  );
}

// ============================================================================
// MODAL SECTION
// ============================================================================
function ModalSection() {
  const basicModal = useModal();
  const confirmModal = useModal();
  const alertModal = useModal();
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmResult, setConfirmResult] = useState(null);

  const handleConfirm = async () => {
    setConfirmLoading(true);
    await new Promise((r) => setTimeout(r, 1000));
    setConfirmLoading(false);
    setConfirmResult("Action confirmed!");
    setTimeout(() => setConfirmResult(null), 2000);
  };

  return (
    <Section
      title="2. Modal"
      description="Dialog system with focus trap, keyboard shortcuts, and animation"
    >
      <div className="flex flex-wrap gap-3">
        <Button onClick={basicModal.open}>Open Basic Modal</Button>
        <Button variant="secondary" onClick={confirmModal.open}>
          Open Confirm Modal
        </Button>
        <Button variant="outline" onClick={alertModal.open}>
          Open Alert Modal
        </Button>
      </div>

      {confirmResult && (
        <div className="mt-4 text-green-500 text-sm">✓ {confirmResult}</div>
      )}

      {/* Basic Modal */}
      <Modal
        open={basicModal.isOpen}
        onOpenChange={basicModal.setIsOpen}
        title="Basic Modal"
        description="This is a basic modal with custom content"
        footer={
          <>
            <Button variant="ghost" onClick={basicModal.close}>
              Cancel
            </Button>
            <Button onClick={basicModal.close}>Done</Button>
          </>
        }
      >
        <div className="space-y-4">
          <p>Try these interactions:</p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            <li>Press Tab — focus should stay inside modal</li>
            <li>Press Escape — modal should close</li>
            <li>Click outside (on overlay) — modal should close</li>
            <li>Scroll the page — body should NOT scroll</li>
          </ul>
          <Input placeholder="Focus trap test - Tab here" />
          <Input placeholder="Then Tab here" />
          <Button variant="outline" className="w-full">
            And Tab here (should loop back)
          </Button>
        </div>
      </Modal>

      {/* Confirm Modal */}
      <ConfirmModal
        open={confirmModal.isOpen}
        onOpenChange={confirmModal.setIsOpen}
        title="Confirm Action"
        description="Are you sure you want to proceed? This action demonstrates the confirm modal pattern."
        confirmLabel="Yes, Proceed"
        cancelLabel="Cancel"
        onConfirm={handleConfirm}
        loading={confirmLoading}
      />

      {/* Alert Modal */}
      <AlertModal
        open={alertModal.isOpen}
        onOpenChange={alertModal.setIsOpen}
        title="Alert!"
        description="This is an alert modal. It only has a single action button to dismiss."
        actionLabel="Got it"
      />

      {/* Test instructions */}
      <div className="mt-4 p-4 bg-muted/50 rounded-lg text-sm">
        <strong>Test Cases:</strong>
        <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
          <li>Focus trap — Tab key stays inside modal</li>
          <li>Escape key closes modal</li>
          <li>Click outside (overlay) closes modal</li>
          <li>Body scroll is locked when modal is open</li>
          <li>Smooth open/close animation</li>
          <li>Confirm modal shows loading state</li>
        </ul>
      </div>

      <QualityChecklist
        items={[
          "Focus trap works (Tab stays inside)",
          "Escape closes modal",
          "Click outside closes modal",
          "No body scroll when open",
          "Smooth animation",
        ]}
      />
    </Section>
  );
}

// ============================================================================
// LIST ROW SECTION
// ============================================================================
function ListRowSection() {
  const [items, setItems] = useState(DEMO_LIST_ITEMS);
  const { selectedIds, select, clearSelection, isSelected } = useListSelection(items);
  const [showEmpty, setShowEmpty] = useState(false);
  const [lastAction, setLastAction] = useState(null);

  const handleEdit = (id) => {
    setLastAction(`Edit: ${id}`);
    setTimeout(() => setLastAction(null), 1500);
  };

  const handleDelete = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setLastAction(`Deleted: ${id}`);
    setTimeout(() => setLastAction(null), 1500);
  };

  const handleRowClick = (id) => {
    setLastAction(`Row clicked: ${id}`);
    setTimeout(() => setLastAction(null), 1500);
  };

  const handleBulkDelete = () => {
    setItems((prev) => prev.filter((item) => !selectedIds.includes(item.id)));
    clearSelection();
    setLastAction(`Bulk deleted ${selectedIds.length} items`);
    setTimeout(() => setLastAction(null), 1500);
  };

  return (
    <Section
      title="3. ListRow"
      description="List items with selection, hover actions, and bulk operations"
    >
      <div className="flex gap-3 mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowEmpty(!showEmpty)}
        >
          {showEmpty ? "Show Items" : "Show Empty State"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setItems(DEMO_LIST_ITEMS)}
        >
          Reset Items
        </Button>
      </div>

      {lastAction && (
        <div className="mb-4 text-sm text-amber-500">→ {lastAction}</div>
      )}

      <ListContainer
        selectedIds={selectedIds}
        onClearSelection={clearSelection}
        emptyState="No items to display. Add some items to get started."
        bulkActions={
          <>
            <Button variant="ghost" size="sm">
              Archive ({selectedIds.length})
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
            >
              Delete ({selectedIds.length})
            </Button>
          </>
        }
      >
        {showEmpty
          ? null
          : items.map((item) => (
              <ListRow
                key={item.id}
                id={item.id}
                selected={isSelected(item.id)}
                onSelect={select}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onClick={handleRowClick}
              >
                <div>
                  <div className="font-medium">{item.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {item.description}
                  </div>
                </div>
              </ListRow>
            ))}
      </ListContainer>

      {/* Test instructions */}
      <div className="mt-4 p-4 bg-muted/50 rounded-lg text-sm">
        <strong>Test Cases:</strong>
        <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
          <li>Hover over row → edit/delete buttons appear</li>
          <li>Click checkbox → selects row (bulk actions bar appears)</li>
          <li>Click row body → triggers "row clicked" action</li>
          <li>Select multiple → bulk action bar shows count</li>
          <li>Toggle empty state to see empty placeholder</li>
          <li>Delete items to test removal</li>
        </ul>
      </div>

      <QualityChecklist
        items={[
          "Hover shows actions (edit/delete buttons)",
          "Checkbox selection works",
          "Bulk actions bar appears on selection",
          "Click row vs click checkbox (different behavior)",
          "Empty state displays correctly",
        ]}
      />
    </Section>
  );
}

// ============================================================================
// PRIMITIVES SECTION
// ============================================================================
function PrimitivesSection() {
  const [inputValue, setInputValue] = useState("");
  const [textareaValue, setTextareaValue] = useState("");

  return (
    <Section
      title="4. Primitives"
      description="Core UI components: Button, Input, Textarea, Badge, Checkbox"
    >
      {/* Buttons */}
      <div className="mb-8">
        <h3 className="text-sm font-medium mb-3">Buttons</h3>
        <div className="flex flex-wrap gap-3">
          <Button variant="default">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="link">Link</Button>
        </div>
        <div className="flex flex-wrap gap-3 mt-3">
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
          <Button disabled>Disabled</Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Tab through buttons to see focus rings
        </p>
      </div>

      {/* Input */}
      <div className="mb-8">
        <h3 className="text-sm font-medium mb-3">Input</h3>
        <div className="max-w-md space-y-3">
          <Input
            placeholder="Default input..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <Input placeholder="Disabled input" disabled />
          <p className="text-xs text-muted-foreground">
            Focus to see ring • Value: "{inputValue}"
          </p>
        </div>
      </div>

      {/* Textarea */}
      <div className="mb-8">
        <h3 className="text-sm font-medium mb-3">Textarea (Auto-resize)</h3>
        <div className="max-w-md">
          <Textarea
            placeholder="Type here and watch it grow..."
            autoResize
            value={textareaValue}
            onChange={(e) => setTextareaValue(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-2">
            Type multiple lines to see auto-resize
          </p>
        </div>
      </div>

      {/* Badges */}
      <div className="mb-8">
        <h3 className="text-sm font-medium mb-3">Badges (Status Variants)</h3>
        <div className="flex flex-wrap gap-2">
          <Badge variant="default">Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <Badge variant="done">Done</Badge>
          <Badge variant="in-progress">In Progress</Badge>
          <Badge variant="waiting">Waiting</Badge>
          <Badge variant="todo">To Do</Badge>
        </div>
      </div>

      {/* Checkbox */}
      <div className="mb-8">
        <h3 className="text-sm font-medium mb-3">Checkbox</h3>
        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox />
            <span>Unchecked checkbox</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox defaultChecked />
            <span>Default checked</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer opacity-50">
            <Checkbox disabled />
            <span>Disabled checkbox</span>
          </label>
        </div>
      </div>

      <QualityChecklist
        items={[
          "All buttons show visible focus states (Tab to test)",
          "Input focus ring is visible and consistent",
          "Textarea auto-resizes when typing",
          "Badge colors are distinct and readable",
          "Checkbox has clear checked/unchecked states",
        ]}
      />
    </Section>
  );
}

// ============================================================================
// MAIN DEMO PAGE
// ============================================================================
export default function GoldenDemo() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-12">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">✨</span>
            <h1 className="text-2xl font-bold">Golden Components</h1>
          </div>
          <p className="text-muted-foreground">
            Isolation test page for Linear-style UI components. Validate everything
            works perfectly here BEFORE migrating the rest of the app.
          </p>
          <div className="flex gap-2 mt-4">
            <Badge variant="in-progress">Testing Phase</Badge>
            <Badge variant="outline">v1.0</Badge>
          </div>
        </header>

        {/* Component Sections */}
        <TaskCardSection />
        <ModalSection />
        <ListRowSection />
        <PrimitivesSection />

        {/* Summary */}
        <section className="mt-16 p-6 bg-muted/30 rounded-lg">
          <h2 className="text-lg font-semibold mb-4">📋 Overall Quality Summary</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium mb-2">Must Pass</h3>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>☐ All text editing feels native</li>
                <li>☐ Keyboard navigation works throughout</li>
                <li>☐ Save/persist feedback is clear</li>
                <li>☐ No dead clicks anywhere</li>
                <li>☐ Works on mobile (test on device)</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium mb-2">Component Status</h3>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>☐ TaskCard — all tests pass</li>
                <li>☐ Modal — all tests pass</li>
                <li>☐ ListRow — all tests pass</li>
                <li>☐ Primitives — all tests pass</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>Golden Components Demo • Personal Command Center</p>
          <p className="mt-1">
            <kbd className="px-2 py-1 bg-muted rounded text-xs">Escape</kbd> to close modals •{" "}
            <kbd className="px-2 py-1 bg-muted rounded text-xs">Tab</kbd> for navigation •{" "}
            <kbd className="px-2 py-1 bg-muted rounded text-xs">Cmd+Enter</kbd> to save
          </p>
        </footer>
      </div>
    </div>
  );
}

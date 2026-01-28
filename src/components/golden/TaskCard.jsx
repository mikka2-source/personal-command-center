import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { Checkbox } from "../ui/checkbox";
import { cn } from "../../lib/utils";

/**
 * Linear-style TaskCard with inline editing
 * 
 * Features:
 * - Click to open detail panel
 * - Inline editing with autosave
 * - Optimistic UI updates
 * - Clear status states: done / in-progress / waiting / todo
 * - Keyboard: Escape to close, Cmd+Enter to save
 * - Visible focus states
 */

const STATUS_CONFIG = {
  done: { label: "Done", variant: "done" },
  "in-progress": { label: "In Progress", variant: "in-progress" },
  waiting: { label: "Waiting", variant: "waiting" },
  todo: { label: "To Do", variant: "todo" },
};

export function TaskCard({
  task,
  onUpdate,
  onStatusChange,
  onDelete,
  className,
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editedTitle, setEditedTitle] = React.useState(task.title);
  const [editedDescription, setEditedDescription] = React.useState(task.description || "");
  const [isSaving, setIsSaving] = React.useState(false);
  const [optimisticTask, setOptimisticTask] = React.useState(task);
  
  const titleInputRef = React.useRef(null);

  // Sync optimistic state with prop
  React.useEffect(() => {
    setOptimisticTask(task);
    setEditedTitle(task.title);
    setEditedDescription(task.description || "");
  }, [task]);

  // Focus title input when editing starts
  React.useEffect(() => {
    if (isEditing && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = React.useCallback(async () => {
    if (!onUpdate) return;
    
    const updates = {
      title: editedTitle.trim() || task.title,
      description: editedDescription.trim(),
    };
    
    // Optimistic update
    setOptimisticTask((prev) => ({ ...prev, ...updates }));
    setIsSaving(true);
    setIsEditing(false);
    
    try {
      await onUpdate(task.id, updates);
    } catch (error) {
      // Rollback on error
      setOptimisticTask(task);
      setEditedTitle(task.title);
      setEditedDescription(task.description || "");
      console.error("Failed to save task:", error);
    } finally {
      setIsSaving(false);
    }
  }, [task, editedTitle, editedDescription, onUpdate]);

  const handleStatusToggle = React.useCallback(async (e) => {
    e.stopPropagation();
    if (!onStatusChange) return;
    
    const newStatus = optimisticTask.status === "done" ? "todo" : "done";
    
    // Optimistic update
    setOptimisticTask((prev) => ({ ...prev, status: newStatus }));
    
    try {
      await onStatusChange(task.id, newStatus);
    } catch (error) {
      // Rollback on error
      setOptimisticTask(task);
      console.error("Failed to update status:", error);
    }
  }, [task, optimisticTask.status, onStatusChange]);

  const handleKeyDown = React.useCallback((e) => {
    if (e.key === "Escape") {
      if (isEditing) {
        // Prevent Radix Dialog from also handling Escape
        e.preventDefault();
        e.stopPropagation();
        // Cancel editing
        setEditedTitle(optimisticTask.title);
        setEditedDescription(optimisticTask.description || "");
        setIsEditing(false);
      } else {
        setIsOpen(false);
      }
    } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (isEditing) {
        handleSave();
      }
    }
  }, [isEditing, optimisticTask, handleSave]);

  const statusConfig = STATUS_CONFIG[optimisticTask.status] || STATUS_CONFIG.todo;
  const isDone = optimisticTask.status === "done";

  return (
    <>
      {/* Card Preview */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen(true);
          }
        }}
        className={cn(
          "group relative flex items-start gap-3 rounded-lg border border-border bg-card p-4 transition-all",
          "hover:border-primary/50 hover:bg-card/80",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "cursor-pointer select-text",
          isDone && "opacity-60",
          className
        )}
      >
        <Checkbox
          checked={isDone}
          onCheckedChange={() => handleStatusToggle({ stopPropagation: () => {} })}
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5 shrink-0"
          aria-label={`Mark task as ${isDone ? "incomplete" : "complete"}`}
        />
        
        <div className="flex-1 min-w-0">
          <h3 className={cn(
            "font-medium leading-tight",
            isDone && "line-through text-muted-foreground"
          )}>
            {optimisticTask.title}
          </h3>
          
          {optimisticTask.description && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
              {optimisticTask.description}
            </p>
          )}
        </div>
        
        <Badge variant={statusConfig.variant} className="shrink-0">
          {statusConfig.label}
        </Badge>
        
        {isSaving && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/50 rounded-lg">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          className="sm:max-w-[500px]"
          onKeyDown={handleKeyDown}
          onEscapeKeyDown={(e) => {
            // Prevent dialog from closing when in edit mode
            if (isEditing) {
              e.preventDefault();
            }
          }}
        >
          <DialogHeader>
            {isEditing ? (
              <Input
                ref={titleInputRef}
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                placeholder="Task title..."
                className="text-lg font-semibold"
              />
            ) : (
              <DialogTitle 
                className={cn(
                  "cursor-pointer hover:text-primary transition-colors",
                  isDone && "line-through text-muted-foreground"
                )}
                onClick={() => setIsEditing(true)}
              >
                {optimisticTask.title}
              </DialogTitle>
            )}
            
            <div className="flex items-center gap-2 mt-2">
              <Badge variant={statusConfig.variant}>
                {statusConfig.label}
              </Badge>
              {optimisticTask.priority && (
                <Badge variant="outline">
                  {optimisticTask.priority}
                </Badge>
              )}
            </div>
          </DialogHeader>

          <div className="space-y-4">
            {isEditing ? (
              <Textarea
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                placeholder="Add a description..."
                autoResize
                className="min-h-[100px]"
              />
            ) : (
              <DialogDescription
                className={cn(
                  "cursor-pointer min-h-[60px] p-3 rounded-md border border-transparent hover:border-border transition-colors",
                  !optimisticTask.description && "text-muted-foreground italic"
                )}
                onClick={() => setIsEditing(true)}
              >
                {optimisticTask.description || "Click to add a description..."}
              </DialogDescription>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {isEditing ? (
              <>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditedTitle(optimisticTask.title);
                    setEditedDescription(optimisticTask.description || "");
                    setIsEditing(false);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </>
            ) : (
              <>
                {onDelete && (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      onDelete(task.id);
                      setIsOpen(false);
                    }}
                  >
                    Delete
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setIsEditing(true)}>
                  Edit
                </Button>
                <Button onClick={() => setIsOpen(false)}>
                  Close
                </Button>
              </>
            )}
          </DialogFooter>
          
          <p className="text-xs text-muted-foreground text-center">
            {isEditing ? "Cmd+Enter to save • Escape to cancel" : "Press Escape to close"}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default TaskCard;

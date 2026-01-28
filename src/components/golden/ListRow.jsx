import * as React from "react";
import { Checkbox } from "../ui/checkbox";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

/**
 * Linear-style ListRow
 * 
 * Features:
 * - Clean, minimal design
 * - Hover shows actions (edit, delete) — NOT always visible
 * - Checkbox for selection
 * - Bulk actions via selection
 * - Calm empty state
 */

const EditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

export function ListRow({
  id,
  children,
  selected = false,
  onSelect,
  onEdit,
  onDelete,
  onClick,
  disabled = false,
  className,
}) {
  const handleCheckboxChange = (checked) => {
    if (onSelect) {
      onSelect(id, checked);
    }
  };

  const handleClick = (e) => {
    // Don't trigger onClick if clicking on checkbox or action buttons
    if (e.target.closest('[data-action]') || e.target.closest('[role="checkbox"]')) {
      return;
    }
    if (onClick) {
      onClick(id);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      // Don't intercept keyboard events from interactive elements
      // This preserves native text editing behavior in nested inputs
      if (
        !e.target.closest('[data-action]') && 
        !e.target.closest('[role="checkbox"]') &&
        !e.target.closest('input') &&
        !e.target.closest('textarea') &&
        !e.target.closest('[contenteditable]')
      ) {
        e.preventDefault();
        if (onClick) {
          onClick(id);
        }
      }
    }
  };

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "group relative flex items-center gap-3 px-4 py-3 border-b border-border transition-colors",
        "hover:bg-accent/50",
        onClick && "cursor-pointer",
        selected && "bg-accent",
        disabled && "opacity-50 pointer-events-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        className
      )}
    >
      {onSelect && (
        <Checkbox
          checked={selected}
          onCheckedChange={handleCheckboxChange}
          onClick={(e) => e.stopPropagation()}
          disabled={disabled}
          className="shrink-0"
          aria-label="Select row"
        />
      )}
      
      <div className="flex-1 min-w-0 select-text">
        {children}
      </div>
      
      {/* Actions - only visible on hover */}
      {(onEdit || onDelete) && (
        <div 
          className={cn(
            "flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity",
            // Show actions when row is selected too
            selected && "opacity-100"
          )}
        >
          {onEdit && (
            <Button
              data-action="edit"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(id);
              }}
              aria-label="Edit"
            >
              <EditIcon />
            </Button>
          )}
          {onDelete && (
            <Button
              data-action="delete"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(id);
              }}
              aria-label="Delete"
            >
              <TrashIcon />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * ListContainer - Wrapper for list rows with bulk actions
 */
export function ListContainer({
  children,
  selectedIds = [],
  onSelectAll,
  onClearSelection,
  bulkActions,
  emptyState,
  className,
}) {
  const childArray = React.Children.toArray(children);
  const hasItems = childArray.length > 0;
  const hasSelection = selectedIds.length > 0;

  return (
    <div className={cn("rounded-lg border border-border overflow-hidden", className)}>
      {/* Bulk actions header */}
      {hasSelection && bulkActions && (
        <div className="flex items-center gap-2 px-4 py-2 bg-accent border-b border-border">
          <span className="text-sm text-muted-foreground">
            {selectedIds.length} selected
          </span>
          <div className="flex-1" />
          {bulkActions}
          {onClearSelection && (
            <Button variant="ghost" size="sm" onClick={onClearSelection}>
              Clear
            </Button>
          )}
        </div>
      )}
      
      {/* List content */}
      {hasItems ? (
        <div className="divide-y divide-border">
          {children}
        </div>
      ) : (
        <EmptyState>
          {emptyState || "No items yet"}
        </EmptyState>
      )}
    </div>
  );
}

/**
 * EmptyState - Calm empty state message
 */
export function EmptyState({ children, className }) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-12 px-4 text-center",
      className
    )}>
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <p className="text-muted-foreground text-sm">
        {children}
      </p>
    </div>
  );
}

/**
 * useListSelection - Hook for managing list selection state
 */
export function useListSelection(items = []) {
  const [selectedIds, setSelectedIds] = React.useState(new Set());

  const select = React.useCallback((id, selected) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const selectAll = React.useCallback(() => {
    setSelectedIds(new Set(items.map((item) => item.id)));
  }, [items]);

  const clearSelection = React.useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const toggleSelection = React.useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const isSelected = React.useCallback((id) => selectedIds.has(id), [selectedIds]);

  return {
    selectedIds: Array.from(selectedIds),
    select,
    selectAll,
    clearSelection,
    toggleSelection,
    isSelected,
    hasSelection: selectedIds.size > 0,
    allSelected: items.length > 0 && selectedIds.size === items.length,
  };
}

export default ListRow;

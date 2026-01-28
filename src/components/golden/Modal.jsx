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
import { cn } from "../../lib/utils";

/**
 * Linear-style Modal/Drawer
 * 
 * Features:
 * - Focus trap inside modal (handled by Radix Dialog)
 * - Escape to close
 * - Click outside to close
 * - Smooth animations
 * - No scroll on body when open (handled by Radix Dialog)
 */

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "default",
  className,
}) {
  const sizeClasses = {
    sm: "sm:max-w-[400px]",
    default: "sm:max-w-[500px]",
    lg: "sm:max-w-[700px]",
    xl: "sm:max-w-[900px]",
    full: "sm:max-w-[95vw] sm:max-h-[95vh]",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(sizeClasses[size], className)}>
        {(title || description) && (
          <DialogHeader>
            {title && <DialogTitle>{title}</DialogTitle>}
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        )}
        
        <div className="py-4">
          {children}
        </div>
        
        {footer && (
          <DialogFooter>
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * ConfirmModal - For confirmation dialogs
 */
export function ConfirmModal({
  open,
  onOpenChange,
  title = "Are you sure?",
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
  loading = false,
}) {
  const handleConfirm = async () => {
    if (onConfirm) {
      await onConfirm();
    }
    onOpenChange(false);
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={handleCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "Loading..." : confirmLabel}
          </Button>
        </>
      }
    />
  );
}

/**
 * AlertModal - For alert messages
 */
export function AlertModal({
  open,
  onOpenChange,
  title,
  description,
  actionLabel = "OK",
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
      footer={
        <Button onClick={() => onOpenChange(false)}>
          {actionLabel}
        </Button>
      }
    />
  );
}

/**
 * useModal - Hook for programmatic modal control
 */
export function useModal(initialState = false) {
  const [isOpen, setIsOpen] = React.useState(initialState);

  const open = React.useCallback(() => setIsOpen(true), []);
  const close = React.useCallback(() => setIsOpen(false), []);
  const toggle = React.useCallback(() => setIsOpen((prev) => !prev), []);

  return {
    isOpen,
    open,
    close,
    toggle,
    setIsOpen,
  };
}

export default Modal;

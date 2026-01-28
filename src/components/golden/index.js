/**
 * Golden Components - Linear-style UI Foundation
 * 
 * These are the core building blocks for the entire UI.
 * All components follow Linear's design patterns:
 * - Clean, minimal aesthetic
 * - Keyboard-first interaction
 * - Visible focus states
 * - Fast, responsive feel
 * - No surprise interactions
 */

// Re-export shadcn primitives with consistent styling
export { Button, buttonVariants } from "../ui/button";
export { Input } from "../ui/input";
export { Textarea } from "../ui/textarea";
export { Badge, badgeVariants } from "../ui/badge";
export { Checkbox } from "../ui/checkbox";
export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "../ui/dialog";

// Golden components
export { TaskCard } from "./TaskCard";
export { Modal, ConfirmModal, AlertModal, useModal } from "./Modal";
export { ListRow, ListContainer, EmptyState, useListSelection } from "./ListRow";

// Utility function
export { cn } from "../../lib/utils";

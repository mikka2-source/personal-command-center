import * as React from "react";
import { cn } from "../../lib/utils";

const Textarea = React.forwardRef(({ className, autoResize, ...props }, ref) => {
  const textareaRef = React.useRef(null);
  const combinedRef = ref || textareaRef;

  React.useEffect(() => {
    if (autoResize && combinedRef.current) {
      const textarea = combinedRef.current;
      const adjustHeight = () => {
        textarea.style.height = "auto";
        textarea.style.height = textarea.scrollHeight + "px";
      };
      adjustHeight();
      textarea.addEventListener("input", adjustHeight);
      return () => textarea.removeEventListener("input", adjustHeight);
    }
  }, [autoResize, combinedRef]);

  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        autoResize && "resize-none overflow-hidden",
        className
      )}
      ref={combinedRef}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };

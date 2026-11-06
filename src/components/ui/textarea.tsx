import type { ComponentProps } from "react";

export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={`block min-h-32 w-full min-w-0 resize-y rounded-sm border border-control-border bg-surface px-4 py-3 text-base leading-relaxed text-foreground placeholder:text-muted focus-visible:border-focus disabled:cursor-not-allowed disabled:border-line disabled:bg-disabled disabled:text-disabled-foreground aria-[invalid=true]:border-danger motion-safe:transition-colors motion-safe:duration-ui ${className}`}
      {...props}
    />
  );
}

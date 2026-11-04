import type { ComponentProps } from "react";

export type InputProps = ComponentProps<"input">;

export function Input({ className = "", ...props }: InputProps) {
  return (
    <input
      className={`block min-h-12 w-full min-w-0 rounded-sm border border-control-border bg-surface px-4 py-3 text-base leading-6 text-foreground placeholder:text-muted focus-visible:border-focus disabled:cursor-not-allowed disabled:border-line disabled:bg-disabled disabled:text-disabled-foreground aria-[invalid=true]:border-danger motion-safe:transition-colors motion-safe:duration-ui motion-safe:ease-ui ${className}`}
      {...props}
    />
  );
}

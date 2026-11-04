import type { ComponentProps } from "react";

export type CardProps = ComponentProps<"div">;

export function Card({ className = "", ...props }: CardProps) {
  return (
    <div
      className={`min-w-0 break-words rounded-md border border-line bg-surface p-6 shadow-sm ${className}`}
      {...props}
    />
  );
}

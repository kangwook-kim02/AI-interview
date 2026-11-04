import type { ComponentProps } from "react";

export type ButtonProps = ComponentProps<"button"> & {
  variant?: "primary" | "secondary";
};

const variants = {
  primary: "bg-primary text-primary-foreground enabled:hover:bg-primary-hover",
  secondary: "bg-accent-soft text-accent enabled:hover:bg-accent-soft/70",
};

export function Button({
  variant = "primary",
  type = "button",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-12 min-w-0 max-w-full items-center justify-center gap-2 whitespace-normal rounded-pill px-6 py-3 text-center text-base font-semibold leading-6 shadow-sm transition-colors duration-ui ease-ui [overflow-wrap:anywhere] disabled:cursor-not-allowed disabled:bg-disabled disabled:text-disabled-foreground disabled:shadow-none motion-reduce:transition-none ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

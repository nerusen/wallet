import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Brutalist input. 1px border, zero radius, mono digits.
 * No focus glow — focus is a 1px border colour change plus the global outline.
 */
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-9 w-full border border-border bg-background px-3 py-2",
        "font-mono text-[13px] text-foreground tabular",
        "placeholder:font-mono placeholder:text-[12px] placeholder:text-muted-foreground",
        "transition-colors duration-150 ease-brutal",
        "hover:border-border-strong focus:border-accent focus:outline-none",
        "disabled:cursor-not-allowed disabled:bg-surface disabled:opacity-50",
        "file:border-0 file:bg-transparent file:font-mono file:text-[11px] file:uppercase file:tracking-[0.08em]",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[72px] w-full resize-y border border-border bg-background px-3 py-2",
      "font-mono text-[13px] text-foreground",
      "placeholder:text-[12px] placeholder:text-muted-foreground",
      "transition-colors duration-150 ease-brutal",
      "hover:border-border-strong focus:border-accent focus:outline-none",
      "disabled:cursor-not-allowed disabled:bg-surface disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

/** Native select styled to match. A real <select> keeps mobile UX correct. */
const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      className={cn(
        "flex h-9 w-full appearance-none border border-border bg-background pl-3 pr-8 py-2",
        "font-mono text-[13px] text-foreground",
        "transition-colors duration-150 ease-brutal",
        "hover:border-border-strong focus:border-accent focus:outline-none",
        "disabled:cursor-not-allowed disabled:bg-surface disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
    <span
      aria-hidden
      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-muted-foreground"
    >
      ▾
    </span>
  </div>
));
Select.displayName = "Select";

function Label({
  className,
  children,
  htmlFor,
  hint,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { hint?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "flex items-baseline justify-between gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.09em] text-muted-foreground",
        className,
      )}
      {...props}
    >
      <span>{children}</span>
      {hint !== undefined && (
        <span className="text-[10px] normal-case tracking-normal text-muted-foreground/70">
          {hint}
        </span>
      )}
    </label>
  );
}

/** Label + control + optional error, with consistent vertical rhythm. */
function Field({
  label,
  htmlFor,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string | undefined;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor} hint={hint}>
        {label}
      </Label>
      {children}
      {error !== undefined && error.length > 0 && (
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export { Input, Textarea, Select, Label, Field };

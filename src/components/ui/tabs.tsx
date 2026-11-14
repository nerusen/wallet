"use client";

import { cn } from "@/lib/utils";

/**
 * Segmented tab rail.
 *
 * A flush row of bordered cells — the active cell is marked by a 2px accent
 * underline (the opencode.ai active-tab pattern), never by a pill or a fill,
 * so the grid stays unbroken.
 */
export interface TabItem<T extends string> {
  value: T;
  label: string;
  /** Optional mono counter shown after the label. */
  meta?: string;
}

export function TabRail<T extends string>({
  items,
  value,
  onChange,
  className,
  size = "md",
}: {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="tablist"
      className={cn("flex w-full overflow-x-auto border-b border-border", className)}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "relative shrink-0 border-r border-border font-mono uppercase tracking-[0.08em] transition-colors",
              size === "sm" ? "px-3 py-2 text-[10px]" : "px-4 py-2.5 text-[11px]",
              active
                ? "bg-surface text-foreground"
                : "bg-transparent text-muted-foreground hover:bg-surface hover:text-foreground",
            )}
          >
            <span className="flex items-center gap-2">
              {item.label}
              {item.meta !== undefined && (
                <span className="text-[10px] text-muted-foreground tabular">{item.meta}</span>
              )}
            </span>
            {active && (
              <span
                aria-hidden
                className="absolute inset-x-0 -bottom-px block h-0.5 bg-accent"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Compact inline toggle group — used for the chart's Harian/Mingguan/Bulanan. */
export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("inline-flex border border-border", className)}
    >
      {items.map((item, index) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors",
              index > 0 && "border-l border-border",
              active
                ? "bg-foreground text-background"
                : "bg-transparent text-muted-foreground hover:bg-surface hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

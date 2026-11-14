import * as React from "react";

import { Badge, ProgressRail } from "@/components/ui/panel";
import { cn } from "@/lib/utils";

/**
 * KPI cell.
 *
 * Designed to sit inside `.outline-grid` so the 1px vertical and horizontal
 * dividers between cells are shared borders — a single-weight lattice, never
 * a doubled 2px seam.
 */
export function KpiCell({
  eyebrow,
  code,
  value,
  unit,
  delta,
  deltaTone = "neutral",
  footnote,
  progress,
  progressTone = "accent",
  badge,
  className,
}: {
  eyebrow: string;
  code?: string;
  value: string;
  unit?: string;
  delta?: string;
  deltaTone?: "neutral" | "success" | "warning" | "danger";
  footnote?: React.ReactNode;
  progress?: number;
  progressTone?: "accent" | "warning" | "danger" | "mono";
  badge?: { label: string; tone: "neutral" | "accent" | "success" | "warning" | "danger" };
  className?: string;
}) {
  const deltaColor = {
    neutral: "text-muted-foreground",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
  }[deltaTone];

  return (
    <div className={cn("flex min-w-0 flex-col gap-3 bg-background p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <span className="eyebrow min-w-0 truncate">{eyebrow}</span>
        {code !== undefined && (
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground/50 tabular">
            {code}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-mono text-[22px] font-semibold leading-none text-foreground tabular">
          {value}
        </span>
        {unit !== undefined && (
          <span className="font-mono text-[11px] text-muted-foreground">{unit}</span>
        )}
        {delta !== undefined && (
          <span className={cn("font-mono text-[11px] tabular", deltaColor)}>
            {delta}
          </span>
        )}
      </div>

      {progress !== undefined && (
        <ProgressRail value={progress} tone={progressTone} />
      )}

      {(footnote !== undefined || badge !== undefined) && (
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          {badge !== undefined && <Badge tone={badge.tone}>{badge.label}</Badge>}
          {footnote !== undefined && (
            <p className="min-w-0 text-[11px] leading-relaxed text-muted-foreground">
              {footnote}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 4-column KPI grid with shared 1px dividers.
 * Collapses to 2 columns on tablet and 1 on mobile; the lattice holds at
 * every breakpoint because the borders live on the cells.
 */
export function KpiGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "outline-grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

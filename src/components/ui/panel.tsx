import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Framed panel — the universal container primitive.
 *
 * Every panel is a sharp rectangle with a 1px border on all four sides and a
 * flat `surface` or `canvas` fill. No radius, no shadow, no gradient.
 */
function Panel({
  className,
  tone = "canvas",
  marks = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  tone?: "canvas" | "surface";
  /** Draw the chaingpt-style corner registration brackets. */
  marks?: boolean;
}) {
  return (
    <div
      className={cn(
        "border border-border",
        tone === "surface" ? "bg-surface" : "bg-background",
        marks && "registration-marks",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Panel header: an eyebrow rail with a bottom hairline.
 * `code` renders the chaingpt-style numeric register (01, 02, …).
 */
function PanelHeader({
  eyebrow,
  code,
  title,
  description,
  actions,
  accent = false,
  className,
}: {
  eyebrow?: string;
  code?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {code !== undefined && (
          <span className="eyebrow mt-0.5 shrink-0 border border-border px-1.5 py-1 text-[10px]">
            {code}
          </span>
        )}
        <div className="min-w-0">
          {eyebrow !== undefined && (
            <p className={cn("eyebrow", accent && "eyebrow-accent")}>{eyebrow}</p>
          )}
          {title !== undefined && (
            <h3 className="mt-1.5 truncate text-[15px] font-semibold leading-tight text-foreground">
              {title}
            </h3>
          )}
          {description !== undefined && (
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions !== undefined && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

function PanelBody({
  className,
  flush = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { flush?: boolean }) {
  return <div className={cn(flush ? "" : "p-4", className)} {...props} />;
}

function PanelFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface px-4 py-3",
        className,
      )}
      {...props}
    />
  );
}

/** Uppercase mono section eyebrow with an optional trailing hairline rule. */
function Eyebrow({
  children,
  accent = false,
  rule = false,
  className,
}: {
  children: React.ReactNode;
  accent?: boolean;
  rule?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className={cn("eyebrow shrink-0", accent && "eyebrow-accent")}>
        {children}
      </span>
      {rule && <span aria-hidden className="h-px w-full bg-border" />}
    </div>
  );
}

/** Mono badge. Status colours are reserved for small badges and dots only. */
function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "success" | "warning" | "danger" | "mono";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "border-border bg-transparent text-muted-foreground",
    accent: "border-accent bg-accent text-accent-foreground",
    success: "border-success bg-transparent text-success",
    warning: "border-warning bg-transparent text-warning",
    danger: "border-danger bg-transparent text-danger",
    mono: "border-foreground bg-foreground text-background",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border px-1.5 py-0.5",
        "font-mono text-[10px] font-medium uppercase leading-none tracking-[0.08em] tabular",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

function StatusDot({
  tone = "neutral",
  pulse = false,
  className,
}: {
  tone?: "neutral" | "success" | "warning" | "danger";
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      data-tone={tone === "neutral" ? undefined : tone}
      className={cn("status-dot", pulse && "animate-status-pulse", className)}
    />
  );
}

/** Flat progress rail. The only "fill" in the system. */
function ProgressRail({
  value,
  tone = "accent",
  className,
}: {
  /** Ratio in [0, 1]. Values above 1 are clamped visually. */
  value: number;
  tone?: "accent" | "warning" | "danger" | "mono";
  className?: string;
}) {
  const pct = Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), 1) * 100;

  return (
    <div
      className={cn("progress-rail", className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="progress-fill"
        data-tone={tone === "accent" ? undefined : tone}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Full-bleed 1px rule that reads as part of the structural grid. */
function GridRule({
  orientation = "horizontal",
  className,
}: {
  orientation?: "horizontal" | "vertical";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "block bg-border",
        orientation === "horizontal" ? "h-px w-full" : "w-px self-stretch",
        className,
      )}
    />
  );
}

/** Empty state that keeps the grid intact instead of collapsing it. */
function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className,
      )}
    >
      <span aria-hidden className="h-6 w-6 border border-border-strong" />
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-foreground">
        {title}
      </p>
      {description !== undefined && (
        <p className="max-w-sm text-[12px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action !== undefined && <div className="mt-1">{action}</div>}
    </div>
  );
}

export {
  Panel,
  PanelHeader,
  PanelBody,
  PanelFooter,
  Eyebrow,
  Badge,
  StatusDot,
  ProgressRail,
  GridRule,
  EmptyState,
};

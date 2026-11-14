import * as React from "react";

import { Eyebrow } from "@/components/ui/panel";
import { cn } from "@/lib/utils";

/**
 * Page header rail.
 *
 * A full-bleed block with a bottom hairline, matching the opencode.ai
 * `[data-component=block]` row treatment. The optional `actions` slot is where
 * each page puts its primary + monochrome button pair.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
  className,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /** Mono key/value pairs rendered on the trailing edge. */
  meta?: readonly { label: string; value: string }[];
  className?: string;
}) {
  return (
    <div className={cn("border-b border-border", className)}>
      <div className="flex flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <Eyebrow accent>{eyebrow}</Eyebrow>
          <h1 className="mt-3 text-[22px] font-bold leading-[1.15] tracking-[-0.02em] text-foreground sm:text-[26px]">
            {title}
          </h1>
          {description !== undefined && (
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>

        {actions !== undefined && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>

      {meta !== undefined && meta.length > 0 && (
        <dl className="flex flex-wrap border-t border-border">
          {meta.map((item, index) => (
            <div
              key={item.label}
              className={cn(
                "flex min-w-[9rem] flex-1 flex-col gap-1 px-4 py-3 sm:px-6",
                index > 0 && "border-l border-border",
              )}
            >
              <dt className="eyebrow">{item.label}</dt>
              <dd className="font-mono text-[13px] text-foreground tabular">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/** Standard page body padding — kept in one place for rhythm consistency. */
export function PageBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-6 px-4 py-6 sm:px-6", className)}>
      {children}
    </div>
  );
}

/** Non-fatal data-load error banner. Flat, 1px, no shadow. */
export function LoadError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="border border-danger bg-surface px-4 py-3"
    >
      <p className="eyebrow text-danger">Gagal Memuat Data</p>
      <p className="mt-2 font-mono text-[11px] leading-relaxed text-foreground">
        {message}
      </p>
      <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
        Pastikan migrasi sudah dijalankan dengan{" "}
        <code className="border border-border px-1 font-mono text-[11px]">
          npx supabase db push
        </code>{" "}
        dan variabel <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> serta{" "}
        <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> sudah terisi di{" "}
        <code className="font-mono">.env.local</code>.
      </p>
    </div>
  );
}

"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Panel, PanelHeader } from "@/components/ui/panel";
import { SegmentedControl } from "@/components/ui/tabs";
import { formatRupiah, formatRupiahCompact } from "@/lib/format";
import { buildChartSeries, type ChartGranularity, type ChartPoint } from "@/lib/finance";
import type { Transaction } from "@/lib/types/database";

/**
 * Mountain-ridge multi-series area chart.
 *
 * Visual contract (no gradients anywhere — Recharts' default is a <defs>
 * linearGradient, which is why every fill here is an explicit flat colour
 * with `fillOpacity={0.12}`):
 *   • Pemasukan Gaji      → #51CD85
 *   • Pemasukan Freelance → monochrome (#18181B light / #FAFAFA dark)
 *   • Pengeluaran         → #EF4444
 *
 * Interaction contract:
 *   • Desktop: mouse hover drives Recharts' own tooltip + 1px dashed crosshair.
 *   • Mobile: touch-and-hold. Recharts does not expose a touch-hold mode, so
 *     the handlers below translate `touchstart`/`touchmove` coordinates into a
 *     bucket index and render the same brutalist popover, pinned to the touch
 *     point. `touch-action: pan-y` (see `.chart-touch-surface`) keeps vertical
 *     page scrolling intact while horizontal sweeps read the crosshair.
 */

const SERIES = [
  {
    key: "gaji" as const,
    label: "Pemasukan Gaji",
    color: "rgb(var(--accent))",
  },
  {
    key: "freelance" as const,
    label: "Pemasukan Freelance",
    color: "rgb(var(--chart-mono))",
  },
  {
    key: "pengeluaran" as const,
    label: "Pengeluaran",
    color: "rgb(var(--danger))",
  },
] as const;

const GRANULARITY_OPTIONS = [
  { value: "harian" as const, label: "Harian" },
  { value: "mingguan" as const, label: "Mingguan" },
  { value: "bulanan" as const, label: "Bulanan" },
];

export function MountainChart({
  transactions,
  today,
}: {
  transactions: readonly Transaction[];
  today: string;
}) {
  const [granularity, setGranularity] = React.useState<ChartGranularity>("harian");
  const [curve, setCurve] = React.useState<"linear" | "monotone">("linear");

  const data = React.useMemo(
    () =>
      buildChartSeries(transactions, granularity, {
        days: 30,
        today,
      }),
    [transactions, granularity, today],
  );

  /* ── Touch-and-hold crosshair state ──────────────────────────────────── */
  const surfaceRef = React.useRef<HTMLDivElement>(null);
  const [touchIndex, setTouchIndex] = React.useState<number | null>(null);
  const [touchX, setTouchX] = React.useState(0);

  const resolveIndexFromClientX = React.useCallback(
    (clientX: number): number | null => {
      const element = surfaceRef.current;
      if (element === null || data.length === 0) return null;

      const rect = element.getBoundingClientRect();
      // Match the chart margins declared on <AreaChart> below.
      const plotLeft = rect.left + CHART_MARGIN.left;
      const plotWidth = rect.width - CHART_MARGIN.left - CHART_MARGIN.right;
      if (plotWidth <= 0) return null;

      const ratio = (clientX - plotLeft) / plotWidth;
      const clamped = Math.min(Math.max(ratio, 0), 1);
      return Math.round(clamped * (data.length - 1));
    },
    [data.length],
  );

  const onTouchStart = React.useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      const touch = event.touches[0];
      if (touch === undefined) return;
      const index = resolveIndexFromClientX(touch.clientX);
      if (index === null) return;

      const rect = surfaceRef.current?.getBoundingClientRect();
      setTouchX(rect === undefined ? 0 : touch.clientX - rect.left);
      setTouchIndex(index);
    },
    [resolveIndexFromClientX],
  );

  const onTouchMove = React.useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (touchIndex === null) return;
      const touch = event.touches[0];
      if (touch === undefined) return;

      const index = resolveIndexFromClientX(touch.clientX);
      if (index === null) return;

      const rect = surfaceRef.current?.getBoundingClientRect();
      setTouchX(rect === undefined ? 0 : touch.clientX - rect.left);
      setTouchIndex(index);
    },
    [touchIndex, resolveIndexFromClientX],
  );

  const clearTouch = React.useCallback(() => setTouchIndex(null), []);

  const touchPoint = touchIndex === null ? null : (data[touchIndex] ?? null);

  const totals = React.useMemo(
    () => ({
      gaji: data.reduce((acc, d) => acc + d.gaji, 0),
      freelance: data.reduce((acc, d) => acc + d.freelance, 0),
      pengeluaran: data.reduce((acc, d) => acc + d.pengeluaran, 0),
    }),
    [data],
  );

  return (
    <Panel>
      <PanelHeader
        code="02"
        eyebrow="Arus Kas"
        title="Grafik Pegunungan Pemasukan vs Pengeluaran"
        description="Sorot dengan kursor di desktop, atau tekan-dan-tahan lalu geser di layar sentuh untuk membaca nilai persis."
        actions={
          <>
            <SegmentedControl
              items={GRANULARITY_OPTIONS}
              value={granularity}
              onChange={setGranularity}
              ariaLabel="Granularitas grafik"
            />
            <SegmentedControl
              items={[
                { value: "linear" as const, label: "Tajam" },
                { value: "monotone" as const, label: "Halus" },
              ]}
              value={curve}
              onChange={setCurve}
              ariaLabel="Bentuk garis"
            />
          </>
        }
      />

      {/* Legend rail */}
      <div className="flex flex-wrap divide-grid-x border-b border-border">
        {SERIES.map((series) => (
          <div key={series.key} className="flex min-w-[10rem] flex-1 items-center gap-2.5 px-4 py-2.5">
            <span
              aria-hidden
              className="h-0.5 w-4 shrink-0"
              style={{ backgroundColor: series.color }}
            />
            <span className="min-w-0 flex-1 truncate font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              {series.label}
            </span>
            <span className="shrink-0 font-mono text-[11px] text-foreground tabular">
              {formatRupiah(totals[series.key])}
            </span>
          </div>
        ))}
      </div>

      <div
        ref={surfaceRef}
        className="chart-touch-surface relative h-[300px] w-full sm:h-[360px]"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={clearTouch}
        onTouchCancel={clearTouch}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={CHART_MARGIN}>
            <CartesianGrid
              strokeDasharray="0"
              stroke="rgb(var(--line))"
              strokeWidth={1}
              vertical
              horizontal
            />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: "rgb(var(--line))" }}
              tick={{ fontSize: 10, fill: "rgb(var(--ink-muted))" }}
              interval="preserveStartEnd"
              minTickGap={18}
            />
            <YAxis
              tickLine={false}
              axisLine={{ stroke: "rgb(var(--line))" }}
              tick={{ fontSize: 10, fill: "rgb(var(--ink-muted))" }}
              tickFormatter={(value: number) => formatRupiahCompact(value)}
              width={54}
            />
            <Tooltip
              content={<CrosshairTooltip />}
              cursor={{
                stroke: "rgb(var(--ink))",
                strokeWidth: 1,
                strokeDasharray: "3 3",
              }}
              // Suppressed on touch devices; the custom popover takes over.
              active={touchIndex === null ? undefined : false}
              isAnimationActive={false}
            />

            {SERIES.map((series) => (
              <Area
                key={series.key}
                type={curve}
                dataKey={series.key}
                name={series.label}
                stroke={series.color}
                strokeWidth={2}
                /* Flat solid fill — explicitly NOT a gradient. */
                fill={series.color}
                fillOpacity={0.12}
                activeDot={{
                  r: 3,
                  fill: "rgb(var(--canvas))",
                  stroke: series.color,
                  strokeWidth: 1.5,
                }}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>

        {/* ── Touch crosshair + popover ── */}
        {touchPoint !== null && (
          <>
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 w-px bg-foreground"
              style={{ left: `${touchX}px` }}
            />
            <div
              role="status"
              className="pointer-events-none absolute top-3 z-10 w-[11.5rem] border border-border-strong bg-background"
              style={{
                left: `min(max(${touchX - 92}px, 8px), calc(100% - 192px))`,
              }}
            >
              <TooltipBody point={touchPoint} />
            </div>
          </>
        )}

        {data.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              Belum ada data transaksi
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface px-4 py-2.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          {data.length} titik · {granularity}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground tabular">
          Net {formatRupiah(totals.gaji + totals.freelance - totals.pengeluaran)}
        </span>
      </div>
    </Panel>
  );
}

const CHART_MARGIN = { top: 16, right: 16, bottom: 8, left: 8 } as const;

interface TooltipPayloadEntry {
  dataKey?: string | number;
  value?: number;
  payload?: ChartPoint;
}

/** Recharts tooltip shell → shared brutalist popover body. */
function CrosshairTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
}) {
  if (active !== true || payload === undefined || payload.length === 0) return null;

  const point = payload[0]?.payload;
  if (point === undefined) return null;

  return (
    <div className="w-[11.5rem] border border-border-strong bg-background">
      <TooltipBody point={point} />
    </div>
  );
}

function TooltipBody({ point }: { point: ChartPoint }) {
  const net = point.gaji + point.freelance - point.pengeluaran;

  return (
    <>
      <div className="border-b border-border px-3 py-2">
        <p className="eyebrow eyebrow-accent">Rincian</p>
        <p className="mt-1.5 font-mono text-[11px] text-foreground tabular">
          {point.fullLabel}
        </p>
      </div>
      <dl className="divide-grid-y">
        {SERIES.map((series) => (
          <div
            key={series.key}
            className="flex items-center justify-between gap-2 px-3 py-1.5"
          >
            <dt className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden
                className="h-0.5 w-3 shrink-0"
                style={{ backgroundColor: series.color }}
              />
              <span className="truncate font-mono text-[10px] uppercase tracking-[0.07em] text-muted-foreground">
                {series.key === "pengeluaran" ? "Keluar" : series.key}
              </span>
            </dt>
            <dd className="shrink-0 font-mono text-[11px] text-foreground tabular">
              {formatRupiah(point[series.key])}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex items-center justify-between gap-2 border-t border-border bg-surface px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.07em] text-muted-foreground">
          Net
        </span>
        <span
          className={`font-mono text-[11px] tabular ${
            net >= 0 ? "text-success" : "text-danger"
          }`}
        >
          {formatRupiah(net)}
        </span>
      </div>
    </>
  );
}

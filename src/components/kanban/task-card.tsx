"use client";

import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  GripVertical,
  Loader2,
  Lock,
  Trash2,
} from "lucide-react";
import * as React from "react";

import { deleteTaskAction, moveTaskAction } from "@/app/actions/kanban";
import { ProgressRail } from "@/components/ui/panel";
import { BRUTAL_EASE } from "@/components/ui/motion";
import { KANBAN_COLUMNS, QUARANTINE_HOURS } from "@/lib/constants";
import { countdownTo, formatDateShort, formatRupiah } from "@/lib/format";
import { useMounted, useNow } from "@/hooks/use-now";
import { cn } from "@/lib/utils";
import type { KanbanTask } from "@/lib/types/database";

const TYPE_LABEL: Record<KanbanTask["task_type"], string> = {
  freelance_project: "Proyek Freelance",
  wishlist_48h: "Wishlist 48H",
  career_task: "Tugas Karier",
};

/**
 * Kanban card.
 *
 * The 48-hour quarantine countdown ticks client-side every second. It is
 * rendered only after mount (`useMounted`) because any `Date.now()`-derived
 * output would otherwise mismatch between the server and client renders.
 *
 * The lock is advisory in the UI and absolute in the database: the
 * `enforce_wishlist_quarantine()` trigger rejects a premature `done`.
 */
export function TaskCard({
  task,
  onDragStart,
  onDragEnd,
  dragging,
}: {
  task: KanbanTask;
  onDragStart: () => void;
  onDragEnd: () => void;
  dragging: boolean;
}) {
  const now = useNow(1000);
  const mounted = useMounted();
  const [pending, setPending] = React.useState<"left" | "right" | "delete" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const columnIndex = KANBAN_COLUMNS.findIndex((c) => c.status === task.status);
  const prev = columnIndex > 0 ? KANBAN_COLUMNS[columnIndex - 1] : undefined;
  const next =
    columnIndex < KANBAN_COLUMNS.length - 1
      ? KANBAN_COLUMNS[columnIndex + 1]
      : undefined;

  const isWishlist = task.task_type === "wishlist_48h";
  const countdown = countdownTo(task.unlock_at, now);
  const locked = isWishlist && !countdown.expired;

  // Fraction of the 48-hour window already elapsed.
  const elapsedRatio = locked
    ? 1 - countdown.totalMs / (QUARANTINE_HOURS * 3_600_000)
    : 1;

  async function move(direction: "left" | "right") {
    const target = direction === "left" ? prev : next;
    if (target === undefined) return;

    setPending(direction);
    setError(null);
    const result = await moveTaskAction(task.id, target.status);
    setPending(null);
    if (!result.ok) setError(result.error);
  }

  async function remove() {
    setPending("delete");
    setError(null);
    const result = await deleteTaskAction(task.id);
    setPending(null);
    if (!result.ok) setError(result.error);
  }

  return (
    <motion.li
      layout
      layoutId={task.id}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: dragging ? 0.45 : 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28, ease: BRUTAL_EASE }}
      className={cn(
        "border bg-background",
        dragging ? "border-accent" : "border-border",
        "cursor-grab active:cursor-grabbing",
      )}
    >
      {/* Card header rail */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-2.5 py-1.5">
        <span className="flex min-w-0 items-center gap-2">
          <GripVertical
            aria-hidden
            className="size-3 shrink-0 text-muted-foreground/50"
          />
          <span className="truncate font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
            {TYPE_LABEL[task.task_type]}
          </span>
        </span>
        <span className="shrink-0 font-mono text-[9px] text-muted-foreground/50 tabular">
          #{task.position}
        </span>
      </div>

      <div className="px-2.5 py-2.5">
        <p className="text-[13px] font-medium leading-snug text-foreground">
          {task.title}
        </p>

        {task.client_or_store !== null && (
          <p className="mt-1.5 truncate font-mono text-[10px] text-muted-foreground">
            {task.client_or_store}
          </p>
        )}

        {task.amount > 0 && (
          <p className="mt-2 font-mono text-[13px] font-semibold text-foreground tabular">
            {formatRupiah(task.amount)}
          </p>
        )}

        {/* 48-hour quarantine countdown */}
        {isWishlist && task.unlock_at !== null && (
          <div className="mt-2.5 border border-border bg-surface px-2 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                {locked ? (
                  <Lock className="size-2.5 shrink-0 text-warning" />
                ) : (
                  <Clock className="size-2.5 shrink-0 text-success" />
                )}
                <span
                  className={cn(
                    "font-mono text-[9px] uppercase tracking-[0.08em]",
                    locked ? "text-warning" : "text-success",
                  )}
                >
                  {locked ? "Karantina" : "Terbuka"}
                </span>
              </span>
              <span
                className={cn(
                  "font-mono text-[11px] font-semibold tabular",
                  locked ? "text-warning" : "text-success",
                )}
              >
                {mounted ? countdown.labelPrecise : "—"}
              </span>
            </div>
            {locked && (
              <ProgressRail value={elapsedRatio} tone="warning" className="mt-2" />
            )}
            <p className="mt-1.5 font-mono text-[9px] text-muted-foreground tabular">
              Unlock {formatDateShort(task.unlock_at.slice(0, 10))}
            </p>
          </div>
        )}

        {task.notes !== null && (
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            {task.notes}
          </p>
        )}

        {error !== null && (
          <p role="alert" className="mt-2 font-mono text-[10px] leading-relaxed text-danger">
            {error}
          </p>
        )}
      </div>

      {/* Move controls */}
      <div className="flex items-stretch border-t border-border">
        <button
          type="button"
          disabled={prev === undefined || pending !== null}
          onClick={() => move("left")}
          title={prev === undefined ? "Sudah di kolom pertama" : `Pindah ke ${prev.label}`}
          className="flex flex-1 items-center justify-center border-r border-border py-1.5 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground disabled:opacity-30"
        >
          {pending === "left" ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <ChevronLeft className="size-3" />
          )}
        </button>

        <button
          type="button"
          disabled={next === undefined || pending !== null || (locked && next?.status === "done")}
          onClick={() => move("right")}
          title={
            locked && next?.status === "done"
              ? "Terkunci sampai karantina 48 jam selesai"
              : next === undefined
                ? "Sudah di kolom terakhir"
                : `Pindah ke ${next.label}`
          }
          className="flex flex-1 items-center justify-center border-r border-border py-1.5 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground disabled:opacity-30"
        >
          {pending === "right" ? (
            <Loader2 className="size-3 animate-spin" />
          ) : locked && next?.status === "done" ? (
            <Lock className="size-3" />
          ) : (
            <ChevronRight className="size-3" />
          )}
        </button>

        <button
          type="button"
          disabled={pending !== null}
          onClick={remove}
          title="Hapus kartu"
          className="flex w-9 items-center justify-center py-1.5 text-muted-foreground transition-colors hover:bg-danger hover:text-white disabled:opacity-30"
        >
          {pending === "delete" ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Trash2 className="size-3" />
          )}
        </button>
      </div>
    </motion.li>
  );
}

"use client";

import { AnimatePresence } from "framer-motion";
import { Loader2, Plus } from "lucide-react";
import * as React from "react";

import { createTaskAction, moveTaskAction } from "@/app/actions/kanban";
import { TaskCard } from "@/components/kanban/task-card";
import { Button, MotionButton } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/panel";
import { KANBAN_COLUMNS, QUARANTINE_HOURS } from "@/lib/constants";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { KanbanTask, TaskStatus, TaskType } from "@/lib/types/database";

/**
 * Four-column brutalist board.
 *
 * Movement works two ways, deliberately:
 *  • Buttons on each card — the accessible, keyboard-reachable path.
 *  • HTML5 drag-and-drop between columns, with Framer Motion `layout`
 *    animations reflowing the cards.
 *
 * Optimistic reordering is intentionally NOT done locally: the Realtime
 * subscription in the shell refreshes the server data, and the quarantine
 * trigger can legitimately reject a move. Showing the authoritative result is
 * worth the ~200ms.
 */
export function KanbanBoard({ tasks }: { tasks: readonly KanbanTask[] }) {
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = React.useState<TaskStatus | null>(null);
  const [dialogColumn, setDialogColumn] = React.useState<TaskStatus | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const byColumn = React.useMemo(() => {
    const map = new Map<TaskStatus, KanbanTask[]>();
    for (const column of KANBAN_COLUMNS) map.set(column.status, []);
    for (const task of tasks) {
      map.get(task.status)?.push(task);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.position - b.position);
    }
    return map;
  }, [tasks]);

  async function onDropInto(status: TaskStatus) {
    const id = draggingId;
    setDragOverColumn(null);
    setDraggingId(null);
    if (id === null) return;

    const task = tasks.find((t) => t.id === id);
    if (task === undefined || task.status === status) return;

    setError(null);
    const result = await moveTaskAction(id, status);
    if (!result.ok) setError(result.error);
  }

  return (
    <div className="flex flex-col gap-4">
      {error !== null && (
        <p
          role="alert"
          className="border border-danger bg-surface px-4 py-2.5 font-mono text-[11px] leading-relaxed text-danger"
        >
          {error}
        </p>
      )}

      {/* The board scrolls horizontally on narrow screens; the 1px column
          rules stay intact because each column owns its own border. */}
      <div className="table-scroll -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="grid min-w-[62rem] grid-cols-4 border-l border-t border-border">
          {KANBAN_COLUMNS.map((column) => {
            const items = byColumn.get(column.status) ?? [];
            const total = items.reduce((acc, t) => acc + t.amount, 0);
            const isOver = dragOverColumn === column.status;

            return (
              <section
                key={column.status}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOverColumn(column.status);
                }}
                onDragLeave={() => setDragOverColumn(null)}
                onDrop={(event) => {
                  event.preventDefault();
                  void onDropInto(column.status);
                }}
                className={cn(
                  "flex min-h-[28rem] flex-col border-b border-r border-border transition-colors",
                  isOver ? "bg-surface" : "bg-background",
                )}
              >
                {/* Column header */}
                <div className="flex items-start justify-between gap-2 border-b border-border px-3 py-2.5">
                  <div className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground/60 tabular">
                        {column.code}
                      </span>
                      <span className="truncate font-mono text-[10px] uppercase tracking-[0.08em] text-foreground">
                        {column.label}
                      </span>
                    </span>
                    <span className="mt-1.5 block font-mono text-[10px] text-muted-foreground tabular">
                      {items.length} kartu
                      {total > 0 ? ` · ${formatRupiah(total)}` : ""}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDialogColumn(column.status)}
                    title={`Tambah kartu ke ${column.label}`}
                    className="flex h-6 w-6 shrink-0 items-center justify-center border border-border text-muted-foreground transition-colors hover:border-accent hover:bg-accent hover:text-accent-foreground"
                  >
                    <Plus className="size-3" />
                  </button>
                </div>

                {/* Cards */}
                <ul className="flex flex-1 flex-col gap-2 p-2">
                  <AnimatePresence initial={false}>
                    {items.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        dragging={draggingId === task.id}
                        onDragStart={() => setDraggingId(task.id)}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setDragOverColumn(null);
                        }}
                      />
                    ))}
                  </AnimatePresence>

                  {items.length === 0 && (
                    <li className="flex flex-1 items-center justify-center border border-dashed border-border px-3 py-8">
                      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground/60">
                        {isOver ? "Lepas di sini" : "Kolom kosong"}
                      </span>
                    </li>
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      </div>

      <NewTaskDialog
        column={dialogColumn}
        onClose={() => setDialogColumn(null)}
      />
    </div>
  );
}

function NewTaskDialog({
  column,
  onClose,
}: {
  column: TaskStatus | null;
  onClose: () => void;
}) {
  const [taskType, setTaskType] = React.useState<TaskType>("career_task");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (column !== null) {
      setError(null);
      setTaskType("career_task");
    }
  }, [column]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = await createTaskAction(new FormData(event.currentTarget));
    setPending(false);

    if (result.ok) onClose();
    else setError(result.error);
  }

  const columnLabel =
    KANBAN_COLUMNS.find((c) => c.status === column)?.label ?? "Backlog";

  return (
    <Dialog open={column !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="sm">
        <DialogHeader eyebrow={`Kolom · ${columnLabel}`}>
          <DialogTitle>Kartu Baru</DialogTitle>
          <DialogDescription>
            Kartu bertipe Wishlist 48H otomatis masuk karantina{" "}
            {QUARANTINE_HOURS} jam dan dimulai di kolom Backlog.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit}>
          <input type="hidden" name="status" value={column ?? "backlog"} />

          <DialogBody className="flex flex-col gap-4">
            <Field label="Jenis Kartu" htmlFor="kb-type">
              <Select
                id="kb-type"
                name="task_type"
                value={taskType}
                onChange={(event) => setTaskType(event.target.value as TaskType)}
              >
                <option value="career_task">Tugas Karier</option>
                <option value="freelance_project">Proyek Freelance</option>
                <option value="wishlist_48h">Wishlist 48H (karantina)</option>
              </Select>
            </Field>

            {taskType === "wishlist_48h" && (
              <div className="flex items-center gap-2.5 border border-warning bg-surface px-3 py-2.5">
                <Badge tone="warning">Karantina {QUARANTINE_HOURS} Jam</Badge>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Tidak bisa diselesaikan sebelum hitungan mundur berakhir.
                </p>
              </div>
            )}

            <Field label="Judul" htmlFor="kb-title">
              <Input
                id="kb-title"
                name="title"
                type="text"
                placeholder={
                  taskType === "wishlist_48h"
                    ? "Contoh: Headphone baru"
                    : "Contoh: Kirim proposal ke klien"
                }
                required
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nominal (Rp)" htmlFor="kb-amount">
                <Input
                  id="kb-amount"
                  name="amount"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                />
              </Field>
              <Field
                label={taskType === "wishlist_48h" ? "Toko" : "Klien"}
                htmlFor="kb-client"
              >
                <Input
                  id="kb-client"
                  name="client_or_store"
                  type="text"
                  placeholder="Opsional"
                />
              </Field>
            </div>

            <Field label="Catatan" htmlFor="kb-notes">
              <Textarea id="kb-notes" name="notes" rows={2} placeholder="Opsional" />
            </Field>

            {error !== null && (
              <p
                role="alert"
                className="border border-danger bg-surface px-3 py-2 font-mono text-[11px] leading-relaxed text-danger"
              >
                {error}
              </p>
            )}
          </DialogBody>

          <DialogFooter>
            {/* Adjacent-button rule: Batal monochrome, Simpan accent. */}
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Batal
            </Button>
            <MotionButton type="submit" variant="accent" size="sm" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Menyimpan
                </>
              ) : (
                "Simpan Kartu"
              )}
            </MotionButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

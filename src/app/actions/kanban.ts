"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/guard";
import { QUARANTINE_HOURS } from "@/lib/constants";
import { parseRupiahInput } from "@/lib/format";
import { toRupiah } from "@/lib/finance";
import { createServiceClient } from "@/lib/supabase/server";
import type {
  ActionResult,
  TaskStatus,
  TaskType,
} from "@/lib/types/database";
import { translateDbError } from "@/lib/utils";

const TASK_TYPES: readonly TaskType[] = [
  "freelance_project",
  "wishlist_48h",
  "career_task",
];

const TASK_STATUSES: readonly TaskStatus[] = [
  "backlog",
  "in_progress",
  "review",
  "done",
];

export async function createTaskAction(
  formData: FormData,
): Promise<ActionResult<{ id: string; unlockAt: string | null }>> {
  await requireSession();

  const title = String(formData.get("title") ?? "").trim();
  const taskType = String(formData.get("task_type") ?? "") as TaskType;
  const status = (String(formData.get("status") ?? "backlog") || "backlog") as TaskStatus;
  const amount = toRupiah(parseRupiahInput(String(formData.get("amount") ?? "0")));
  const clientOrStore = String(formData.get("client_or_store") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (title.length === 0) {
    return { ok: false, error: "Judul kartu wajib diisi.", field: "title" };
  }
  if (!TASK_TYPES.includes(taskType)) {
    return { ok: false, error: "Jenis kartu tidak dikenal.", field: "task_type" };
  }
  if (!TASK_STATUSES.includes(status)) {
    return { ok: false, error: "Kolom tujuan tidak dikenal.", field: "status" };
  }
  if (amount < 0) {
    return { ok: false, error: "Nominal tidak boleh negatif.", field: "amount" };
  }

  // The 48-hour quarantine clock is armed by the database trigger
  // `prepare_kanban_task()`; computing it here too would risk drift.
  const unlockAt =
    taskType === "wishlist_48h"
      ? new Date(Date.now() + QUARANTINE_HOURS * 3_600_000).toISOString()
      : null;

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("kanban_tasks")
      .insert({
        title,
        task_type: taskType,
        // A fresh wishlist always starts in quarantine, never further along.
        status: taskType === "wishlist_48h" ? "backlog" : status,
        amount,
        client_or_store: clientOrStore.length > 0 ? clientOrStore : null,
        unlock_at: unlockAt,
        notes: notes.length > 0 ? notes : null,
      })
      .select("id, unlock_at")
      .single();

    if (error) throw new Error(error.message);

    revalidatePath("/kanban");
    revalidatePath("/dashboard");
    return {
      ok: true,
      data: { id: data.id, unlockAt: data.unlock_at },
      message:
        taskType === "wishlist_48h"
          ? "Wishlist masuk karantina 48 jam. Tidak bisa diselesaikan sebelum waktunya habis."
          : "Kartu dibuat.",
    };
  } catch (error) {
    return { ok: false, error: translateDbError(error) };
  }
}

/**
 * Move a card between columns.
 *
 * The 48-hour quarantine is enforced by the `enforce_wishlist_quarantine()`
 * trigger; this pre-check only produces a clearer message.
 */
export async function moveTaskAction(
  id: string,
  status: TaskStatus,
  position?: number,
): Promise<ActionResult<undefined>> {
  await requireSession();

  if (id.length === 0) return { ok: false, error: "ID kartu tidak valid." };
  if (!TASK_STATUSES.includes(status)) {
    return { ok: false, error: "Kolom tujuan tidak dikenal." };
  }

  try {
    const supabase = createServiceClient();

    const { data: task, error: readError } = await supabase
      .from("kanban_tasks")
      .select("task_type, unlock_at, title")
      .eq("id", id)
      .single();

    if (readError) throw new Error(readError.message);

    if (
      task.task_type === "wishlist_48h" &&
      status === "done" &&
      task.unlock_at !== null &&
      Date.now() < new Date(task.unlock_at).getTime()
    ) {
      return {
        ok: false,
        error: `"${task.title}" masih dikarantina 48 jam. Selesaikan setelah hitungan mundur berakhir.`,
      };
    }

    const update: { status: TaskStatus; position?: number } = { status };
    if (position !== undefined) update.position = position;

    const { error } = await supabase.from("kanban_tasks").update(update).eq("id", id);
    if (error) throw new Error(error.message);

    revalidatePath("/kanban");
    revalidatePath("/dashboard");
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: translateDbError(error) };
  }
}

export async function updateTaskAction(
  formData: FormData,
): Promise<ActionResult<undefined>> {
  await requireSession();

  const id = String(formData.get("id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const amount = toRupiah(parseRupiahInput(String(formData.get("amount") ?? "0")));
  const clientOrStore = String(formData.get("client_or_store") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (id.length === 0) return { ok: false, error: "ID kartu tidak valid." };
  if (title.length === 0) {
    return { ok: false, error: "Judul kartu wajib diisi.", field: "title" };
  }

  try {
    const supabase = createServiceClient();
    const { error } = await supabase
      .from("kanban_tasks")
      .update({
        title,
        amount,
        client_or_store: clientOrStore.length > 0 ? clientOrStore : null,
        notes: notes.length > 0 ? notes : null,
      })
      .eq("id", id);

    if (error) throw new Error(error.message);

    revalidatePath("/kanban");
    return { ok: true, data: undefined, message: "Kartu diperbarui." };
  } catch (error) {
    return { ok: false, error: translateDbError(error) };
  }
}

export async function deleteTaskAction(id: string): Promise<ActionResult<undefined>> {
  await requireSession();

  if (id.length === 0) return { ok: false, error: "ID kartu tidak valid." };

  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("kanban_tasks").delete().eq("id", id);
    if (error) throw new Error(error.message);

    revalidatePath("/kanban");
    revalidatePath("/dashboard");
    return { ok: true, data: undefined, message: "Kartu dihapus." };
  } catch (error) {
    return { ok: false, error: translateDbError(error) };
  }
}

/** Persist a reordered column after a drag-and-drop gesture. */
export async function reorderColumnAction(
  status: TaskStatus,
  orderedIds: readonly string[],
): Promise<ActionResult<{ updated: number }>> {
  await requireSession();

  if (!TASK_STATUSES.includes(status)) {
    return { ok: false, error: "Kolom tidak dikenal." };
  }
  if (orderedIds.length === 0) {
    return { ok: true, data: { updated: 0 } };
  }

  try {
    const supabase = createServiceClient();

    await Promise.all(
      orderedIds.map((id, index) =>
        supabase
          .from("kanban_tasks")
          .update({ status, position: index + 1 })
          .eq("id", id),
      ),
    );

    revalidatePath("/kanban");
    return { ok: true, data: { updated: orderedIds.length } };
  } catch (error) {
    return { ok: false, error: translateDbError(error) };
  }
}

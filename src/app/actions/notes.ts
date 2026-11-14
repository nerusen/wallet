"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/guard";
import { todayWIB } from "@/lib/format";
import { createServiceClient } from "@/lib/supabase/server";
import type { ActionResult, DailyNote, NoteTag } from "@/lib/types/database";
import { translateDbError } from "@/lib/utils";

const NOTE_TAGS: readonly NoteTag[] = [
  "Harian",
  "Evaluasi",
  "Ide Freelance",
  "Target",
  "Lainnya",
];

function isNoteTag(value: string): value is NoteTag {
  return (NOTE_TAGS as readonly string[]).includes(value);
}

/** Create a blank canvas. `position` is auto-assigned by the DB trigger. */
export async function createNoteAction(
  formData?: FormData,
): Promise<ActionResult<{ note: DailyNote }>> {
  await requireSession();

  const rawTag = String(formData?.get("tag") ?? "Harian").trim();
  const tag: NoteTag = isNoteTag(rawTag) ? rawTag : "Harian";
  const rawDate = String(formData?.get("note_date") ?? "").trim();
  const noteDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : todayWIB();

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("daily_notes")
      .insert({
        title: "Catatan Tanpa Judul",
        content: "",
        tag,
        note_date: noteDate,
        is_pinned: false,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    revalidatePath("/catatan");
    return { ok: true, data: { note: data }, message: "Canvas baru dibuat." };
  } catch (error) {
    return { ok: false, error: translateDbError(error) };
  }
}

/**
 * Persist a canvas.
 *
 * Backs both the explicit `Simpan` button and the debounced auto-save, so it
 * must stay idempotent — saving unchanged content is a no-op apart from
 * `updated_at`, which the DB trigger refreshes.
 */
export async function updateNoteAction(
  formData: FormData,
): Promise<ActionResult<{ updatedAt: string }>> {
  await requireSession();

  const id = String(formData.get("id") ?? "").trim();
  if (id.length === 0) return { ok: false, error: "ID catatan tidak valid." };

  const rawTitle = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "");
  const rawTag = String(formData.get("tag") ?? "Harian").trim();
  const rawDate = String(formData.get("note_date") ?? "").trim();

  if (!isNoteTag(rawTag)) {
    return { ok: false, error: "Tag tidak dikenal.", field: "tag" };
  }
  if (rawDate.length > 0 && !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    return { ok: false, error: "Tanggal tidak valid.", field: "note_date" };
  }

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("daily_notes")
      .update({
        // Never persist an empty title: the column is NOT NULL with a default.
        title: rawTitle.length > 0 ? rawTitle : "Catatan Tanpa Judul",
        content,
        tag: rawTag,
        ...(rawDate.length > 0 ? { note_date: rawDate } : {}),
      })
      .eq("id", id)
      .select("updated_at")
      .single();

    if (error) throw new Error(error.message);

    revalidatePath("/catatan");
    return { ok: true, data: { updatedAt: data.updated_at }, message: "Tersimpan." };
  } catch (error) {
    return { ok: false, error: translateDbError(error) };
  }
}

export async function toggleNotePinAction(
  id: string,
  pinned: boolean,
): Promise<ActionResult<{ pinned: boolean }>> {
  await requireSession();

  if (id.length === 0) return { ok: false, error: "ID catatan tidak valid." };

  try {
    const supabase = createServiceClient();
    const { error } = await supabase
      .from("daily_notes")
      .update({ is_pinned: pinned })
      .eq("id", id);

    if (error) throw new Error(error.message);

    revalidatePath("/catatan");
    return {
      ok: true,
      data: { pinned },
      message: pinned ? "Catatan dipin ke atas." : "Pin dilepas.",
    };
  } catch (error) {
    return { ok: false, error: translateDbError(error) };
  }
}

export async function deleteNoteAction(id: string): Promise<ActionResult<undefined>> {
  await requireSession();

  if (id.length === 0) return { ok: false, error: "ID catatan tidak valid." };

  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("daily_notes").delete().eq("id", id);
    if (error) throw new Error(error.message);

    revalidatePath("/catatan");
    return { ok: true, data: undefined, message: "Canvas dihapus." };
  } catch (error) {
    return { ok: false, error: translateDbError(error) };
  }
}

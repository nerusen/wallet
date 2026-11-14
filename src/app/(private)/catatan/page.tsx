import type { Metadata } from "next";

import { LoadError } from "@/components/shell/page-header";
import { NotesWorkspace } from "@/components/notes/notes-workspace";
import { formatDateShort, todayWIB } from "@/lib/format";
import { createServiceClient } from "@/lib/supabase/server";
import type { DailyNote } from "@/lib/types/database";

export const metadata: Metadata = {
  title: "Catatan Harian",
  description: "Daftar catatan harian dengan kanvas tulis khusus per catatan.",
};

export const dynamic = "force-dynamic";

async function fetchNotes(): Promise<{ notes: DailyNote[]; error: string | null }> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("daily_notes")
      .select("*")
      .order("is_pinned", { ascending: false })
      .order("note_date", { ascending: false })
      .order("updated_at", { ascending: false });

    if (error) throw new Error(error.message);
    return { notes: data ?? [], error: null };
  } catch (error) {
    return {
      notes: [],
      error: error instanceof Error ? error.message : "Gagal memuat catatan.",
    };
  }
}

/**
 * The header and metadata strip are rendered inside `NotesWorkspace` rather
 * than here, so both can be hidden while the dedicated editor canvas is open.
 */
export default async function CatatanPage() {
  const today = todayWIB();
  const { notes, error } = await fetchNotes();

  return (
    <>
      {error !== null && (
        <div className="px-4 pt-4 sm:px-6">
          <LoadError message={error} />
        </div>
      )}

      <NotesWorkspace
        initialNotes={notes}
        today={today}
        todayLabel={formatDateShort(today)}
      />
    </>
  );
}

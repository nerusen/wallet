import type { Metadata } from "next";

import { LoadError, PageBody, PageHeader } from "@/components/shell/page-header";
import { NotesBoard } from "@/components/notes/notes-board";
import { todayWIB } from "@/lib/format";
import { createServiceClient } from "@/lib/supabase/server";
import type { DailyNote } from "@/lib/types/database";

export const metadata: Metadata = {
  title: "Catatan Harian",
  description: "Canvas catatan harian tanpa batas, tersimpan di Supabase.",
};

export const dynamic = "force-dynamic";

async function fetchNotes(): Promise<{ notes: DailyNote[]; error: string | null }> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("daily_notes")
      .select("*")
      .order("is_pinned", { ascending: false })
      .order("position", { ascending: true });

    if (error) throw new Error(error.message);
    return { notes: data ?? [], error: null };
  } catch (error) {
    return {
      notes: [],
      error: error instanceof Error ? error.message : "Gagal memuat catatan.",
    };
  }
}

export default async function CatatanPage() {
  const today = todayWIB();
  const { notes, error } = await fetchNotes();

  const pinned = notes.filter((n) => n.is_pinned).length;
  const words = notes.reduce(
    (acc, n) => acc + (n.content.trim().length === 0 ? 0 : n.content.trim().split(/\s+/).length),
    0,
  );

  return (
    <>
      <PageHeader
        eyebrow="Modul 09 · Notes"
        title="Catatan Harian"
        description="Setiap catatan adalah canvas terpisah. Tulis bebas setiap hari — refleksi, checklist, ide freelance, atau target. Perubahan disimpan otomatis."
        meta={[
          { label: "Total Canvas", value: String(notes.length) },
          { label: "Dipin", value: String(pinned) },
          { label: "Total Kata", value: String(words) },
          { label: "Hari Ini", value: today },
        ]}
      />

      <PageBody>
        {error !== null && <LoadError message={error} />}
        <NotesBoard initialNotes={notes} today={today} />
      </PageBody>
    </>
  );
}

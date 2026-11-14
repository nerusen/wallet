"use client";

import { Loader2, Plus, Search } from "lucide-react";
import * as React from "react";

import { createNoteAction } from "@/app/actions/notes";
import { NoteEditor } from "@/components/notes/note-editor";
import { NotePreviewCard } from "@/components/notes/note-preview-card";
import { PageMetadataGrid } from "@/components/shell/page-metadata-grid";
import { PageHeader } from "@/components/shell/page-header";
import { Button, MotionButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, Panel } from "@/components/ui/panel";
import { Reveal } from "@/components/ui/motion";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { cn } from "@/lib/utils";
import type { DailyNote, NoteTag } from "@/lib/types/database";

/** `Semua` and `Dipin` are pseudo-tags layered over the real tag column. */
const FILTERS = [
  "Semua",
  "Dipin",
  "Harian",
  "Evaluasi",
  "Ide Freelance",
  "Target",
  "Lainnya",
] as const;

type Filter = (typeof FILTERS)[number];

/**
 * Master-detail notes workspace.
 *
 * View 1 is a read-only list of compact preview cards; View 2 is the dedicated
 * editor canvas. Both live in one client component so switching views is
 * instant and no draft is lost to a route transition.
 *
 * The page header is rendered here (not by the server page) so it can be
 * hidden while the editor is open, giving the canvas the full viewport.
 */
export function NotesWorkspace({
  initialNotes,
  today,
  todayLabel,
}: {
  initialNotes: readonly DailyNote[];
  today: string;
  todayLabel: string;
}) {
  const [notes, setNotes] = React.useState<DailyNote[]>([...initialNotes]);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("Semua");
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Suspended while editing: a refresh mid-typing would replace the draft.
  useRealtimeRefresh(["daily_notes"], { enabled: openId === null });

  React.useEffect(() => {
    setNotes([...initialNotes]);
  }, [initialNotes]);

  const sorted = React.useMemo(
    () =>
      [...notes].sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        // Newest first within each pin group.
        if (a.note_date !== b.note_date) return a.note_date < b.note_date ? 1 : -1;
        return a.updated_at < b.updated_at ? 1 : -1;
      }),
    [notes],
  );

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();

    return sorted.filter((note) => {
      if (filter === "Dipin" && !note.is_pinned) return false;
      if (filter !== "Semua" && filter !== "Dipin" && note.tag !== filter) {
        return false;
      }
      if (needle.length > 0) {
        const haystack = `${note.title} ${note.content} ${note.tag}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [sorted, query, filter]);

  const openNote = React.useMemo(
    () => (openId === null ? null : (notes.find((n) => n.id === openId) ?? null)),
    [openId, notes],
  );

  async function createAndOpen() {
    setCreating(true);
    setError(null);

    const formData = new FormData();
    // A real tag filter seeds the new note; pseudo-filters fall back to Harian.
    formData.set(
      "tag",
      filter === "Semua" || filter === "Dipin" ? "Harian" : filter,
    );
    formData.set("note_date", today);

    const result = await createNoteAction(formData);
    setCreating(false);

    if (result.ok) {
      // Insert locally and open immediately, so the editor does not wait for
      // the server round-trip triggered by revalidatePath.
      setNotes((prev) => [result.data.note, ...prev]);
      setOpenId(result.data.note.id);
    } else {
      setError(result.error);
    }
  }

  /* ── View 2: dedicated editor canvas ── */
  if (openNote !== null) {
    return (
      <NoteEditor
        key={openNote.id}
        note={openNote}
        onBack={() => setOpenId(null)}
        onDeleted={() => {
          setNotes((prev) => prev.filter((n) => n.id !== openNote.id));
          setOpenId(null);
        }}
      />
    );
  }

  /* ── View 1: list of compact previews ── */
  const pinned = notes.filter((n) => n.is_pinned).length;
  const words = notes.reduce(
    (acc, n) =>
      acc + (n.content.trim().length === 0 ? 0 : n.content.trim().split(/\s+/).length),
    0,
  );
  const hasFilters = query.trim().length > 0 || filter !== "Semua";

  return (
    <>
      <PageHeader
        eyebrow="Modul 09 · Notes"
        title="Catatan Harian"
        description="Ketuk sebuah catatan untuk membuka kanvas tulis penuh. Perubahan disimpan otomatis."
        actions={
          <MotionButton
            type="button"
            variant="accent"
            size="sm"
            disabled={creating}
            onClick={() => void createAndOpen()}
          >
            {creating ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Membuat
              </>
            ) : (
              <>
                <Plus className="size-3.5" />
                Catatan Baru
              </>
            )}
          </MotionButton>
        }
      />

      <PageMetadataGrid
        items={[
          { label: "Total Catatan", value: String(notes.length) },
          { label: "Dipin", value: String(pinned) },
          { label: "Total Kata", value: String(words) },
          { label: "Hari Ini", value: todayLabel },
        ]}
      />

      {/* ── Search ── */}
      <div className="border-b border-border px-4 py-3 sm:px-6">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari judul atau isi catatan..."
            aria-label="Cari catatan"
            className="pl-7"
          />
        </div>
      </div>

      {/* ── Tag filter rail ── */}
      <div
        role="tablist"
        aria-label="Filter tag"
        className="table-scroll flex border-b border-border"
      >
        {FILTERS.map((item) => {
          const active = filter === item;
          const count =
            item === "Semua"
              ? notes.length
              : item === "Dipin"
                ? pinned
                : notes.filter((n) => n.tag === item).length;

          return (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(item)}
              className={cn(
                "relative shrink-0 border-r border-border px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors",
                active
                  ? "bg-surface text-foreground"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground",
              )}
            >
              <span className="flex items-center gap-1.5">
                {item}
                <span className="text-muted-foreground/60 tabular">{count}</span>
              </span>
              {active && (
                <span
                  aria-hidden
                  className="absolute inset-x-0 -bottom-px block h-0.5 bg-accent"
                />
              )}
            </button>
          );
        })}
      </div>

      {error !== null && (
        <p
          role="alert"
          className="border-b border-danger bg-surface px-4 py-2.5 font-mono text-[11px] text-danger sm:px-6"
        >
          {error}
        </p>
      )}

      {/* ── Preview list ── */}
      <div className="px-4 py-5 sm:px-6">
        {filtered.length === 0 ? (
          <Panel>
            <EmptyState
              title={hasFilters ? "Tidak ada catatan cocok" : "Belum ada catatan"}
              description={
                hasFilters
                  ? "Longgarkan filter atau kosongkan kata kunci pencarian."
                  : "Tekan Catatan Baru untuk membuka kanvas tulis pertama."
              }
              action={
                hasFilters ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setQuery("");
                      setFilter("Semua");
                    }}
                  >
                    Reset Filter
                  </Button>
                ) : undefined
              }
            />
          </Panel>
        ) : (
          <Reveal>
            <div className="divide-y divide-border border border-border">
              {filtered.map((note) => (
                <NotePreviewCard
                  key={note.id}
                  note={note}
                  onOpen={() => setOpenId(note.id)}
                />
              ))}
            </div>
          </Reveal>
        )}

        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          {filtered.length} dari {notes.length} catatan
        </p>
      </div>

      {/* ── Sticky mobile FAB: one-thumb reach ── */}
      <MotionButton
        type="button"
        variant="accent"
        size="icon"
        disabled={creating}
        onClick={() => void createAndOpen()}
        aria-label="Catatan baru"
        title="Catatan baru"
        className="fixed bottom-5 right-5 z-30 h-12 w-12 border-2 sm:hidden"
      >
        {creating ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Plus className="size-4" />
        )}
      </MotionButton>
    </>
  );
}

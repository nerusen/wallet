"use client";

import {
  Check,
  Loader2,
  Pin,
  PinOff,
  Plus,
  Rows3,
  Search,
  Columns2,
  Trash2,
} from "lucide-react";
import * as React from "react";

import {
  createNoteAction,
  deleteNoteAction,
  toggleNotePinAction,
  updateNoteAction,
} from "@/app/actions/notes";
import { Button, MotionButton } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui/panel";
import { StaggerGrid, StaggerItem } from "@/components/ui/motion";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DailyNote, NoteTag } from "@/lib/types/database";

const NOTE_TAGS: readonly NoteTag[] = [
  "Harian",
  "Evaluasi",
  "Ide Freelance",
  "Target",
  "Lainnya",
];

type PinFilter = "all" | "pinned" | "unpinned";
type LayoutMode = "grid" | "focus";

/**
 * Multi-canvas notes board.
 *
 * Each note is an independent framed canvas with its own local draft state and
 * debounced auto-save, so typing in one canvas never re-renders or blocks the
 * others. The server stays authoritative: `revalidatePath` + Realtime push the
 * canonical rows back down.
 */
export function NotesBoard({
  initialNotes,
  today,
}: {
  initialNotes: readonly DailyNote[];
  today: string;
}) {
  const [notes, setNotes] = React.useState<DailyNote[]>([...initialNotes]);
  const [query, setQuery] = React.useState("");
  const [tagFilter, setTagFilter] = React.useState<NoteTag | "all">("all");
  const [pinFilter, setPinFilter] = React.useState<PinFilter>("all");
  const [layout, setLayout] = React.useState<LayoutMode>("grid");
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  useRealtimeRefresh(["daily_notes"]);

  React.useEffect(() => {
    setNotes([...initialNotes]);
  }, [initialNotes]);

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();

    return notes
      .filter((note) => {
        if (tagFilter !== "all" && note.tag !== tagFilter) return false;
        if (pinFilter === "pinned" && !note.is_pinned) return false;
        if (pinFilter === "unpinned" && note.is_pinned) return false;
        if (needle.length > 0) {
          const haystack = `${note.title} ${note.content} ${note.tag}`.toLowerCase();
          if (!haystack.includes(needle)) return false;
        }
        return true;
      })
      // Pinned first, then by board position.
      .sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return a.position - b.position;
      });
  }, [notes, query, tagFilter, pinFilter]);

  async function onCreate() {
    setCreating(true);
    setError(null);
    const formData = new FormData();
    formData.set("tag", tagFilter === "all" ? "Harian" : tagFilter);
    formData.set("note_date", today);

    const result = await createNoteAction(formData);
    setCreating(false);
    if (!result.ok) setError(result.error);
  }

  const hasFilters =
    query.trim().length > 0 || tagFilter !== "all" || pinFilter !== "all";

  return (
    <div className="flex flex-col gap-6">
      {/* ── Filter + search rail ── */}
      <Panel>
        <PanelHeader
          code="00"
          eyebrow="Papan Catatan"
          title={`${filtered.length} dari ${notes.length} canvas`}
          description="Tulis apa pun setiap hari: refleksi, checklist, ide, atau pengingat. Tersimpan otomatis ke Supabase."
          actions={
            <>
              {/* Adjacent-button rule: only one accent fill. */}
              <MotionButton
                type="button"
                variant="accent"
                size="sm"
                disabled={creating}
                onClick={onCreate}
              >
                {creating ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Membuat
                  </>
                ) : (
                  <>
                    <Plus className="size-3.5" />
                    Tambah Canvas
                  </>
                )}
              </MotionButton>

              <div className="inline-flex border border-border">
                <button
                  type="button"
                  aria-pressed={layout === "grid"}
                  onClick={() => setLayout("grid")}
                  title="Tampilan 2 kolom"
                  className={cn(
                    "flex h-8 w-8 items-center justify-center transition-colors",
                    layout === "grid"
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-surface hover:text-foreground",
                  )}
                >
                  <Columns2 className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-pressed={layout === "focus"}
                  onClick={() => setLayout("focus")}
                  title="Tampilan 1 kolom (fokus)"
                  className={cn(
                    "flex h-8 w-8 items-center justify-center border-l border-border transition-colors",
                    layout === "focus"
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-surface hover:text-foreground",
                  )}
                >
                  <Rows3 className="size-3.5" />
                </button>
              </div>
            </>
          }
        />

        <div className="outline-grid grid-cols-1 border-t-0 sm:grid-cols-3">
          <div className="bg-background p-3">
            <label htmlFor="note-search" className="eyebrow">
              Cari Judul / Isi
            </label>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="note-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Kata kunci…"
                className="pl-7"
              />
            </div>
          </div>

          <div className="bg-background p-3">
            <label htmlFor="note-tag" className="eyebrow">
              Tag
            </label>
            <Select
              id="note-tag"
              value={tagFilter}
              onChange={(event) => setTagFilter(event.target.value as NoteTag | "all")}
              className="mt-2"
            >
              <option value="all">Semua tag</option>
              {NOTE_TAGS.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </Select>
          </div>

          <div className="bg-background p-3">
            <label htmlFor="note-pin" className="eyebrow">
              Status Pin
            </label>
            <Select
              id="note-pin"
              value={pinFilter}
              onChange={(event) => setPinFilter(event.target.value as PinFilter)}
              className="mt-2"
            >
              <option value="all">Semua</option>
              <option value="pinned">Hanya dipin</option>
              <option value="unpinned">Tanpa pin</option>
            </Select>
          </div>
        </div>

        {error !== null && (
          <p
            role="alert"
            className="border-t border-danger bg-surface px-4 py-2.5 font-mono text-[11px] text-danger"
          >
            {error}
          </p>
        )}
      </Panel>

      {/* ── Canvases ── */}
      {filtered.length === 0 ? (
        <Panel>
          <EmptyState
            title={hasFilters ? "Tidak ada catatan cocok" : "Belum ada canvas"}
            description={
              hasFilters
                ? "Longgarkan filter atau kosongkan kata kunci pencarian."
                : "Tekan Tambah Canvas untuk mulai menulis catatan harian pertama."
            }
            action={
              hasFilters ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQuery("");
                    setTagFilter("all");
                    setPinFilter("all");
                  }}
                >
                  Reset Filter
                </Button>
              ) : undefined
            }
          />
        </Panel>
      ) : (
        <StaggerGrid
          className={cn(
            "grid gap-4",
            layout === "grid" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1",
          )}
        >
          {filtered.map((note, index) => (
            <StaggerItem key={note.id}>
              <NoteCanvas note={note} index={index + 1} />
            </StaggerItem>
          ))}
        </StaggerGrid>
      )}
    </div>
  );
}

/* ── Single canvas ───────────────────────────────────────────────────────── */

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

function NoteCanvas({ note, index }: { note: DailyNote; index: number }) {
  const [title, setTitle] = React.useState(note.title);
  const [content, setContent] = React.useState(note.content);
  const [tag, setTag] = React.useState<NoteTag>(note.tag);
  const [noteDate, setNoteDate] = React.useState(note.note_date);
  const [state, setState] = React.useState<SaveState>("idle");
  const [message, setMessage] = React.useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = React.useState(note.updated_at);
  const [pinPending, setPinPending] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards the auto-save effect from firing on first mount.
  const mountedRef = React.useRef(false);

  // Adopt server values when they change and the user has no pending edits.
  React.useEffect(() => {
    if (state === "idle" || state === "saved") {
      setTitle(note.title);
      setContent(note.content);
      setTag(note.tag);
      setNoteDate(note.note_date);
      setUpdatedAt(note.updated_at);
    }
    // `state` is deliberately excluded: including it would clobber a draft the
    // moment a save settles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.title, note.content, note.tag, note.note_date, note.updated_at]);

  const save = React.useCallback(
    async (next: { title: string; content: string; tag: NoteTag; noteDate: string }) => {
      setState("saving");
      setMessage(null);

      const formData = new FormData();
      formData.set("id", note.id);
      formData.set("title", next.title);
      formData.set("content", next.content);
      formData.set("tag", next.tag);
      formData.set("note_date", next.noteDate);

      const result = await updateNoteAction(formData);

      if (result.ok) {
        setUpdatedAt(result.data.updatedAt);
        setState("saved");
        setTimeout(() => setState((prev) => (prev === "saved" ? "idle" : prev)), 2000);
      } else {
        setState("error");
        setMessage(result.error);
      }
    },
    [note.id],
  );

  // Debounced auto-save: 1.2s after the last keystroke.
  React.useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }

    const unchanged =
      title === note.title &&
      content === note.content &&
      tag === note.tag &&
      noteDate === note.note_date;
    if (unchanged) return;

    setState("dirty");
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void save({ title, content, tag, noteDate });
    }, 1200);

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [title, content, tag, noteDate, note, save]);

  async function onTogglePin() {
    setPinPending(true);
    const result = await toggleNotePinAction(note.id, !note.is_pinned);
    setPinPending(false);
    if (!result.ok) setMessage(result.error);
  }

  async function onDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 4000);
      return;
    }
    setDeleting(true);
    const result = await deleteNoteAction(note.id);
    setDeleting(false);
    if (!result.ok) setMessage(result.error);
  }

  const words = content.trim().length === 0 ? 0 : content.trim().split(/\s+/).length;

  const stateLabel: Record<SaveState, string> = {
    idle: "Tersinkron",
    dirty: "Belum disimpan",
    saving: "Menyimpan…",
    saved: "Tersimpan",
    error: "Gagal simpan",
  };

  return (
    <article
      className={cn(
        "flex h-full flex-col border bg-card",
        note.is_pinned ? "border-accent" : "border-border",
      )}
    >
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <span className="eyebrow shrink-0 border border-border px-1.5 py-1">
          {String(index).padStart(2, "0")}
        </span>

        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Judul catatan"
          aria-label="Judul catatan"
          className="min-w-0 flex-1 border-0 bg-transparent px-0 py-1 text-[13px] font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none"
        />

        <input
          type="date"
          value={noteDate}
          onChange={(event) => setNoteDate(event.target.value)}
          aria-label="Tanggal catatan"
          className="shrink-0 border border-border bg-background px-1.5 py-1 font-mono text-[10px] text-muted-foreground tabular focus:border-accent focus:outline-none"
        />

        <select
          value={tag}
          onChange={(event) => setTag(event.target.value as NoteTag)}
          aria-label="Tag catatan"
          className="shrink-0 appearance-none border border-border bg-background px-1.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground focus:border-accent focus:outline-none"
        >
          {NOTE_TAGS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={onTogglePin}
          disabled={pinPending}
          title={note.is_pinned ? "Lepas pin" : "Pin ke atas"}
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center border transition-colors",
            note.is_pinned
              ? "border-accent bg-accent text-accent-foreground"
              : "border-border text-muted-foreground hover:bg-surface hover:text-foreground",
          )}
        >
          {pinPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : note.is_pinned ? (
            <Pin className="size-3" />
          ) : (
            <PinOff className="size-3" />
          )}
        </button>

        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          title={confirmDelete ? "Klik lagi untuk konfirmasi hapus" : "Hapus canvas"}
          className={cn(
            "flex h-7 shrink-0 items-center justify-center border px-1.5 transition-colors",
            confirmDelete
              ? "border-danger bg-danger text-white"
              : "border-border text-muted-foreground hover:bg-danger hover:text-white",
          )}
        >
          {deleting ? (
            <Loader2 className="size-3 animate-spin" />
          ) : confirmDelete ? (
            <span className="font-mono text-[9px] uppercase tracking-[0.08em]">Yakin?</span>
          ) : (
            <Trash2 className="size-3" />
          )}
        </button>
      </div>

      {/* Writing surface */}
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="Tulis apa pun di sini — refleksi harian, checklist, ide freelance, target, atau pengingat…"
        aria-label="Isi catatan"
        className="min-h-[180px] flex-1 resize-y border-0 bg-transparent px-3.5 py-3 font-sans text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
      />

      {message !== null && (
        <p
          role="alert"
          className="border-t border-danger px-3 py-1.5 font-mono text-[10px] text-danger"
        >
          {message}
        </p>
      )}

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2">
        <span className="flex flex-wrap items-center gap-2.5">
          <span className="font-mono text-[10px] text-muted-foreground tabular">
            {content.length} karakter · {words} kata
          </span>
          <Badge
            tone={
              state === "error"
                ? "danger"
                : state === "dirty"
                  ? "warning"
                  : state === "saved"
                    ? "success"
                    : "neutral"
            }
          >
            {stateLabel[state]}
          </Badge>
        </span>

        <span className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground tabular">
            {formatDateShort(updatedAt.slice(0, 10))}
          </span>
          <MotionButton
            type="button"
            variant={state === "dirty" || state === "error" ? "accent" : "outline"}
            size="xs"
            disabled={state === "saving"}
            onClick={() => void save({ title, content, tag, noteDate })}
          >
            {state === "saving" ? (
              <>
                <Loader2 className="size-3 animate-spin" />
                Menyimpan
              </>
            ) : state === "saved" ? (
              <>
                <Check className="size-3" />
                Tersimpan
              </>
            ) : (
              "Simpan"
            )}
          </MotionButton>
        </span>
      </div>
    </article>
  );
}

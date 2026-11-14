"use client";

import { ArrowLeft, Check, Loader2, Pin, PinOff, Trash2 } from "lucide-react";
import * as React from "react";

import {
  deleteNoteAction,
  toggleNotePinAction,
  updateNoteAction,
} from "@/app/actions/notes";
import { noteDateLabel } from "@/components/notes/note-preview-card";
import { Button, MotionButton } from "@/components/ui/button";
import { Reveal } from "@/components/ui/motion";
import { cn } from "@/lib/utils";
import type { DailyNote, NoteTag } from "@/lib/types/database";

const NOTE_TAGS: readonly NoteTag[] = [
  "Harian",
  "Evaluasi",
  "Ide Freelance",
  "Target",
  "Lainnya",
];

const AUTOSAVE_DEBOUNCE_MS = 800;

type SyncState = "synced" | "dirty" | "saving" | "error";

const SYNC_LABEL: Record<SyncState, string> = {
  synced: "TERSINKRON",
  dirty: "BELUM DISIMPAN",
  saving: "MENYIMPAN...",
  error: "GAGAL SIMPAN",
};

/** `HH:mm` in WIB. */
function timeWIBLabel(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/**
 * Dedicated, distraction-free note editor.
 *
 * Owns its own draft state and an 800ms debounced auto-save. `← Kembali`
 * flushes any pending edit before navigating back, so leaving the canvas can
 * never silently drop the last keystrokes.
 */
export function NoteEditor({
  note,
  onBack,
  onDeleted,
}: {
  note: DailyNote;
  onBack: () => void;
  onDeleted: () => void;
}) {
  const [title, setTitle] = React.useState(note.title);
  const [content, setContent] = React.useState(note.content);
  const [tag, setTag] = React.useState<NoteTag>(note.tag);
  const [pinned, setPinned] = React.useState(note.is_pinned);
  const [sync, setSync] = React.useState<SyncState>("synced");
  const [message, setMessage] = React.useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = React.useState(note.updated_at);
  const [pinPending, setPinPending] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = React.useRef(false);
  // Mirrors the latest draft so the unmount flush and `← Kembali` always read
  // current values rather than a stale closure.
  const draftRef = React.useRef({ title, content, tag });

  draftRef.current = { title, content, tag };

  const persist = React.useCallback(
    async (next: { title: string; content: string; tag: NoteTag }) => {
      setSync("saving");
      setMessage(null);

      const formData = new FormData();
      formData.set("id", note.id);
      formData.set("title", next.title);
      formData.set("content", next.content);
      formData.set("tag", next.tag);
      formData.set("note_date", note.note_date);

      const result = await updateNoteAction(formData);

      if (result.ok) {
        setUpdatedAt(result.data.updatedAt);
        setSync("synced");
      } else {
        setSync("error");
        setMessage(result.error);
      }
      return result.ok;
    },
    [note.id, note.note_date],
  );

  // ── Debounced auto-save ──
  React.useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }

    const unchanged =
      title === note.title && content === note.content && tag === note.tag;
    if (unchanged) return;

    setSync("dirty");
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void persist({ title, content, tag });
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [title, content, tag, note, persist]);

  /** Flush pending edits, then return to the list. */
  async function handleBack() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const draft = draftRef.current;
    const dirty =
      draft.title !== note.title ||
      draft.content !== note.content ||
      draft.tag !== note.tag;

    if (dirty) await persist(draft);
    onBack();
  }

  async function handlePin() {
    setPinPending(true);
    const next = !pinned;
    const result = await toggleNotePinAction(note.id, next);
    setPinPending(false);
    if (result.ok) setPinned(next);
    else setMessage(result.error);
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 4000);
      return;
    }
    setDeleting(true);
    const result = await deleteNoteAction(note.id);
    setDeleting(false);
    if (result.ok) onDeleted();
    else {
      setDeleting(false);
      setMessage(result.error);
    }
  }

  const charCount = content.length;
  const wordCount =
    content.trim().length === 0 ? 0 : content.trim().split(/\s+/).length;

  return (
    <Reveal className="flex min-h-[calc(100dvh-3.5rem)] flex-col">
      {/* ── Action bar ── */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2.5 sm:px-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleBack()}
          disabled={deleting}
        >
          <ArrowLeft className="size-3.5" />
          Kembali
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={tag}
            onChange={(event) => setTag(event.target.value as NoteTag)}
            aria-label="Tag catatan"
            className="h-8 appearance-none border border-border bg-background px-2 font-mono text-[10px] uppercase tracking-[0.07em] text-foreground transition-colors hover:bg-surface focus:border-accent focus:outline-none"
          >
            {NOTE_TAGS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => void handlePin()}
            disabled={pinPending}
            aria-pressed={pinned}
            title={pinned ? "Lepas pin" : "Pin catatan"}
            className={cn(
              "flex h-8 w-8 items-center justify-center border transition-colors",
              pinned
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border text-muted-foreground hover:bg-surface hover:text-foreground",
            )}
          >
            {pinPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : pinned ? (
              <Pin className="size-3.5" />
            ) : (
              <PinOff className="size-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={deleting}
            title={confirmDelete ? "Klik lagi untuk konfirmasi" : "Hapus catatan"}
            className={cn(
              "flex h-8 items-center justify-center gap-1.5 border px-2 transition-colors",
              confirmDelete
                ? "border-danger bg-danger text-white"
                : "border-danger text-danger hover:bg-danger hover:text-white",
            )}
          >
            {deleting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <>
                <Trash2 className="size-3.5" />
                <span className="font-mono text-[10px] uppercase tracking-[0.08em]">
                  {confirmDelete ? "Yakin?" : "Hapus"}
                </span>
              </>
            )}
          </button>

          <span className="hidden font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground sm:inline">
            {SYNC_LABEL[sync]}
          </span>

          {/* The only accent-filled control in this rail. */}
          <MotionButton
            type="button"
            variant="accent"
            size="sm"
            disabled={sync === "saving"}
            onClick={() => void persist({ title, content, tag })}
          >
            {sync === "saving" ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Menyimpan
              </>
            ) : (
              <>
                <Check className="size-3.5" />
                Simpan
              </>
            )}
          </MotionButton>
        </div>
      </div>

      {message !== null && (
        <p
          role="alert"
          className="shrink-0 border-b border-danger bg-surface px-4 py-2 font-mono text-[11px] text-danger"
        >
          {message}
        </p>
      )}

      {/* ── Writing canvas ── */}
      <div className="flex min-h-0 flex-1 flex-col px-4 py-5 sm:px-6">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Judul catatan..."
          aria-label="Judul catatan"
          className="w-full border-0 bg-transparent px-0 text-xl font-bold text-foreground placeholder:text-muted-foreground/50 focus:outline-none sm:text-2xl"
        />

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border pb-3 font-mono text-xs text-muted-foreground tabular">
          <span>
            {noteDateLabel(note.note_date)} · {timeWIBLabel(updatedAt)} WIB
          </span>
          <span aria-hidden className="hidden h-3 w-px bg-border sm:block" />
          <span>
            {charCount} karakter · {wordCount} kata
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground/70 sm:hidden">
            {SYNC_LABEL[sync]}
          </span>
        </div>

        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Tulis apa pun di sini — refleksi harian, checklist, ide freelance, target, atau pengingat..."
          aria-label="Isi catatan"
          className="mt-4 min-h-[60vh] w-full flex-1 resize-none border-0 bg-transparent px-0 text-base leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
        />
      </div>
    </Reveal>
  );
}

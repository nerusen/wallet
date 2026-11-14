"use client";

import { Pin } from "lucide-react";

import { cn } from "@/lib/utils";
import type { DailyNote } from "@/lib/types/database";

const BULAN_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
] as const;

/** `2026-11-14` → `14 Nov 2026`. */
export function noteDateLabel(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map((n) => Number.parseInt(n, 10));
  return `${d ?? ""} ${BULAN_SHORT[(m ?? 1) - 1] ?? ""} ${y ?? ""}`;
}

/** Max characters shown in a preview snippet before truncating. */
const SNIPPET_LIMIT = 110;

/**
 * Collapse a note body into a single-line snippet.
 *
 * Newlines become spaces so a multi-line note cannot blow out the card height,
 * and the ellipsis is appended only when text was actually cut.
 */
export function snippetOf(content: string): { text: string; empty: boolean } {
  const flat = content.replace(/\s+/g, " ").trim();
  if (flat.length === 0) {
    return { text: "Tidak ada teks tambahan...", empty: true };
  }
  if (flat.length <= SNIPPET_LIMIT) return { text: flat, empty: false };
  return { text: `${flat.slice(0, SNIPPET_LIMIT).trimEnd()}...`, empty: false };
}

/**
 * Compact preview card.
 *
 * Read-only by design: the list view renders no `<textarea>` or form input, so
 * the whole row is a single click target that opens the editor canvas.
 */
export function NotePreviewCard({
  note,
  onOpen,
}: {
  note: DailyNote;
  onOpen: () => void;
}) {
  const snippet = snippetOf(note.content);
  const title = note.title.trim().length > 0 ? note.title : "Catatan Tanpa Judul";

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "block w-full px-4 py-3.5 text-left transition-colors",
        "hover:bg-surface focus-visible:bg-surface",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 flex-1 truncate text-base font-bold text-foreground">
          {title}
        </h3>
        {note.is_pinned && (
          <Pin aria-label="Dipin" className="mt-0.5 size-3.5 shrink-0 text-accent" />
        )}
      </div>

      <p
        className={cn(
          "mt-1.5 line-clamp-2 text-sm leading-relaxed",
          snippet.empty ? "text-muted-foreground/60 italic" : "text-muted-foreground",
        )}
      >
        {snippet.text}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
        <span className="font-mono text-xs text-muted-foreground tabular">
          {noteDateLabel(note.note_date)}
        </span>
        <span className="border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
          {note.tag}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground/60 tabular">
          {note.content.trim().length === 0
            ? "0 kata"
            : `${note.content.trim().split(/\s+/).length} kata`}
        </span>
      </div>
    </button>
  );
}

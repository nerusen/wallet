"use client";

import { Check, ChevronDown, Shuffle } from "lucide-react";
import * as React from "react";

import { GEMINI_MODELS, modelLabel, type GeminiModelId } from "@/lib/assistant/models";
import { cn } from "@/lib/utils";

/**
 * Brutalist model selector.
 *
 * 1px borders, sharp corners, mono uppercase labels, and a #51CD85 dot marking
 * the active row. The caption states that auto-fallback stays active even when
 * a model is pinned manually.
 */
export function ModelSelector({
  value,
  onChange,
  disabled = false,
}: {
  value: GeminiModelId;
  onChange: (next: GeminiModelId) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;

    const onDown = (event: MouseEvent) => {
      if (rootRef.current !== null && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        title="Pilih model Gemini"
        className={cn(
          "flex items-center gap-2 border border-border bg-background px-2 py-1",
          "font-mono text-[10px] uppercase tracking-[0.08em] text-foreground",
          "transition-colors hover:bg-surface",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        <span aria-hidden className="h-1.5 w-1.5 shrink-0 bg-accent" />
        <span className="max-w-[9.5rem] truncate sm:max-w-none">
          {modelLabel(value)}
        </span>
        <ChevronDown
          className={cn(
            "size-3 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-30 mt-1 w-[17rem] border border-border-strong bg-background"
        >
          <p className="border-b border-border px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.09em] text-muted-foreground">
            Model Gemini
          </p>

          {GEMINI_MODELS.map((model) => {
            const active = model.id === value;
            return (
              <button
                key={model.id}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  onChange(model.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-start gap-2.5 border-b border-border px-2.5 py-2 text-left transition-colors",
                  active ? "bg-surface" : "hover:bg-surface",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-1 h-1.5 w-1.5 shrink-0",
                    active ? "bg-accent" : "bg-border-strong",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-[10px] uppercase tracking-[0.07em] text-foreground">
                    {model.label}
                  </span>
                  <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.06em] text-muted-foreground">
                    {model.tag}
                  </span>
                </span>
                {active && <Check className="mt-0.5 size-3 shrink-0 text-accent" />}
              </button>
            );
          })}

          {/* Auto-fallback caption */}
          <p className="flex items-start gap-2 px-2.5 py-2 text-[10px] leading-relaxed text-muted-foreground">
            <Shuffle className="mt-0.5 size-3 shrink-0 text-accent" />
            <span>
              Auto-Fallback tetap aktif. Jika model pilihan sibuk (503/429),
              sistem otomatis mencoba model cadangan.
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

"use client";

import {
  AlertTriangle,
  Check,
  Copy,
  FileText,
  ImageIcon,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  X,
} from "lucide-react";
import * as React from "react";

import { resetChatAction } from "@/app/actions/assistant";
import { ModelSelector } from "@/components/assistant/model-selector";
import { Button, MotionButton } from "@/components/ui/button";
import { Reveal } from "@/components/ui/motion";
import { Badge } from "@/components/ui/panel";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { ASSISTANT_ERROR_COPY } from "@/lib/assistant/errors";
import {
  DEFAULT_GEMINI_MODEL,
  MODEL_STORAGE_KEY,
  isGeminiModelId,
  modelLabel,
  type GeminiModelId,
} from "@/lib/assistant/models";
import { cn, tempId } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types/database";

const WIB = "Asia/Jakarta";

/** `HH:mm` in WIB. */
function timeLabel(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: WIB,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/** `YYYY-MM-DD` in WIB — the grouping key for date separators. */
function dateKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: WIB,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

const BULAN_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
] as const;

/** `Hari ini` / `Kemarin` / `12 Nov 2026`. */
function separatorLabel(key: string, todayKey: string): string {
  if (key === todayKey) return "Hari ini";

  const [ty, tm, td] = todayKey.split("-").map((n) => Number.parseInt(n, 10));
  const yesterday = new Date(Date.UTC(ty ?? 1970, (tm ?? 1) - 1, (td ?? 1) - 1, 12));
  const yKey = `${yesterday.getUTCFullYear()}-${String(yesterday.getUTCMonth() + 1).padStart(2, "0")}-${String(yesterday.getUTCDate()).padStart(2, "0")}`;
  if (key === yKey) return "Kemarin";

  const [y, m, d] = key.split("-").map((n) => Number.parseInt(n, 10));
  return `${d ?? ""} ${BULAN_SHORT[(m ?? 1) - 1] ?? ""} ${y ?? ""}`;
}

interface Group {
  key: string;
  label: string;
  messages: ChatMessage[];
}

/** Local-only marker for the in-flight assistant turn. */
interface PendingTurn {
  text: string;
}

/** Structured, already-humanised error shown above the composer. */
interface ChatAlert {
  message: string;
  /** The user text to resend when "Coba Lagi" is pressed. */
  retryText: string;
  /**
   * True only when the user's row is already persisted, so a retry re-runs
   * generation without inserting a duplicate message.
   */
  canRetry: boolean;
}

export function ChatRoom({
  initialMessages,
  hasApiKey,
  todayKey,
  envModel,
}: {
  initialMessages: readonly ChatMessage[];
  hasApiKey: boolean;
  todayKey: string;
  /** Server-side GEMINI_MODEL, used only as the pre-hydration label. */
  envModel: string;
}) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([...initialMessages]);
  const [draft, setDraft] = React.useState("");
  const [pending, setPending] = React.useState<PendingTurn | null>(null);
  const [alert, setAlert] = React.useState<ChatAlert | null>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [resetting, setResetting] = React.useState(false);
  const [selectedModel, setSelectedModel] =
    React.useState<GeminiModelId>(DEFAULT_GEMINI_MODEL);
  const [hydrated, setHydrated] = React.useState(false);
  /** usedModel per assistant message id, for the FALLBACK badge. */
  const [fallbackBy, setFallbackBy] = React.useState<Record<string, string>>({});

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Server data is authoritative; Realtime refresh re-renders the page and
  // the effect below reconciles the list.
  useRealtimeRefresh(["chat_messages"], { enabled: hasApiKey });

  React.useEffect(() => {
    setMessages([...initialMessages]);
  }, [initialMessages]);

  // Restore the persisted model after mount so SSR stays deterministic.
  React.useEffect(() => {
    const stored = window.localStorage.getItem(MODEL_STORAGE_KEY);
    if (isGeminiModelId(stored)) setSelectedModel(stored);
    setHydrated(true);
  }, []);

  const pickModel = React.useCallback((next: GeminiModelId) => {
    setSelectedModel(next);
    window.localStorage.setItem(MODEL_STORAGE_KEY, next);
  }, []);

  // Keep the viewport pinned to the newest turn.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el !== null) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  // Dismiss the dropup on outside click / Escape.
  React.useEffect(() => {
    if (!menuOpen) return;

    const onDown = (event: MouseEvent) => {
      if (menuRef.current !== null && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  /**
   * Send a turn to the assistant.
   *
   * `mode: "retry"` re-generates the LAST unanswered user message. The row is
   * already persisted, so `reuseLastUserMessage` tells the server to skip the
   * insert — no duplicate ever lands in `chat_messages`.
   */
  async function send(
    text: string,
    mode: "new" | "retry" = "new",
  ): Promise<void> {
    const body = text.trim();
    if (body.length === 0 || pending !== null || !hasApiKey) return;

    const isRetry = mode === "retry";

    // A new turn gets an optimistic bubble; a retry already has its bubble.
    const optimistic: ChatMessage | null = isRetry
      ? null
      : {
          id: tempId("usr"),
          role: "user",
          content: body,
          created_at: new Date().toISOString(),
        };

    if (optimistic !== null) {
      setMessages((prev) => [...prev, optimistic]);
      setDraft("");
      if (textareaRef.current !== null) textareaRef.current.style.height = "auto";
    }

    setPending({ text: body });
    setAlert(null);

    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: body,
          selectedModel,
          reuseLastUserMessage: isRetry,
        }),
      });

      const payload: unknown = await response.json();
      const data = payload as {
        ok?: boolean;
        error?: string;
        code?: string;
        userMessage?: ChatMessage | null;
        assistantMessage?: ChatMessage;
        usedModel?: string;
        isFallback?: boolean;
      };

      if (data.ok === true && data.assistantMessage) {
        const assistant = data.assistantMessage;

        setMessages((prev) => {
          const base =
            optimistic === null
              ? prev
              : prev.filter((m) => m.id !== optimistic.id);
          // On retry the user row is already in the list.
          const withUser =
            data.userMessage != null ? [...base, data.userMessage] : base;
          return [...withUser, assistant];
        });

        if (data.isFallback === true && typeof data.usedModel === "string") {
          const used = data.usedModel;
          setFallbackBy((prev) => ({ ...prev, [assistant.id]: used }));
        }
      } else {
        /*
          The route persists the user's row BEFORE calling the model, so a
          model failure still leaves that row stored and returns it as
          `userMessage`. In that case keep the bubble on screen (swapping the
          optimistic id for the persisted one) and offer "Coba Lagi", which
          regenerates without inserting a second row.

          Only when nothing was persisted (validation rejected, auth failed, or
          a retry attempt) is the bubble rolled back and the text returned to
          the composer.
        */
        const persisted = data.userMessage ?? null;

        if (persisted !== null && optimistic !== null) {
          setMessages((prev) =>
            prev.map((m) => (m.id === optimistic.id ? persisted : m)),
          );
        } else if (optimistic !== null) {
          setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
          setDraft(body);
        }

        setAlert({
          message: data.error ?? ASSISTANT_ERROR_COPY.unknown,
          retryText: body,
          // Retryable whenever the user's row is already in the transcript.
          canRetry: isRetry || persisted !== null,
        });
      }
    } catch {
      // Network failure: the request may or may not have reached the server, so
      // the optimistic bubble is rolled back and the text is restored. Retry
      // then happens by resending from the composer.
      if (optimistic !== null) {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setDraft(body);
      }
      setAlert({
        message: ASSISTANT_ERROR_COPY.network,
        retryText: body,
        canRetry: isRetry,
      });
    } finally {
      setPending(null);
    }
  }

  async function onReset() {
    setResetting(true);
    setAlert(null);
    const result = await resetChatAction();
    setResetting(false);
    if (result.ok) {
      setMessages([]);
      setFallbackBy({});
    } else {
      setAlert({ message: result.error, retryText: "", canRetry: false });
    }
  }

  const groups = React.useMemo<Group[]>(() => {
    const map = new Map<string, ChatMessage[]>();
    for (const m of messages) {
      const key = dateKey(m.created_at);
      const list = map.get(key);
      if (list === undefined) map.set(key, [m]);
      else list.push(m);
    }
    return [...map.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([key, list]) => ({
        key,
        label: separatorLabel(key, todayKey),
        messages: list,
      }));
  }, [messages, todayKey]);

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col">
      {/* ── Header rail ── */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className="status-dot"
            data-tone={hasApiKey ? "success" : "danger"}
          />

          {hasApiKey ? (
            // Pre-hydration the env model label is shown so SSR and the first
            // client paint agree; the stored selection takes over on mount.
            hydrated ? (
              <ModelSelector
                value={selectedModel}
                onChange={pickModel}
                disabled={pending !== null}
              />
            ) : (
              <span className="flex items-center gap-2 border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                <span aria-hidden className="h-1.5 w-1.5 bg-accent" />
                {modelLabel(envModel)}
              </span>
            )
          ) : (
            <span className="truncate font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              API key belum diset
            </span>
          )}

          {messages.length > 0 && (
            <Badge tone="neutral" className="hidden sm:inline-flex">
              {messages.length} pesan
            </Badge>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="xs"
          disabled={resetting || messages.length === 0}
          onClick={onReset}
          title="Hapus seluruh riwayat obrolan"
        >
          {resetting ? (
            <>
              <Loader2 className="size-3 animate-spin" />
              Menghapus
            </>
          ) : (
            <>
              <RotateCcw className="size-3" />
              Reset Chat
            </>
          )}
        </Button>
      </div>

      {/* ── Transcript viewport ── */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {!hasApiKey ? (
          <NoApiKeyState />
        ) : messages.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-6 px-4 py-6 sm:px-6">
            {groups.map((group) => (
              <section key={group.key} className="flex flex-col gap-4">
                <DateSeparator label={group.label} />
                {group.messages.map((message) =>
                  message.role === "user" ? (
                    <UserBubble key={message.id} message={message} />
                  ) : (
                    <AssistantMessage
                      key={message.id}
                      message={message}
                      fallbackModel={fallbackBy[message.id]}
                    />
                  ),
                )}
              </section>
            ))}

            {pending !== null && <ThinkingIndicator />}
          </div>
        )}
      </div>

      {/* ── Error alert: 1px #EF4444 frame, above the composer ── */}
      {alert !== null && (
        <div
          role="alert"
          className="mx-3 mb-0 mt-3 shrink-0 border border-danger bg-surface sm:mx-4"
        >
          <div className="flex flex-col gap-2.5 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-2.5">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-danger" />
              <p className="min-w-0 text-[12px] leading-relaxed text-foreground">
                {alert.message}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {alert.canRetry && (
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={pending !== null}
                  onClick={() => void send(alert.retryText, "retry")}
                  title="Hasilkan ulang jawaban untuk pesan terakhir"
                >
                  <RefreshCw className="size-3" />
                  Coba Lagi
                </Button>
              )}
              <button
                type="button"
                onClick={() => setAlert(null)}
                aria-label="Tutup peringatan"
                title="Tutup"
                className="flex h-7 w-7 items-center justify-center border border-border text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Composer ── */}
      <div className="shrink-0 border-t border-border bg-background">
        <div className="flex items-end gap-2 px-3 py-3 sm:px-4">
          {/* `+` dropup */}
          <div ref={menuRef} className="relative shrink-0">
            {menuOpen && (
              <div
                role="menu"
                className="absolute bottom-full left-0 z-20 mb-2 w-44 border border-border-strong bg-background"
              >
                <p className="border-b border-border px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                  Lampiran
                </p>
                <button
                  type="button"
                  role="menuitem"
                  disabled
                  aria-disabled="true"
                  className="flex w-full cursor-not-allowed items-center gap-2 border-b border-border px-2.5 py-2 text-left opacity-50"
                >
                  <ImageIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 font-mono text-[11px] text-foreground">Image</span>
                  <span className="border border-border px-1 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                    Soon
                  </span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled
                  aria-disabled="true"
                  className="flex w-full cursor-not-allowed items-center gap-2 px-2.5 py-2 text-left opacity-50"
                >
                  <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 font-mono text-[11px] text-foreground">File</span>
                  <span className="border border-border px-1 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                    Soon
                  </span>
                </button>
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Buka menu lampiran"
              disabled={!hasApiKey}
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              <Plus
                className={cn(
                  "size-3.5 transition-transform duration-200",
                  menuOpen && "rotate-45",
                )}
              />
            </Button>
          </div>

          <textarea
            ref={textareaRef}
            value={draft}
            disabled={!hasApiKey || pending !== null}
            onChange={(event) => {
              setDraft(event.target.value);
              autoGrow(event.target);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send(draft);
              }
            }}
            rows={1}
            placeholder={
              hasApiKey
                ? "Tanya kondisi keuanganmu…  (Enter kirim · Shift+Enter baris baru)"
                : "Input dinonaktifkan — GEMINI_API_KEY belum diset."
            }
            className={cn(
              "min-h-9 flex-1 resize-none border border-border bg-background px-3 py-2",
              "font-sans text-[13px] leading-relaxed text-foreground",
              "placeholder:text-[12px] placeholder:text-muted-foreground",
              "transition-colors hover:border-border-strong focus:border-accent focus:outline-none",
              "disabled:cursor-not-allowed disabled:bg-surface disabled:opacity-60",
            )}
          />

          <MotionButton
            type="button"
            variant="accent"
            size="icon"
            disabled={!hasApiKey || pending !== null || draft.trim().length === 0}
            onClick={() => void send(draft)}
            aria-label="Kirim pesan"
            title="Kirim"
            className="shrink-0"
          >
            {pending !== null ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
          </MotionButton>
        </div>
      </div>
    </div>
  );
}

/* ── Separator ───────────────────────────────────────────────────────────── */

function DateSeparator({ label }: { label: string }) {
  return (
    <div className="relative flex items-center justify-center">
      <span aria-hidden className="absolute inset-x-0 top-1/2 border-t border-dashed border-border" />
      <span className="relative border border-border bg-background px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

/* ── Bubbles ─────────────────────────────────────────────────────────────── */

function UserBubble({ message }: { message: ChatMessage }) {
  return (
    <Reveal className="ml-auto max-w-[82%] sm:max-w-[70%]">
      <div className="border border-border bg-card px-3.5 py-2.5">
        <p className="whitespace-pre-wrap text-left text-[13px] leading-relaxed text-foreground">
          {message.content}
        </p>
      </div>
      <p className="mt-1 text-right font-mono text-[11px] text-muted-foreground tabular">
        {timeLabel(message.created_at)}
      </p>
    </Reveal>
  );
}

/** No bubble: the AI reply sits directly on the canvas, left-aligned. */
function AssistantMessage({
  message,
  fallbackModel,
}: {
  message: ChatMessage;
  /** Set only when a fallback model produced this answer. */
  fallbackModel?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Reveal className="mr-auto max-w-[90%] sm:max-w-[78%]">
      <div className="whitespace-pre-wrap text-left text-[13px] leading-relaxed text-foreground">
        {message.content}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] text-muted-foreground tabular">
          {timeLabel(message.created_at)}
        </span>

        {fallbackModel !== undefined && (
          <span
            className="border border-warning px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-warning"
            title={`Jawaban ini dihasilkan oleh model cadangan ${modelLabel(fallbackModel)}`}
          >
            Fallback · {modelLabel(fallbackModel)}
          </span>
        )}
        <button
          type="button"
          onClick={() => void copy()}
          className="border border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
          title="Salin jawaban"
        >
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em]">
            {copied ? (
              <>
                <Check className="size-2.5" />
                Copied
              </>
            ) : (
              <>
                <Copy className="size-2.5" />
                Copy
              </>
            )}
          </span>
        </button>
      </div>
    </Reveal>
  );
}

function ThinkingIndicator() {
  return (
    <div className="mr-auto flex max-w-[78%] items-center gap-2.5">
      <Loader2 className="size-3.5 animate-spin text-accent" />
      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
        Menganalisis data keuangan…
      </span>
    </div>
  );
}

/* ── Viewport states ─────────────────────────────────────────────────────── */

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center px-6 py-16">
      <div className="border border-border bg-background px-8 py-10 text-center">
        <p className="font-mono text-[22px] font-bold uppercase tracking-[0.18em] text-foreground">
          Empty
        </p>
        <p className="mx-auto mt-4 max-w-xs text-[12px] leading-relaxed text-muted-foreground">
          Belum ada riwayat obrolan. Mulai tanya kondisi keuanganmu di bawah.
        </p>
      </div>
    </div>
  );
}

function NoApiKeyState() {
  return (
    <div className="flex h-full items-center justify-center px-6 py-16">
      <div className="max-w-md border border-danger bg-background px-8 py-10 text-center">
        <p className="font-mono text-[18px] font-bold uppercase tracking-[0.14em] text-danger sm:text-[20px]">
          No Apikey Available
        </p>
        <p className="mt-4 text-[12px] leading-relaxed text-muted-foreground">
          Asisten AI tidak aktif karena{" "}
          <code className="border border-border bg-surface px-1 font-mono text-[11px] text-foreground">
            GEMINI_API_KEY
          </code>{" "}
          belum diisi.
        </p>
        <ol className="mt-5 space-y-2 text-left">
          {[
            "Buat API key di aistudio.google.com/apikey",
            "Tambahkan GEMINI_API_KEY=... ke .env.local (lokal) atau Vercel → Settings → Environment Variables (produksi)",
            "Jalankan ulang server / redeploy",
          ].map((step, index) => (
            <li key={step} className="flex gap-2.5 border border-border px-2.5 py-2">
              <span className="font-mono text-[10px] text-accent tabular">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="text-[11px] leading-relaxed text-muted-foreground">
                {step}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

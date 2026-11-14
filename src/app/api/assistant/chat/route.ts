import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/guard";
import {
  fetchRecentChatMessages,
  insertChatMessage,
} from "@/lib/assistant/chat-store";
import { ASSISTANT_ERROR_COPY } from "@/lib/assistant/errors";
import {
  HISTORY_TURNS,
  MAX_USER_MESSAGE_LENGTH,
  getGeminiApiKey,
  getGeminiModel,
  loadSystemInstruction,
} from "@/lib/assistant/gemini";
import {
  generateWithFallback,
  type GeminiContent,
} from "@/lib/assistant/generate";
import { buildFallbackQueue, isGeminiModelId } from "@/lib/assistant/models";
import { buildFinancialSnapshot } from "@/lib/assistant/snapshot";
import type { ChatMessage } from "@/lib/types/database";

/**
 * POST /api/assistant/chat
 *
 * Reactive only: one explicit user message in, one assistant reply out. No
 * background or scheduled invocation exists anywhere in the codebase.
 *
 * Flow:
 *   1. Require a valid session (single-user auth).
 *   2. Validate input and resolve the model fallback queue.
 *   3. Persist the user's message — unless `reuseLastUserMessage` is set, which
 *      the "Coba Lagi" retry uses so a retry never duplicates the row.
 *   4. Build the read-only financial snapshot and replay recent turns.
 *   5. Call Gemini through the retry + fallback chain.
 *   6. Persist the reply and return `{ usedModel, isFallback }`.
 *
 * Runs on the Node runtime because it reads `intruksi.md` from disk.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatRequestBody {
  message?: unknown;
  selectedModel?: unknown;
  /**
   * Retry mode. The user's message is already stored, so re-send it to the
   * model without inserting a duplicate `chat_messages` row.
   */
  reuseLastUserMessage?: unknown;
}

export async function POST(request: Request) {
  // ── 1. Auth ──
  const session = await getSession();
  if (session === null) {
    return NextResponse.json(
      { ok: false, error: "Sesi tidak valid. Silakan masuk kembali." },
      { status: 401 },
    );
  }

  // ── 2. API key ──
  const apiKey = getGeminiApiKey();
  if (apiKey === null) {
    return NextResponse.json(
      { ok: false, error: ASSISTANT_ERROR_COPY.no_api_key, code: "NO_API_KEY" },
      { status: 503 },
    );
  }

  // ── 3. Parse + validate ──
  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Body permintaan tidak valid." },
      { status: 400 },
    );
  }

  const raw = typeof body.message === "string" ? body.message.trim() : "";
  if (raw.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Pesan tidak boleh kosong." },
      { status: 400 },
    );
  }
  if (raw.length > MAX_USER_MESSAGE_LENGTH) {
    return NextResponse.json(
      {
        ok: false,
        error: `Pesan terlalu panjang (maks ${MAX_USER_MESSAGE_LENGTH} karakter).`,
      },
      { status: 400 },
    );
  }

  /*
    Model resolution. An unrecognised client value is ignored rather than
    trusted — the request body is user input, and forwarding an arbitrary
    string to the provider would turn a typo into a 404 from Google.
  */
  const selectedModel = isGeminiModelId(body.selectedModel)
    ? body.selectedModel
    : getGeminiModel();
  const queue = buildFallbackQueue(selectedModel);
  const reuse = body.reuseLastUserMessage === true;

  try {
    // ── 4. History (read before inserting, so the new turn isn't echoed) ──
    const history: ChatMessage[] = await fetchRecentChatMessages(HISTORY_TURNS);

    /*
      On retry the user's row already exists; `history` therefore already ends
      with it. Drop that trailing turn so the message is not sent twice — once
      as history and once as the live prompt.
    */
    const replayHistory =
      reuse &&
      history.length > 0 &&
      history[history.length - 1]?.role === "user" &&
      history[history.length - 1]?.content === raw
        ? history.slice(0, -1)
        : history;

    // ── 5. Persist the user's message (skipped on retry) ──
    const userMessage = reuse ? null : await insertChatMessage("user", raw);

    // ── 6. Read-only financial context ──
    const snapshot = await buildFinancialSnapshot(replayHistory);
    const { instruction } = await loadSystemInstruction();

    const contextBlock =
      snapshot.error === null
        ? snapshot.text
        : `PERINGATAN: snapshot keuangan gagal dimuat (${snapshot.error}). Katakan ke pengguna bahwa data finansial sedang tidak dapat dibaca, dan jangan mengarang angka.`;

    const contents: GeminiContent[] = [
      ...replayHistory.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      {
        role: "user",
        parts: [{ text: `${contextBlock}\n\n---\n\nPERTANYAAN PENGGUNA:\n${raw}` }],
      },
    ];

    // ── 7. Retry + fallback chain ──
    const result = await generateWithFallback({
      apiKey,
      queue,
      contents,
      systemInstruction: instruction,
    });

    if (!result.ok) {
      // Clean Indonesian copy only — never the provider payload.
      return NextResponse.json(
        {
          ok: false,
          error: result.error.message,
          code: result.error.kind,
          retryable: result.error.retryable,
          userMessage,
          attempts: result.attempts,
        },
        { status: result.error.status },
      );
    }

    // ── 8. Persist and return ──
    const assistantMessage = await insertChatMessage("assistant", result.text);

    return NextResponse.json({
      ok: true,
      userMessage,
      assistantMessage,
      usedModel: result.usedModel,
      isFallback: result.isFallback,
      meta: {
        requestedModel: selectedModel,
        queue,
        attempts: result.attempts,
        snapshotOk: snapshot.error === null,
      },
    });
  } catch (error) {
    /*
      Reached only for infrastructure failures outside the model call (e.g.
      Supabase unavailable). The model path maps its own errors inside
      `generateWithFallback`.
    */
    const detail =
      error instanceof Error && error.message.length > 0 ? error.message : null;

    return NextResponse.json(
      {
        ok: false,
        error:
          detail !== null && detail.toLowerCase().includes("supabase")
            ? "Gagal menyimpan riwayat obrolan. Periksa koneksi Supabase."
            : ASSISTANT_ERROR_COPY.network,
        code: "network",
        retryable: true,
      },
      { status: 502 },
    );
  }
}

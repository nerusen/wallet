import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/guard";
import {
  fetchRecentChatMessages,
  insertChatMessage,
} from "@/lib/assistant/chat-store";
import {
  HISTORY_TURNS,
  MAX_USER_MESSAGE_LENGTH,
  getGeminiApiKey,
  getGeminiModel,
  loadSystemInstruction,
} from "@/lib/assistant/gemini";
import { buildFinancialSnapshot } from "@/lib/assistant/snapshot";
import { errorMessage } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types/database";

/**
 * POST /api/assistant/chat
 *
 * Reactive only: one explicit user message in, one assistant reply out. There
 * is no background/scheduled invocation anywhere in the codebase.
 *
 * Flow:
 *   1. Require a valid session (single-user auth).
 *   2. Validate the message, then persist it to `chat_messages`.
 *   3. Build a read-only financial snapshot + replay recent turns.
 *   4. Call Gemini with `intruksi.md` as the systemInstruction.
 *   5. Persist and return the reply.
 *
 * Runs on the Node runtime because it reads `intruksi.md` from disk.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatRequestBody {
  message?: unknown;
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

  // ── 2. API key present? ──
  const apiKey = getGeminiApiKey();
  if (apiKey === null) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "NO APIKEY AVAILABLE — setel GEMINI_API_KEY di .env.local atau Vercel Environment Variables.",
        code: "NO_API_KEY",
      },
      { status: 503 },
    );
  }

  // ── 3. Validate input ──
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

  try {
    // ── 4. Replay history BEFORE saving, so the new message is not duplicated ──
    const history: ChatMessage[] = await fetchRecentChatMessages(HISTORY_TURNS);

    // ── 5. Persist the user's message ──
    const userMessage = await insertChatMessage("user", raw);

    // ── 6. Read-only financial context ──
    const snapshot = await buildFinancialSnapshot(history);

    // ── 7. Call Gemini ──
    const { instruction } = await loadSystemInstruction();
    const model = getGeminiModel();

    // Imported lazily so a missing/incompatible SDK cannot break unrelated
    // routes at module-eval time.
    const { GoogleGenAI, ThinkingLevel } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    const contextBlock =
      snapshot.error === null
        ? snapshot.text
        : `PERINGATAN: snapshot keuangan gagal dimuat (${snapshot.error}). Katakan ke pengguna bahwa data finansial sedang tidak dapat dibaca, dan jangan mengarang angka.`;

    const contents = [
      ...history.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      {
        role: "user",
        parts: [
          {
            text: `${contextBlock}\n\n---\n\nPERTANYAAN PENGGUNA:\n${raw}`,
          },
        ],
      },
    ];

    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: instruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
        temperature: 0.4,
        maxOutputTokens: 1400,
      },
    });

    const reply = (response.text ?? "").trim();
    if (reply.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Model tidak mengembalikan jawaban. Coba kirim ulang pesanmu.",
          userMessage,
        },
        { status: 502 },
      );
    }

    // ── 8. Persist and return ──
    const assistantMessage = await insertChatMessage("assistant", reply);

    return NextResponse.json({
      ok: true,
      userMessage,
      assistantMessage,
      meta: { model, snapshotOk: snapshot.error === null },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: errorMessage(
          error,
          "Gagal menghubungi asisten. Periksa GEMINI_API_KEY dan koneksi jaringan.",
        ),
      },
      { status: 500 },
    );
  }
}

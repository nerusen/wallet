import "server-only";

import {
  describeGeminiError,
  isAuthError,
  isTransientError,
  type AssistantError,
} from "@/lib/assistant/errors";
import { modelSupportsThinking } from "@/lib/assistant/models";

/**
 * Retry + fallback executor for `generateContent`.
 *
 * For every model in the queue: up to MAX_TRIES_PER_MODEL attempts with a
 * short backoff, then escalate to the next model. A fatal auth error aborts
 * the whole chain immediately — retrying an invalid key cannot succeed and
 * would only multiply latency.
 */

export const MAX_TRIES_PER_MODEL = 2;
export const RETRY_BACKOFF_MS = 800;

export interface GeminiContent {
  role: string;
  parts: { text: string }[];
}

export interface GenerateOptions {
  apiKey: string;
  queue: readonly string[];
  contents: GeminiContent[];
  systemInstruction: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface AttemptLog {
  model: string;
  attempt: number;
  outcome: "ok" | "transient" | "fatal" | "empty";
  detail?: string;
}

export type GenerateResult =
  | {
      ok: true;
      text: string;
      usedModel: string;
      /** True when the answer came from anything other than queue[0]. */
      isFallback: boolean;
      attempts: AttemptLog[];
    }
  | {
      ok: false;
      error: AssistantError;
      attempts: AttemptLog[];
    };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateWithFallback(
  options: GenerateOptions,
): Promise<GenerateResult> {
  const {
    apiKey,
    queue,
    contents,
    systemInstruction,
    temperature = 0.4,
    maxOutputTokens = 1400,
  } = options;

  // Imported lazily so a missing/incompatible SDK cannot break module eval.
  const { GoogleGenAI, ThinkingLevel } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });

  const attempts: AttemptLog[] = [];
  const primary = queue[0];
  let lastError: unknown = null;

  for (const model of queue) {
    for (let attempt = 1; attempt <= MAX_TRIES_PER_MODEL; attempt += 1) {
      try {
        /*
          Config is assembled per model: `thinkingConfig` is only sent to a
          model that declares support for it. Omitting an optional field is
          always safe, whereas sending one a model rejects is a hard 400 that
          would otherwise look like a fallback bug.
        */
        const config: {
          systemInstruction: string;
          temperature: number;
          maxOutputTokens: number;
          thinkingConfig?: { thinkingLevel: typeof ThinkingLevel.MEDIUM };
        } = {
          systemInstruction,
          temperature,
          maxOutputTokens,
        };

        if (modelSupportsThinking(model)) {
          config.thinkingConfig = { thinkingLevel: ThinkingLevel.MEDIUM };
        }

        const response = await ai.models.generateContent({
          model,
          contents,
          config,
        });

        const text = (response.text ?? "").trim();

        if (text.length === 0) {
          // An empty body is treated like a transient failure so the chain can
          // try a different model rather than surfacing a blank reply.
          attempts.push({ model, attempt, outcome: "empty" });
          lastError = new Error(`Model ${model} mengembalikan jawaban kosong.`);

          if (attempt < MAX_TRIES_PER_MODEL) {
            await sleep(RETRY_BACKOFF_MS);
            continue;
          }
          break;
        }

        attempts.push({ model, attempt, outcome: "ok" });
        return {
          ok: true,
          text,
          usedModel: model,
          isFallback: model !== primary,
          attempts,
        };
      } catch (error) {
        lastError = error;

        // ── Fatal: stop the entire chain ──
        if (isAuthError(error)) {
          attempts.push({
            model,
            attempt,
            outcome: "fatal",
            detail: "auth",
          });
          return { ok: false, error: describeGeminiError(error), attempts };
        }

        const transient = isTransientError(error);
        attempts.push({
          model,
          attempt,
          outcome: transient ? "transient" : "fatal",
          detail: describeGeminiError(error).kind,
        });

        /*
          Non-transient, non-auth errors (e.g. a 400 from an unsupported
          parameter) are NOT retried on the same model — the same request would
          fail identically. The loop still escalates to the next model, which
          may accept the request.
        */
        if (transient && attempt < MAX_TRIES_PER_MODEL) {
          await sleep(RETRY_BACKOFF_MS);
          continue;
        }
        break;
      }
    }
    // Exhausted this model; continue to the next fallback.
  }

  return {
    ok: false,
    error: describeGeminiError(lastError),
    attempts,
  };
}

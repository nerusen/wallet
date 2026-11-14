/**
 * Gemini model catalog.
 *
 * Shared by the client (selector UI) and the server (fallback chain), so this
 * module must stay free of `server-only` and of any Node built-in.
 */

export const GEMINI_MODEL_IDS = [
  "gemini-3.8-flash",
  "gemini-flash-latest",
  "gemini-3.1-flash-lite",
] as const;

export type GeminiModelId = (typeof GEMINI_MODEL_IDS)[number];

export interface GeminiModelOption {
  id: GeminiModelId;
  /** Uppercase label shown in the selector. */
  label: string;
  /** Short mono tag rendered under the label. */
  tag: string;
  /**
   * Whether the model accepts `thinkingConfig`.
   *
   * Only the primary model is configured with MEDIUM thinking; the lighter
   * fallbacks omit the field entirely so a parameter difference can never
   * crash the fallback path.
   */
  supportsThinking: boolean;
}

export const GEMINI_MODELS: readonly GeminiModelOption[] = [
  {
    id: "gemini-3.8-flash",
    label: "GEMINI-3.8-FLASH",
    tag: "DEFAULT · MEDIUM THINKING",
    supportsThinking: true,
  },
  {
    id: "gemini-flash-latest",
    label: "GEMINI-FLASH-LATEST",
    tag: "FAST · STABLE",
    supportsThinking: false,
  },
  {
    id: "gemini-3.1-flash-lite",
    label: "GEMINI-3.1-FLASH-LITE",
    tag: "LITE · ANTI-BUSY",
    supportsThinking: false,
  },
] as const;

export const DEFAULT_GEMINI_MODEL: GeminiModelId = "gemini-3.8-flash";

/** Strict order the fallback chain walks after the user's selection. */
const FALLBACK_ORDER: readonly GeminiModelId[] = [
  "gemini-flash-latest",
  "gemini-3.1-flash-lite",
];

export function isGeminiModelId(value: unknown): value is GeminiModelId {
  return (
    typeof value === "string" &&
    (GEMINI_MODEL_IDS as readonly string[]).includes(value)
  );
}

export function findModel(id: string): GeminiModelOption | undefined {
  return GEMINI_MODELS.find((m) => m.id === id);
}

/** Uppercase display label for any id, including unknown env-supplied ones. */
export function modelLabel(id: string): string {
  return findModel(id)?.label ?? id.toUpperCase();
}

export function modelSupportsThinking(id: string): boolean {
  // Unknown models (e.g. a custom GEMINI_MODEL) are treated as NOT supporting
  // thinkingConfig — safer to omit an optional field than to send a rejected one.
  return findModel(id)?.supportsThinking ?? false;
}

/**
 * Build the ordered, de-duplicated attempt queue.
 *
 * `gemini-3.8-flash`      → [3.8-flash, flash-latest, 3.1-flash-lite]
 * `gemini-flash-latest`   → [flash-latest, 3.1-flash-lite]
 * `gemini-3.1-flash-lite` → [3.1-flash-lite, flash-latest]
 *
 * A model already tried as the primary is never repeated, so selecting a
 * fallback simply shortens the chain rather than retrying the same model.
 */
export function buildFallbackQueue(selected: string): string[] {
  const queue: string[] = [selected];

  for (const id of FALLBACK_ORDER) {
    if (!queue.includes(id)) queue.push(id);
  }

  return queue;
}

/** `localStorage` key for the persisted selection. */
export const MODEL_STORAGE_KEY = "pfos-assistant-model";

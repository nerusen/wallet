/**
 * Transient-vs-fatal classification and human-readable Indonesian messages.
 *
 * Shared by the route handler and the chat UI so both sides agree on the
 * wording. Raw provider JSON (`{"error":{"code":503,...}}`) must never reach
 * the interface — `describeGeminiError()` is the single translation boundary.
 */

export type AssistantErrorKind =
  | "busy" // 503 / UNAVAILABLE / overloaded
  | "rate_limit" // 429 / RESOURCE_EXHAUSTED
  | "auth" // 401 / 403 / invalid key
  | "no_api_key"
  | "empty_reply"
  | "network"
  | "unknown";

export interface AssistantError {
  kind: AssistantErrorKind;
  /** Clean Indonesian copy, safe to render verbatim. */
  message: string;
  /** HTTP status to return from the route. */
  status: number;
  /** Whether retrying the same request could plausibly succeed. */
  retryable: boolean;
}

export const ASSISTANT_ERROR_COPY: Record<AssistantErrorKind, string> = {
  busy:
    "Server AI sedang penuh sementara (503). Semua model utama & cadangan sedang sibuk, silakan coba lagi sebentar lagi.",
  rate_limit:
    "Batas permintaan API tercapai (429). Tunggu sekitar 1 menit lalu coba kirim ulang.",
  auth:
    "API Key Google AI Studio tidak valid. Periksa GEMINI_API_KEY di environment.",
  no_api_key:
    "GEMINI_API_KEY belum diset. Tambahkan di .env.local atau Vercel Environment Variables.",
  empty_reply:
    "Model tidak mengembalikan jawaban. Silakan coba kirim ulang pesanmu.",
  network:
    "Terjadi gangguan koneksi ke server AI. Silakan coba kirim ulang.",
  unknown:
    "Terjadi gangguan koneksi ke server AI. Silakan coba kirim ulang.",
};

/** HTTP statuses worth retrying / falling back on. */
const TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504]);

/** Substrings that indicate a transient capacity problem. */
const TRANSIENT_PATTERNS = [
  "unavailable",
  "high demand",
  "overloaded",
  "resource_exhausted",
  "resource exhausted",
  "try again later",
  "service is currently unavailable",
  "deadline exceeded",
  "econnreset",
  "etimedout",
  "socket hang up",
  "fetch failed",
];

const AUTH_PATTERNS = [
  "api key not valid",
  "api_key_invalid",
  "invalid api key",
  "permission_denied",
  "permission denied",
  "unauthenticated",
  "unauthorized",
];

/**
 * Best-effort HTTP status extraction.
 *
 * The SDK's `ApiError` carries `status`, but a bare `fetch` rejection or a
 * stringified provider payload does not — so a numeric code embedded in the
 * message is used as a fallback signal.
 */
export function extractStatus(error: unknown): number | null {
  if (typeof error === "object" && error !== null) {
    const bag = error as Record<string, unknown>;

    for (const key of ["status", "code", "statusCode"]) {
      const value = bag[key];
      if (typeof value === "number" && value >= 100 && value <= 599) {
        return value;
      }
    }

    // Nested provider shape: { error: { code: 503, status: "UNAVAILABLE" } }
    const nested = bag["error"];
    if (typeof nested === "object" && nested !== null) {
      const inner = (nested as Record<string, unknown>)["code"];
      if (typeof inner === "number" && inner >= 100 && inner <= 599) {
        return inner;
      }
    }
  }

  const text = rawText(error);
  const match = text.match(/\b(4\d{2}|5\d{2})\b/);
  if (match !== null) {
    const parsed = Number.parseInt(match[1] ?? "", 10);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function rawText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * True when the failure is worth retrying on the same model or escalating to
 * the next fallback. Auth failures are explicitly excluded: retrying an
 * invalid key only burns time.
 */
export function isTransientError(error: unknown): boolean {
  if (isAuthError(error)) return false;

  const status = extractStatus(error);
  if (status !== null && TRANSIENT_STATUSES.has(status)) return true;

  const text = rawText(error).toLowerCase();
  return TRANSIENT_PATTERNS.some((p) => text.includes(p));
}

export function isAuthError(error: unknown): boolean {
  const status = extractStatus(error);
  if (status === 401 || status === 403) return true;

  const text = rawText(error).toLowerCase();
  return AUTH_PATTERNS.some((p) => text.includes(p));
}

/**
 * Map any thrown value to a clean, user-facing Indonesian error.
 *
 * Never echoes the provider payload.
 */
export function describeGeminiError(error: unknown): AssistantError {
  if (isAuthError(error)) {
    return {
      kind: "auth",
      message: ASSISTANT_ERROR_COPY.auth,
      status: 401,
      retryable: false,
    };
  }

  const status = extractStatus(error);
  const text = rawText(error).toLowerCase();

  if (
    status === 429 ||
    text.includes("resource_exhausted") ||
    text.includes("resource exhausted") ||
    text.includes("quota")
  ) {
    return {
      kind: "rate_limit",
      message: ASSISTANT_ERROR_COPY.rate_limit,
      status: 429,
      retryable: true,
    };
  }

  if (
    status === 503 ||
    status === 500 ||
    status === 502 ||
    status === 504 ||
    text.includes("unavailable") ||
    text.includes("high demand") ||
    text.includes("overloaded")
  ) {
    return {
      kind: "busy",
      message: ASSISTANT_ERROR_COPY.busy,
      status: 503,
      retryable: true,
    };
  }

  if (
    text.includes("fetch failed") ||
    text.includes("econnreset") ||
    text.includes("etimedout") ||
    text.includes("socket hang up") ||
    text.includes("network")
  ) {
    return {
      kind: "network",
      message: ASSISTANT_ERROR_COPY.network,
      status: 502,
      retryable: true,
    };
  }

  return {
    kind: "unknown",
    message: ASSISTANT_ERROR_COPY.unknown,
    status: 500,
    retryable: true,
  };
}

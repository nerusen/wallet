/**
 * Environment access with explicit, fail-fast validation.
 *
 * Server secrets are read lazily through functions so that importing this
 * module from a Client Component boundary can never leak them into the bundle.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(
      `Konfigurasi hilang: variabel lingkungan ${name} belum diisi. Salin .env.example ke .env.local lalu lengkapi nilainya.`,
    );
  }
  return value;
}

/* ── Public (safe for the browser bundle) ─────────────────────────────────── */

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
} as const;

export function hasPublicSupabaseConfig(): boolean {
  return publicEnv.supabaseUrl.length > 0 && publicEnv.supabaseAnonKey.length > 0;
}

/* ── Server-only ──────────────────────────────────────────────────────────── */

export function getSupabaseUrl(): string {
  return requireEnv("NEXT_PUBLIC_SUPABASE_URL");
}

export function getSupabaseAnonKey(): string {
  return requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export function getServiceRoleKey(): string {
  return requireEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export function getAdminUsername(): string {
  return requireEnv("ADMIN_USERNAME");
}

export function getAdminPassword(): string {
  return requireEnv("ADMIN_PASSWORD");
}

export function getAuthSecret(): Uint8Array {
  const secret = requireEnv("AUTH_SECRET");
  if (secret.length < 32) {
    throw new Error(
      "AUTH_SECRET terlalu pendek. Gunakan minimal 32 karakter — buat dengan: openssl rand -base64 48",
    );
  }
  return new TextEncoder().encode(secret);
}

export function getSessionMaxAge(): number {
  const raw = process.env.AUTH_SESSION_MAX_AGE;
  const parsed = raw === undefined ? Number.NaN : Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60 * 60 * 24 * 7;
}

/** Non-throwing readiness probe used by the public docs page. */
export function configurationStatus(): {
  supabase: boolean;
  auth: boolean;
  serviceRole: boolean;
} {
  const secret = process.env.AUTH_SECRET ?? "";
  return {
    supabase: hasPublicSupabaseConfig(),
    auth:
      (process.env.ADMIN_USERNAME ?? "").length > 0 &&
      (process.env.ADMIN_PASSWORD ?? "").length > 0 &&
      secret.length >= 32,
    serviceRole: (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").length > 0,
  };
}

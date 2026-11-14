import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getServiceRoleKey, getSupabaseUrl } from "@/lib/env";
import type { Database } from "@/lib/types/database";

/**
 * Server-side Supabase client using the SERVICE ROLE key.
 *
 * This key bypasses RLS, so it must never reach the browser. Access is gated
 * by `requireSession()` in every Server Action that uses it.
 *
 * The client is memoised per server process — `createClient` is cheap but the
 * underlying fetch/realtime plumbing should not be rebuilt per request.
 */
let cached: SupabaseClient<Database> | null = null;

export function createServiceClient(): SupabaseClient<Database> {
  if (cached !== null) return cached;

  cached = createClient<Database>(getSupabaseUrl(), getServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { "x-application-name": "personal-finance-os" },
    },
  });

  return cached;
}

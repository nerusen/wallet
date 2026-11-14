"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { publicEnv } from "@/lib/env";
import type { Database } from "@/lib/types/database";

/**
 * Browser Supabase client, anon key only.
 *
 * Used exclusively for Realtime `postgres_changes` subscriptions so wallet
 * cards, charts, and tables update without a page reload. All writes go
 * through Server Actions.
 *
 * Returns `null` when Supabase is not configured, letting the UI degrade to
 * plain server-rendered data instead of crashing.
 */
let cached: SupabaseClient<Database> | null = null;

export function getBrowserClient(): SupabaseClient<Database> | null {
  if (publicEnv.supabaseUrl.length === 0 || publicEnv.supabaseAnonKey.length === 0) {
    return null;
  }
  if (cached !== null) return cached;

  cached = createBrowserClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
    {
      realtime: { params: { eventsPerSecond: 5 } },
    },
  );

  return cached;
}

"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { getBrowserClient } from "@/lib/supabase/client";
import type { RealtimeTable } from "@/lib/types/database";

/**
 * Subscribe to Supabase Realtime `postgres_changes` and refresh the current
 * route's server data when a watched table changes.
 *
 * `router.refresh()` re-runs the Server Components for the current route and
 * reconciles the result into the existing React tree — no full page reload,
 * no client-side duplication of the server's aggregation logic.
 *
 * Bursts are coalesced: a wallet transfer fires three events (one transaction
 * insert plus two wallet updates), which must produce exactly one refresh.
 */
export function useRealtimeRefresh(
  tables: readonly RealtimeTable[],
  options: { debounceMs?: number; enabled?: boolean } = {},
): void {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceMs = options.debounceMs ?? 220;
  const enabled = options.enabled ?? true;
  const key = tables.join(",");

  useEffect(() => {
    if (!enabled) return;

    const supabase = getBrowserClient();
    if (supabase === null) return;

    const watched = key.split(",").filter((t) => t.length > 0);
    if (watched.length === 0) return;

    const channel = supabase.channel(`pfos:${watched.join("+")}`);

    for (const table of watched) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          if (timerRef.current !== null) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            timerRef.current = null;
            router.refresh();
          }, debounceMs);
        },
      );
    }

    channel.subscribe();

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [key, debounceMs, enabled, router]);
}

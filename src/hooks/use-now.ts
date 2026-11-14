"use client";

import { useEffect, useState } from "react";

/** Live ticking clock, used by the 48-hour quarantine countdowns. */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}

/**
 * Deferred mount flag.
 *
 * Any value derived from `Date.now()` differs between the server render and
 * the first client render. Gating such output on `useMounted()` keeps
 * hydration deterministic.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

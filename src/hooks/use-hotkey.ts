"use client";

import { useEffect } from "react";

/**
 * Register a Ctrl+K / Cmd+K handler for the quick-log palette.
 * Ignores the shortcut while the user is typing in a field.
 */
export function useHotkey(
  key: string,
  handler: () => void,
  options: { ctrl?: boolean; enabled?: boolean } = {},
): void {
  const requireCtrl = options.ctrl ?? true;
  const enabled = options.enabled ?? true;

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== key.toLowerCase()) return;
      if (requireCtrl && !(event.ctrlKey || event.metaKey)) return;

      const target = event.target as HTMLElement | null;
      if (
        !requireCtrl &&
        target !== null &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      event.preventDefault();
      handler();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [key, handler, requireCtrl, enabled]);
}

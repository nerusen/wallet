"use client";

import * as React from "react";

import { QuickLogDialog } from "@/components/shell/quick-log-dialog";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { useHotkey } from "@/hooks/use-hotkey";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import type { Wallet } from "@/lib/types/database";

/**
 * Private app shell.
 *
 * Owns three pieces of cross-page state: sidebar collapse (persisted),
 * the mobile drawer, and the Ctrl+K quick-log palette. Also opens the single
 * Realtime subscription for the whole authenticated surface so individual
 * pages do not each create a channel.
 */
export function AppShell({
  children,
  wallets,
  today,
}: {
  children: React.ReactNode;
  wallets: readonly Wallet[];
  today: string;
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [quickLogOpen, setQuickLogOpen] = React.useState(false);

  // Restore the collapse preference after mount to keep SSR deterministic.
  React.useEffect(() => {
    if (window.localStorage.getItem("pfos-sidebar-collapsed") === "1") {
      setCollapsed(true);
    }
  }, []);

  const toggleCollapsed = React.useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem("pfos-sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  }, []);

  const openQuickLog = React.useCallback(() => setQuickLogOpen(true), []);
  useHotkey("k", openQuickLog, { ctrl: true });

  useRealtimeRefresh(["wallets", "transactions", "kanban_tasks", "daily_audits"]);

  return (
    <div className="flex min-h-dvh">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col border-r border-border">
        <Topbar
          onOpenMobileNav={() => setMobileOpen(true)}
          onOpenQuickLog={openQuickLog}
          today={today}
        />
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <QuickLogDialog
        open={quickLogOpen}
        onOpenChange={setQuickLogOpen}
        wallets={wallets}
        today={today}
      />
    </div>
  );
}

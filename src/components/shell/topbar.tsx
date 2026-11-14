"use client";

import { LogOut, Menu, Plus } from "lucide-react";
import { usePathname } from "next/navigation";

import { logoutAction } from "@/app/actions/auth";
import { navItemFor } from "@/components/shell/nav-items";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button, MotionButton } from "@/components/ui/button";
import { formatDateLong, timeWIB } from "@/lib/format";
import { useMounted } from "@/hooks/use-now";
import { cn } from "@/lib/utils";

/**
 * Topbar: breadcrumb · date · quick-log · theme · logout.
 *
 * ADJACENT BUTTON RULE: "+ Catat Cepat" is the only accent-filled control in
 * this rail; the theme switcher and Logout are strictly monochrome.
 */
export function Topbar({
  onOpenMobileNav,
  onOpenQuickLog,
  today,
}: {
  onOpenMobileNav: () => void;
  onOpenQuickLog: () => void;
  /** Server-rendered WIB date, so first paint matches the server. */
  today: string;
}) {
  const pathname = usePathname();
  const current = navItemFor(pathname);
  const mounted = useMounted();

  return (
    <header className="sticky top-0 z-30 flex h-topbar items-center gap-3 border-b border-border bg-background px-3 sm:px-4">
      <button
        type="button"
        onClick={onOpenMobileNav}
        aria-label="Buka menu"
        className="flex h-8 w-8 shrink-0 items-center justify-center border border-border text-muted-foreground transition-colors hover:bg-surface hover:text-foreground lg:hidden"
      >
        <Menu className="size-3.5" />
      </button>

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2">
        <span className="hidden font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground/60 sm:inline">
          Finance OS
        </span>
        <span aria-hidden className="hidden text-muted-foreground/40 sm:inline">
          /
        </span>
        <span className="truncate font-mono text-[11px] uppercase tracking-[0.08em] text-foreground">
          {current?.label ?? "Dashboard"}
        </span>
      </nav>

      <span aria-hidden className="ml-auto h-full w-px bg-border" />

      {/* Date + WIB clock */}
      <div className="hidden shrink-0 flex-col items-end leading-none md:flex">
        <span className="font-mono text-[11px] text-foreground tabular">
          {formatDateLong(today)}
        </span>
        <span className="mt-1 font-mono text-[10px] text-muted-foreground tabular">
          {mounted ? `${timeWIB()} WIB` : "—:— WIB"}
        </span>
      </div>

      <span aria-hidden className="hidden h-full w-px bg-border md:block" />

      {/* Quick log — the ONLY accent-filled button in this rail */}
      <MotionButton
        type="button"
        variant="accent"
        size="sm"
        onClick={onOpenQuickLog}
        className="shrink-0"
      >
        <Plus className="size-3.5" />
        <span className="hidden sm:inline">Catat Cepat</span>
        <kbd
          className={cn(
            "ml-1 hidden border border-accent-foreground/25 px-1 py-0.5",
            "font-mono text-[9px] leading-none tracking-[0.06em] lg:inline-block",
          )}
        >
          Ctrl K
        </kbd>
      </MotionButton>

      <ThemeSwitcher className="shrink-0" />

      {/* Monochrome sibling, per the adjacent-button rule */}
      <form action={logoutAction} className="shrink-0">
        <Button type="submit" variant="outline" size="sm" title="Keluar">
          <LogOut className="size-3.5" />
          <span className="hidden lg:inline">Logout</span>
        </Button>
      </form>
    </header>
  );
}

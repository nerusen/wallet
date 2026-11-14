"use client";

import { AnimatePresence, motion } from "framer-motion";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_ITEMS } from "@/components/shell/nav-items";
import { Eyebrow } from "@/components/ui/panel";
import { BRUTAL_EASE } from "@/components/ui/motion";
import { cn } from "@/lib/utils";

/**
 * Collapsible brutalist sidebar.
 *
 * Desktop: a fixed rail with a 1px right border; collapsing shrinks it to an
 * icon rail (3.5rem) rather than hiding it, so the structural line never
 * disappears from the layout.
 *
 * Mobile: an off-canvas drawer over a flat (non-blurred) scrim.
 */
export function Sidebar({
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* ── Desktop rail ── */}
      <aside
        className={cn(
          "hidden shrink-0 border-r border-border bg-background lg:flex lg:flex-col",
          "sticky top-0 h-dvh transition-[width] duration-300 ease-brutal",
          collapsed ? "w-sidebar-collapsed" : "w-sidebar",
        )}
      >
        <SidebarInner
          collapsed={collapsed}
          pathname={pathname}
          onToggleCollapsed={onToggleCollapsed}
        />
      </aside>

      {/* ── Mobile drawer ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: BRUTAL_EASE }}
              onClick={onCloseMobile}
              className="fixed inset-0 z-40 bg-background/85 lg:hidden"
            />
            <motion.aside
              key="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.28, ease: BRUTAL_EASE }}
              className="fixed inset-y-0 left-0 z-50 flex w-[17rem] flex-col border-r border-border-strong bg-background lg:hidden"
            >
              <div className="flex h-topbar items-center justify-between border-b border-border px-4">
                <span className="flex items-center gap-2.5">
                  <span aria-hidden className="h-3 w-3 bg-accent" />
                  <span className="font-mono text-[11px] uppercase tracking-[0.1em]">
                    Finance OS
                  </span>
                </span>
                <button
                  type="button"
                  onClick={onCloseMobile}
                  aria-label="Tutup menu"
                  className="flex h-8 w-8 items-center justify-center border border-border text-muted-foreground hover:bg-surface hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              <SidebarNav
                collapsed={false}
                pathname={pathname}
                onNavigate={onCloseMobile}
              />
              <SidebarFooter collapsed={false} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function SidebarInner({
  collapsed,
  pathname,
  onToggleCollapsed,
}: {
  collapsed: boolean;
  pathname: string;
  onToggleCollapsed: () => void;
}) {
  return (
    <>
      {/* Brand cell — same 3.5rem height as the topbar, so the horizontal
          hairline runs unbroken across the full page width. */}
      <div
        className={cn(
          "flex h-topbar items-center border-b border-border",
          collapsed ? "justify-center px-0" : "justify-between px-4",
        )}
      >
        {collapsed ? (
          <span aria-hidden className="h-3 w-3 bg-accent" />
        ) : (
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
            <span aria-hidden className="h-3 w-3 shrink-0 bg-accent" />
            <span className="truncate font-mono text-[11px] uppercase tracking-[0.1em] text-foreground">
              Finance OS
            </span>
          </Link>
        )}
      </div>

      <SidebarNav collapsed={collapsed} pathname={pathname} />

      <div className="mt-auto">
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Buka sidebar" : "Tutup sidebar"}
          className={cn(
            "flex w-full items-center gap-2.5 border-t border-border px-4 py-3",
            "font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground",
            "transition-colors hover:bg-surface hover:text-foreground",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-3.5" />
          ) : (
            <>
              <PanelLeftClose className="size-3.5" />
              Tutup Sidebar
            </>
          )}
        </button>
        <SidebarFooter collapsed={collapsed} />
      </div>
    </>
  );
}

function SidebarNav({
  collapsed,
  pathname,
  onNavigate,
}: {
  collapsed: boolean;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 overflow-y-auto" aria-label="Navigasi utama">
      {!collapsed && (
        <div className="border-b border-border px-4 py-2.5">
          <Eyebrow>Modul</Eyebrow>
        </div>
      )}
      <ul>
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <li key={item.href} className="border-b border-border">
              <Link
                href={item.href}
                onClick={onNavigate}
                title={collapsed ? item.label : undefined}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-3 transition-colors",
                  collapsed ? "justify-center px-0 py-3" : "px-4 py-2.5",
                  active
                    ? "bg-surface text-foreground"
                    : "text-muted-foreground hover:bg-surface hover:text-foreground",
                )}
              >
                {/* Active indicator: a 2px accent bar on the leading edge. */}
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 w-0.5 bg-accent"
                  />
                )}
                <item.Icon className="size-4 shrink-0" />
                {!collapsed && (
                  <span className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
                    <span className="truncate text-[13px] font-medium">
                      {item.label}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 font-mono text-[10px] tabular",
                        active ? "text-accent" : "text-muted-foreground/60",
                      )}
                    >
                      {item.code}
                    </span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function SidebarFooter({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return (
      <div className="flex items-center justify-center border-t border-border py-3">
        <span aria-hidden className="status-dot" data-tone="success" />
      </div>
    );
  }

  return (
    <div className="border-t border-border px-4 py-3">
      <div className="flex items-center gap-2">
        <span aria-hidden className="status-dot" data-tone="success" />
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          Realtime aktif
        </span>
      </div>
      <p className="mt-2 font-mono text-[10px] leading-relaxed text-muted-foreground/70">
        Self-hosted · MIT
      </p>
    </div>
  );
}

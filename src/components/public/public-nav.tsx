"use client";

import { ArrowRight, Github, LayoutDashboard, LogIn } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button, MotionButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { href: "#arsitektur", label: "Arsitektur" },
  { href: "#modul", label: "Modul" },
  { href: "#setup", label: "Self-Hosting" },
  { href: "#lisensi", label: "Lisensi" },
] as const;

/**
 * Public navbar.
 *
 * Sticky rail with a 1px bottom border. The CTA is the only accent-filled
 * control; the theme switcher and the GitHub link stay monochrome.
 */
export function PublicNav({ authenticated }: { authenticated: boolean }) {
  const [open, setOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="flex h-topbar items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span aria-hidden className="h-3 w-3 bg-accent" />
          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-foreground">
            Personal Finance OS
          </span>
        </Link>

        <nav aria-label="Navigasi halaman" className="ml-6 hidden items-center lg:flex">
          {SECTIONS.map((section) => (
            <a
              key={section.href}
              href={section.href}
              className="border-l border-border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            >
              {section.label}
            </a>
          ))}
        </nav>

        <span className="ml-auto flex shrink-0 items-center gap-2">
          <ThemeSwitcher />

          <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer noopener"
              title="Repositori open source"
            >
              <Github className="size-3.5" />
              <span className="hidden lg:inline">Source</span>
            </a>
          </Button>

          {/* The single accent CTA in this rail */}
          <MotionButton asChild variant="accent" size="sm">
            <Link href={authenticated ? "/dashboard" : "/login"}>
              {authenticated ? (
                <>
                  <LayoutDashboard className="size-3.5" />
                  Dashboard
                </>
              ) : (
                <>
                  <LogIn className="size-3.5" />
                  Masuk
                </>
              )}
            </Link>
          </MotionButton>

          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
            aria-label="Buka navigasi bagian"
            className="flex h-8 w-8 items-center justify-center border border-border text-muted-foreground transition-colors hover:bg-surface hover:text-foreground lg:hidden"
          >
            <ArrowRight
              className={cn(
                "size-3.5 transition-transform duration-200",
                open && "rotate-90",
              )}
            />
          </button>
        </span>
      </div>

      {open && (
        <nav
          aria-label="Navigasi bagian"
          className="flex flex-col border-t border-border lg:hidden"
        >
          {SECTIONS.map((section) => (
            <a
              key={section.href}
              href={section.href}
              onClick={() => setOpen(false)}
              className="border-b border-border px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            >
              {section.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}

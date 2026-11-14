"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { useMounted } from "@/hooks/use-now";
import { cn } from "@/lib/utils";

/**
 * Light / Dark / System switcher.
 *
 * Three flush bordered cells; the active one inverts to the monochrome fill.
 * Renders a neutral skeleton until mounted so SSR and the client agree.
 */
export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  const options = [
    { value: "light", label: "Terang", Icon: Sun },
    { value: "dark", label: "Gelap", Icon: Moon },
    { value: "system", label: "Sistem", Icon: Monitor },
  ] as const;

  return (
    <div
      role="group"
      aria-label="Mode tampilan"
      className={cn("inline-flex border border-border", className)}
    >
      {options.map((option, index) => {
        const active = mounted && theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            title={option.label}
            onClick={() => setTheme(option.value)}
            className={cn(
              "flex h-8 w-8 items-center justify-center transition-colors",
              index > 0 && "border-l border-border",
              active
                ? "bg-foreground text-background"
                : "bg-transparent text-muted-foreground hover:bg-surface hover:text-foreground",
            )}
          >
            <option.Icon className="size-3.5" />
            <span className="sr-only">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Two-state variant for tight rails (public navbar on mobile). */
export function ThemeToggleCompact({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label={isDark ? "Aktifkan mode terang" : "Aktifkan mode gelap"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "flex h-8 w-8 items-center justify-center border border-border",
        "text-muted-foreground transition-colors hover:bg-surface hover:text-foreground",
        className,
      )}
    >
      {isDark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
    </button>
  );
}

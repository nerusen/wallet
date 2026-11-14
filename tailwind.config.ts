import type { Config } from "tailwindcss";

/**
 * Architectural Brutalist design system.
 *
 * Synthesized strictly from the three mandated references:
 *  - getartcraft.com  → border-dense exposed grid (662 border utilities), 1280px page frame,
 *                       10/11px micro mono labels, two-base-colour flat palette.
 *  - chaingpt.org     → corner registration marks (corner-top-left/right, bottom-left/right SVGs),
 *                       numbered section eyebrows (01..09), uppercase label rails, status dots.
 *  - opencode.ai      → `border-top: 1px solid var(--border)` hairline rows, outline grid built with
 *                       border-inline-start + per-cell border-inline-end/border-bottom at gap:0,
 *                       `border-radius: 0` forced, mono eyebrow at 13px / .08em / uppercase,
 *                       14.75rem sidebar, 3.5rem topbar.
 *
 * Hard rules encoded here: no gradient utilities, no glow shadows, sharp geometry only.
 */
const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
    "./src/hooks/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "0",
      screens: {
        "2xl": "1280px",
      },
    },
    extend: {
      colors: {
        background: "rgb(var(--canvas) / <alpha-value>)",
        foreground: "rgb(var(--ink) / <alpha-value>)",
        border: "rgb(var(--line) / <alpha-value>)",
        "border-strong": "rgb(var(--line-strong) / <alpha-value>)",
        input: "rgb(var(--line) / <alpha-value>)",
        ring: "rgb(var(--accent) / <alpha-value>)",
        surface: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          foreground: "rgb(var(--ink) / <alpha-value>)",
        },
        card: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          foreground: "rgb(var(--ink) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "rgb(var(--canvas) / <alpha-value>)",
          foreground: "rgb(var(--ink) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          foreground: "rgb(var(--ink-muted) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          foreground: "rgb(var(--accent-ink) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          foreground: "rgb(var(--accent-ink) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          foreground: "rgb(var(--ink) / <alpha-value>)",
        },
        success: {
          DEFAULT: "rgb(var(--success) / <alpha-value>)",
          foreground: "rgb(var(--accent-ink) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "rgb(var(--warning) / <alpha-value>)",
          foreground: "rgb(var(--accent-ink) / <alpha-value>)",
        },
        danger: {
          DEFAULT: "rgb(var(--danger) / <alpha-value>)",
          foreground: "rgb(255 255 255 / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "rgb(var(--danger) / <alpha-value>)",
          foreground: "rgb(255 255 255 / <alpha-value>)",
        },
        chart: {
          salary: "rgb(var(--accent) / <alpha-value>)",
          freelance: "rgb(var(--chart-mono) / <alpha-value>)",
          expense: "rgb(var(--danger) / <alpha-value>)",
        },
      },
      /** Sharp geometry only. `lg`/`xl`/`2xl` are deliberately collapsed to 0. */
      borderRadius: {
        none: "0px",
        DEFAULT: "0px",
        sm: "0px",
        hair: "2px",
        md: "2px",
        lg: "0px",
        xl: "0px",
        "2xl": "0px",
        "3xl": "0px",
        full: "9999px",
      },
      fontFamily: {
        sans: ["var(--font-display)", "var(--font-sans-fallback)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans-fallback)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        micro: ["10px", { lineHeight: "1", letterSpacing: "0.09em" }],
        meta: ["11px", { lineHeight: "1.1", letterSpacing: "0.08em" }],
        eyebrow: ["12px", { lineHeight: "1", letterSpacing: "0.08em" }],
        cell: ["13px", { lineHeight: "1.3" }],
      },
      spacing: {
        topbar: "3.5rem",
        sidebar: "14.75rem",
        "sidebar-collapsed": "3.5rem",
        edge: "1.5rem",
        gutter: "1rem",
      },
      maxWidth: {
        page: "1280px",
      },
      /** Flat, non-glow elevation only: a 1px hairline ring. No blur, no glow. */
      boxShadow: {
        none: "none",
        hairline: "0 0 0 1px rgb(var(--line))",
        "hairline-strong": "0 0 0 1px rgb(var(--line-strong))",
        accent: "0 0 0 1px rgb(var(--accent))",
      },
      keyframes: {
        "ridge-in": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "line-draw": {
          from: { transform: "scaleX(0)" },
          to: { transform: "scaleX(1)" },
        },
        "status-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        "ridge-in": "ridge-in 0.35s cubic-bezier(0.22,1,0.36,1) both",
        "line-draw": "line-draw 0.5s cubic-bezier(0.22,1,0.36,1) both",
        "status-pulse": "status-pulse 2s ease-in-out infinite",
      },
      transitionTimingFunction: {
        brutal: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  /** Gradient + blur + glow utilities are unused by design; see docs/DESIGN_SYSTEM rules. */
  corePlugins: {
    backgroundOpacity: true,
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;

import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";

/**
 * Two font families, no more.
 *
 * 1. Display / UI — "Google Sans".
 *    Google Sans is not served by the public Google Fonts CSS API, so it is
 *    requested by name via <link> in the root layout (where it resolves on
 *    devices that have it) and `Plus Jakarta Sans` is loaded through
 *    `next/font/google` as the self-hosted, zero-layout-shift fallback.
 *    `--font-display` therefore lists Google Sans first and Plus Jakarta Sans
 *    immediately after, which is the exact behaviour the spec asks for.
 *
 * 2. Technical mono — "JetBrains Mono".
 *    Used for every Rupiah value, date, percentage, eyebrow tag, table cell,
 *    and badge, always with `tabular-nums` so digits never shift width.
 */

export const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans-fallback",
  display: "swap",
  adjustFontFallback: true,
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
  adjustFontFallback: true,
});

export const fontVariables = `${plusJakarta.variable} ${jetbrainsMono.variable}`;

/** Stylesheet requested in the root layout, per the design brief. */
export const GOOGLE_SANS_HREF =
  "https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&display=swap";

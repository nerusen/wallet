import type { Metadata, Viewport } from "next";

import { ThemeProvider } from "@/components/theme-provider";
import { GOOGLE_SANS_HREF, fontVariables } from "@/lib/fonts";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Personal Finance OS — Command Center",
    template: "%s · Personal Finance OS",
  },
  description:
    "Sistem operasi keuangan & karier pribadi yang bisa di-self-host sendiri di Vercel + Supabase. Open source, MIT License.",
  applicationName: "Personal Finance OS",
  authors: [{ name: "Personal Finance OS contributors" }],
  keywords: [
    "personal finance",
    "self-hosted",
    "supabase",
    "next.js",
    "kanban",
    "budgeting",
    "open source",
  ],
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#09090B" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" suppressHydrationWarning className={fontVariables}>
      <head>
        {/*
          Google Sans is requested by name per the design brief. It is not
          served by the public Google Fonts CSS API, so `--font-display`
          falls through to the self-hosted Plus Jakarta Sans loaded via
          next/font — zero layout shift either way.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={GOOGLE_SANS_HREF} />
      </head>
      <body className="min-h-dvh bg-background text-foreground">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

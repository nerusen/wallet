"use client";

import { RotateCcw } from "lucide-react";

import { Button, MotionButton } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/panel";

/**
 * Route-level error boundary.
 *
 * The message is surfaced verbatim because this is a single-user, self-hosted
 * app: the operator and the user are the same person, and a readable Supabase
 * error is far more actionable than a generic apology.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-dvh">
      <div className="page-frame flex min-h-dvh items-center justify-center px-4">
        <div className="max-w-lg border border-danger bg-background p-8">
          <Eyebrow rule>
            <span className="text-danger">Terjadi Kesalahan</span>
          </Eyebrow>
          <h1 className="mt-6 text-[24px] font-bold leading-[1.15] tracking-[-0.02em] text-foreground">
            Sistem gagal memuat halaman ini.
          </h1>

          <div className="mt-5 border border-border bg-surface px-3 py-2.5">
            <p className="font-mono text-[11px] leading-relaxed text-danger">
              {error.message}
            </p>
            {error.digest !== undefined && (
              <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                digest: {error.digest}
              </p>
            )}
          </div>

          <p className="mt-5 text-[12px] leading-relaxed text-muted-foreground">
            Penyebab paling umum: migrasi Supabase belum dijalankan (
            <code className="border border-border px-1 font-mono text-[11px]">
              npx supabase db push
            </code>
            ), atau variabel lingkungan di{" "}
            <code className="font-mono">.env.local</code> belum lengkap.
          </p>

          <div className="mt-8 flex flex-wrap gap-2">
            <MotionButton type="button" variant="accent" size="sm" onClick={reset}>
              <RotateCcw className="size-3.5" />
              Coba Lagi
            </MotionButton>
            <Button asChild variant="outline" size="sm">
              <a href="/">Halaman Utama</a>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

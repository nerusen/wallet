import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "@/app/login/login-form";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Eyebrow } from "@/components/ui/panel";
import { configurationStatus } from "@/lib/env";

export const metadata: Metadata = {
  title: "Masuk",
  description: "Autentikasi pemilik tunggal Personal Finance OS.",
  robots: { index: false, follow: false },
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const status = configurationStatus();
  const next =
    typeof searchParams.next === "string" && searchParams.next.startsWith("/")
      ? searchParams.next
      : "/dashboard";

  return (
    <main className="min-h-dvh">
      <div className="page-frame min-h-dvh">
        {/* Top rail */}
        <header className="flex h-topbar items-center justify-between border-b border-border px-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span aria-hidden className="h-3 w-3 bg-accent" />
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-foreground">
              Personal Finance OS
            </span>
          </Link>
          <ThemeSwitcher />
        </header>

        <div className="grid min-h-[calc(100dvh-3.5rem)] grid-cols-1 lg:grid-cols-2">
          {/* ── Credential column ── */}
          <section className="flex items-center justify-center border-b border-border px-4 py-14 lg:border-b-0 lg:border-r">
            <div className="w-full max-w-sm">
              <Eyebrow accent>Akses Terbatas</Eyebrow>
              <h1 className="mt-4 text-[28px] font-bold leading-[1.1] tracking-[-0.02em] text-foreground">
                Masuk ke
                <br />
                Command Center
              </h1>
              <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
                Sistem ini berjalan dalam mode pengguna tunggal. Pendaftaran publik
                dinonaktifkan sepenuhnya — hanya kredensial yang tersimpan di{" "}
                <code className="border border-border bg-surface px-1 py-0.5 font-mono text-[11px]">
                  .env.local
                </code>{" "}
                yang diterima.
              </p>

              <div className="mt-8">
                <LoginForm next={next} />
              </div>

              <div className="mt-8 border-t border-border pt-5">
                <Eyebrow>Status Konfigurasi</Eyebrow>
                <ul className="mt-3 space-y-0 border border-border">
                  <ConfigRow label="Kredensial & AUTH_SECRET" ok={status.auth} />
                  <ConfigRow label="Supabase URL & Anon Key" ok={status.supabase} />
                  <ConfigRow label="Service Role Key" ok={status.serviceRole} />
                </ul>
              </div>
            </div>
          </section>

          {/* ── Reference column: exposed grid field ── */}
          <section className="relative hidden lg:block">
            <GridField />
            <div className="absolute inset-x-0 bottom-0 border-t border-border bg-background px-6 py-5">
              <Eyebrow>Arsitektur</Eyebrow>
              <p className="mt-3 max-w-md text-[12px] leading-relaxed text-muted-foreground">
                Sesi ditandatangani dengan{" "}
                <span className="font-mono text-foreground">jose</span> HS256 dan
                disimpan sebagai cookie{" "}
                <span className="font-mono text-foreground">HttpOnly</span>,{" "}
                <span className="font-mono text-foreground">Secure</span>,{" "}
                <span className="font-mono text-foreground">SameSite=Lax</span>.
                Seluruh rute privat diverifikasi di{" "}
                <span className="font-mono text-foreground">middleware.ts</span>{" "}
                pada Edge runtime sebelum render.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function ConfigRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 last:border-b-0">
      <span className="font-mono text-[11px] text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2">
        <span
          aria-hidden
          className="status-dot"
          data-tone={ok ? "success" : "danger"}
        />
        <span
          className={`font-mono text-[10px] uppercase tracking-[0.08em] ${
            ok ? "text-success" : "text-danger"
          }`}
        >
          {ok ? "Siap" : "Kosong"}
        </span>
      </span>
    </li>
  );
}

/** Decorative exposed-grid field: 1px lines only, no gradients. */
function GridField() {
  const cells = Array.from({ length: 48 }, (_, i) => i);
  const accentCells = new Set([5, 13, 22, 30, 41]);

  return (
    <div
      aria-hidden
      className="grid h-full grid-cols-6 border-l border-border"
    >
      {cells.map((i) => (
        <div
          key={i}
          className={`border-b border-r border-border ${
            accentCells.has(i) ? "bg-surface" : ""
          }`}
        >
          {accentCells.has(i) && (
            <span className="block h-full w-full p-3">
              <span className="block h-1.5 w-1.5 bg-accent" />
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

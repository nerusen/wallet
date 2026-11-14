import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Database,
  FileSpreadsheet,
  KanbanSquare,
  Lock,
  ShieldCheck,
  Wallet as WalletIcon,
  Zap,
} from "lucide-react";

import { PublicNav } from "@/components/public/public-nav";
import { Badge, Eyebrow, Panel, PanelHeader } from "@/components/ui/panel";
import { Button, MotionButton } from "@/components/ui/button";
import { Reveal, RevealOnScroll, StaggerGrid, StaggerItem } from "@/components/ui/motion";
import { NAV_ITEMS } from "@/components/shell/nav-items";
import { isAuthenticated } from "@/lib/auth/guard";
import { configurationStatus } from "@/lib/env";
import {
  CORE_RULES,
  EMERGENCY_FUND_TARGET,
  MAX_WALLETS,
  QUARANTINE_HOURS,
  SYSTEM_START_DATE,
  WEEKLY_BUDGET_CAP,
} from "@/lib/constants";
import { formatDateShort, formatRupiah } from "@/lib/format";

export const metadata: Metadata = {
  title: "Personal Finance OS — Self-Hosted Financial & Workflow OS",
  description:
    "Sistem operasi keuangan & karier pribadi yang bisa Anda host sendiri di Vercel + Supabase dengan kredensial milik sendiri. Open source, MIT License.",
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const authenticated = await isAuthenticated();
  const status = configurationStatus();

  return (
    <div className="min-h-dvh">
      <div className="page-frame min-h-dvh">
        <PublicNav authenticated={authenticated} />

        {/* ══════════════════════════════════════════════════════════════════
            HERO — exposed grid lines
            ══════════════════════════════════════════════════════════════════ */}
        <section className="relative border-b border-border">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <div className="border-b border-border px-4 py-12 sm:px-6 sm:py-16 lg:border-b-0 lg:border-r lg:py-20">
              <Reveal>
                <Eyebrow accent rule>
                  Open Source · Self-Hosted · MIT
                </Eyebrow>
              </Reveal>

              <Reveal delay={0.06}>
                <h1 className="mt-7 text-[34px] font-bold leading-[1.05] tracking-[-0.03em] text-foreground sm:text-[46px] lg:text-[56px]">
                  Sistem Operasi
                  <br />
                  Keuangan &amp;
                  <br />
                  <span className="text-accent">Karier Pribadi.</span>
                </h1>
              </Reveal>

              <Reveal delay={0.12}>
                <p className="mt-6 max-w-xl text-[14px] leading-relaxed text-muted-foreground sm:text-[15px]">
                  Satu command center untuk mencatat setiap Rupiah, membatasi belanja
                  impulsif, memecah gaji secara otomatis, dan menjaga disiplin harian.
                  Dibangun di atas Next.js dan Supabase — Anda yang memegang seluruh
                  data dan kredensialnya.
                </p>
              </Reveal>

              <Reveal delay={0.18}>
                <div className="mt-9 flex flex-wrap items-center gap-2">
                  {/* Adjacent-button rule: exactly one accent fill. */}
                  <MotionButton asChild variant="accent" size="lg">
                    <Link href={authenticated ? "/dashboard" : "/login"}>
                      {authenticated ? "Buka Dashboard" : "Masuk ke Sistem"}
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </MotionButton>
                  <Button asChild variant="outline" size="lg">
                    <a href="#setup">Panduan Self-Hosting</a>
                  </Button>
                </div>
              </Reveal>

              <Reveal delay={0.24}>
                <dl className="mt-12 grid grid-cols-2 border-l border-t border-border sm:grid-cols-4">
                  {[
                    { label: "Batas / Minggu", value: formatRupiah(WEEKLY_BUDGET_CAP) },
                    { label: "Target Darurat", value: formatRupiah(EMERGENCY_FUND_TARGET) },
                    { label: "Karantina", value: `${QUARANTINE_HOURS} jam` },
                    { label: "Dompet Maks", value: `${MAX_WALLETS}` },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="border-b border-r border-border px-3 py-3"
                    >
                      <dt className="eyebrow">{stat.label}</dt>
                      <dd className="mt-2 font-mono text-[13px] font-semibold text-foreground tabular">
                        {stat.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Reveal>
            </div>

            {/* Exposed grid field — 1px lines only */}
            <div className="relative min-h-[18rem] lg:min-h-0">
              <HeroGrid />
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            SYSTEM ARCHITECTURE
            ══════════════════════════════════════════════════════════════════ */}
        <section id="arsitektur" className="border-b border-border">
          <div className="px-4 py-12 sm:px-6 sm:py-16">
            <RevealOnScroll>
              <Eyebrow accent rule>
                01 · System Architecture Overview
              </Eyebrow>
              <h2 className="mt-6 max-w-2xl text-[24px] font-bold leading-[1.15] tracking-[-0.02em] text-foreground sm:text-[30px]">
                Tiga lapis, tanpa layanan pihak ketiga tambahan.
              </h2>
              <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
                Tidak ada backend terpisah, tidak ada antrean pekerjaan, tidak ada
                langganan analitik. Kebenaran angka dijaga di level database, bukan di
                antarmuka.
              </p>
            </RevealOnScroll>

            <StaggerGrid
              scroll
              className="outline-grid mt-10 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            >
              {ARCHITECTURE.map((layer) => (
                <StaggerItem key={layer.code} className="bg-background p-5">
                  <div className="flex items-start justify-between gap-2">
                    <layer.Icon className="size-4 shrink-0 text-accent" />
                    <span className="font-mono text-[10px] text-muted-foreground/50 tabular">
                      {layer.code}
                    </span>
                  </div>
                  <h3 className="mt-4 text-[14px] font-semibold text-foreground">
                    {layer.title}
                  </h3>
                  <p className="mt-2.5 text-[12px] leading-relaxed text-muted-foreground">
                    {layer.detail}
                  </p>
                  <ul className="mt-4 border-t border-border pt-3">
                    {layer.stack.map((item) => (
                      <li
                        key={item}
                        className="flex items-baseline gap-2 py-1 font-mono text-[11px] text-muted-foreground"
                      >
                        <span aria-hidden className="size-1 shrink-0 bg-accent" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </StaggerItem>
              ))}
            </StaggerGrid>

            {/* Data-integrity rail */}
            <RevealOnScroll delay={0.1}>
              <Panel className="mt-8" marks>
                <PanelHeader
                  code="02"
                  eyebrow="Jaminan Integritas Data"
                  title="Aturan Yang Dipaksakan Di Level Database"
                  description="Antarmuka boleh salah; database tidak. Empat trigger PostgreSQL menjaga invarian sistem."
                />
                <ul className="divide-grid-y">
                  {DB_GUARANTEES.map((item) => (
                    <li
                      key={item.fn}
                      className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <code className="font-mono text-[11px] text-accent">
                          {item.fn}
                        </code>
                        <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                          {item.detail}
                        </p>
                      </div>
                      <Badge tone="neutral">{item.trigger}</Badge>
                    </li>
                  ))}
                </ul>
              </Panel>
            </RevealOnScroll>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            MODULES
            ══════════════════════════════════════════════════════════════════ */}
        <section id="modul" className="border-b border-border">
          <div className="px-4 py-12 sm:px-6 sm:py-16">
            <RevealOnScroll>
              <Eyebrow accent rule>
                03 · Tujuh Modul
              </Eyebrow>
              <h2 className="mt-6 max-w-2xl text-[24px] font-bold leading-[1.15] tracking-[-0.02em] text-foreground sm:text-[30px]">
                Setiap modul memecahkan satu masalah nyata.
              </h2>
            </RevealOnScroll>

            <StaggerGrid
              scroll
              className="outline-grid mt-10 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
            >
              {NAV_ITEMS.map((item) => (
                <StaggerItem key={item.href} className="bg-background p-5">
                  <div className="flex items-start justify-between gap-2">
                    <item.Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="font-mono text-[10px] text-accent tabular">
                      {item.code}
                    </span>
                  </div>
                  <h3 className="mt-4 text-[13px] font-semibold text-foreground">
                    {item.label}
                  </h3>
                  <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                  <code className="mt-3 block font-mono text-[10px] text-muted-foreground/60">
                    {item.href}
                  </code>
                </StaggerItem>
              ))}
            </StaggerGrid>

            {/* Core rules */}
            <RevealOnScroll delay={0.1}>
              <Panel className="mt-8">
                <PanelHeader
                  code="04"
                  eyebrow="Aturan Inti Yang Dibawa Sistem"
                  title="Standard Operating Procedure"
                  description="Delapan aturan default. Semuanya bisa Anda ubah di satu file konstanta setelah fork."
                />
                <div className="outline-grid grid-cols-1 border-t-0 sm:grid-cols-2 lg:grid-cols-4">
                  {CORE_RULES.map((rule) => (
                    <div key={rule.code} className="bg-background p-4">
                      <span className="eyebrow eyebrow-accent">{rule.code}</span>
                      <h4 className="mt-2.5 text-[12px] font-semibold leading-snug text-foreground">
                        {rule.title}
                      </h4>
                      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                        {rule.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </Panel>
            </RevealOnScroll>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            SELF-HOSTING SETUP
            ══════════════════════════════════════════════════════════════════ */}
        <section id="setup" className="border-b border-border">
          <div className="px-4 py-12 sm:px-6 sm:py-16">
            <RevealOnScroll>
              <Eyebrow accent rule>
                05 · Self-Hosting Setup Docs
              </Eyebrow>
              <h2 className="mt-6 max-w-2xl text-[24px] font-bold leading-[1.15] tracking-[-0.02em] text-foreground sm:text-[30px]">
                Jalankan instance Anda sendiri dalam enam langkah.
              </h2>
              <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
                Tidak ada halaman pendaftaran dan tidak ada tenant lain. Satu deployment
                melayani tepat satu orang: Anda. Kredensial disimpan sebagai environment
                variable, bukan di database.
              </p>
            </RevealOnScroll>

            <div className="mt-10 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
              {/* Steps */}
              <RevealOnScroll>
                <Panel>
                  <PanelHeader
                    code="06"
                    eyebrow="Langkah Instalasi"
                    title="Dari Clone Sampai Produksi"
                  />
                  <ol className="divide-grid-y">
                    {SETUP_STEPS.map((step, index) => (
                      <li key={step.title} className="px-4 py-4">
                        <div className="flex items-start gap-3">
                          <span className="eyebrow eyebrow-accent mt-0.5 shrink-0 border border-border px-1.5 py-1 tabular">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-[13px] font-semibold text-foreground">
                              {step.title}
                            </h4>
                            <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                              {step.detail}
                            </p>
                            {step.command !== undefined && (
                              <div className="table-scroll mt-2.5 border border-border bg-surface">
                                <pre className="min-w-max px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground">
                                  {step.command}
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </Panel>
              </RevealOnScroll>

              {/* Env reference */}
              <RevealOnScroll delay={0.08}>
                <Panel>
                  <PanelHeader
                    code="07"
                    eyebrow="Environment Variables"
                    title=".env.local"
                    description="Variabel yang sama dipasang di Vercel → Settings → Environment Variables."
                  />
                  <div className="table-scroll border-b border-border bg-surface">
                    <pre className="min-w-max px-4 py-3 font-mono text-[11px] leading-relaxed text-foreground">
{`# Autentikasi pengguna tunggal
ADMIN_USERNAME=nelsen
ADMIN_PASSWORD=your_strong_password_here
AUTH_SECRET=your_32_char_random_jwt_secret

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key`}
                    </pre>
                  </div>

                  <ul className="divide-grid-y">
                    <li className="flex items-start gap-3 px-4 py-3">
                      <Lock className="mt-0.5 size-3.5 shrink-0 text-warning" />
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        <span className="text-foreground">SUPABASE_SERVICE_ROLE_KEY</span>{" "}
                        tidak boleh diberi awalan{" "}
                        <code className="font-mono">NEXT_PUBLIC_</code>. Kunci ini hanya
                        dipakai di Server Action dan melewati RLS.
                      </p>
                    </li>
                    <li className="flex items-start gap-3 px-4 py-3">
                      <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-accent" />
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        Buat <span className="text-foreground">AUTH_SECRET</span> dengan{" "}
                        <code className="font-mono">openssl rand -base64 48</code>.
                        Minimal 32 karakter.
                      </p>
                    </li>
                  </ul>

                  <div className="border-t border-border px-4 py-3">
                    <Eyebrow>Status Instance Ini</Eyebrow>
                    <ul className="mt-3 border border-border">
                      <StatusRow label="Kredensial & AUTH_SECRET" ok={status.auth} />
                      <StatusRow label="Supabase URL & Anon Key" ok={status.supabase} />
                      <StatusRow label="Service Role Key" ok={status.serviceRole} />
                    </ul>
                  </div>
                </Panel>
              </RevealOnScroll>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            LICENSE
            ══════════════════════════════════════════════════════════════════ */}
        <section id="lisensi" className="border-b border-border">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="border-b border-border px-4 py-12 sm:px-6 sm:py-16 lg:border-b-0 lg:border-r">
              <RevealOnScroll>
                <Eyebrow accent rule>
                  08 · Open-Source MIT License
                </Eyebrow>
                <h2 className="mt-6 text-[24px] font-bold leading-[1.15] tracking-[-0.02em] text-foreground sm:text-[30px]">
                  Fork, ubah, komersialkan.
                  <br />
                  Tanpa izin tambahan.
                </h2>
                <p className="mt-4 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
                  Seluruh kode dirilis di bawah MIT License. Anda boleh menggunakan,
                  menyalin, memodifikasi, menggabungkan, menerbitkan, mendistribusikan,
                  mensublisensikan, dan/atau menjual salinannya — selama pemberitahuan
                  hak cipta dan izin ini tetap disertakan.
                </p>
                <div className="mt-8 flex flex-wrap gap-2">
                  <Badge tone="accent">MIT License</Badge>
                  <Badge tone="neutral">Tanpa Telemetri</Badge>
                  <Badge tone="neutral">Tanpa Vendor Lock-in</Badge>
                  <Badge tone="neutral">Data Milik Anda</Badge>
                </div>
              </RevealOnScroll>
            </div>

            <div className="px-4 py-12 sm:px-6 sm:py-16">
              <RevealOnScroll delay={0.08}>
                <div className="table-scroll border border-border bg-surface">
                  <pre className="min-w-max px-4 py-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
{`MIT License

Copyright (c) 2026 Personal Finance OS
contributors

Permission is hereby granted, free of charge,
to any person obtaining a copy of this software
and associated documentation files (the
"Software"), to deal in the Software without
restriction, including without limitation the
rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the
Software is furnished to do so, subject to the
following conditions:

The above copyright notice and this permission
notice shall be included in all copies or
substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT
WARRANTY OF ANY KIND.`}
                  </pre>
                </div>
              </RevealOnScroll>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            FINAL CTA + FOOTER
            ══════════════════════════════════════════════════════════════════ */}
        <section className="border-b border-border">
          <div className="flex flex-col items-start gap-6 px-4 py-12 sm:px-6 sm:py-16 lg:flex-row lg:items-center lg:justify-between">
            <RevealOnScroll className="min-w-0">
              <Eyebrow accent>Mulai Sekarang</Eyebrow>
              <h2 className="mt-4 max-w-xl text-[22px] font-bold leading-[1.15] tracking-[-0.02em] text-foreground sm:text-[28px]">
                Disiplin keuangan tidak diingat. Disiplin keuangan dicatat.
              </h2>
              <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
                Baseline sistem dimulai {formatDateShort(SYSTEM_START_DATE)}. Semua angka
                di atas adalah default yang bisa Anda sesuaikan sendiri.
              </p>
            </RevealOnScroll>

            <RevealOnScroll delay={0.08} className="shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                <MotionButton asChild variant="accent" size="lg">
                  <Link href={authenticated ? "/dashboard" : "/login"}>
                    {authenticated ? "Buka Dashboard" : "Masuk"}
                    <ArrowRight className="size-3.5" />
                  </Link>
                </MotionButton>
                <Button asChild variant="outline" size="lg">
                  <a href="#arsitektur">Pelajari Arsitektur</a>
                </Button>
              </div>
            </RevealOnScroll>
          </div>
        </section>

        <footer className="px-4 py-6 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-2.5">
              <span aria-hidden className="h-2.5 w-2.5 bg-accent" />
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                Personal Finance OS · MIT License · 2026
              </span>
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground/60">
              Next.js · Supabase · Tailwind · Recharts · Framer Motion
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}

function StatusRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 last:border-b-0">
      <span className="font-mono text-[11px] text-muted-foreground">{label}</span>
      <span className="flex shrink-0 items-center gap-2">
        <span aria-hidden className="status-dot" data-tone={ok ? "success" : "danger"} />
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

/** Decorative exposed-grid field. 1px borders only — no gradients, no glow. */
function HeroGrid() {
  const cells = Array.from({ length: 60 }, (_, i) => i);
  const filled = new Set([7, 14, 23, 31, 38, 46, 52]);
  const accented = new Set([14, 38]);

  return (
    <div aria-hidden className="grid h-full grid-cols-6 border-l border-t border-border">
      {cells.map((i) => (
        <div
          key={i}
          className={`relative border-b border-r border-border ${
            filled.has(i) ? "bg-surface" : ""
          }`}
        >
          {accented.has(i) && (
            <span className="absolute left-2.5 top-2.5 block h-2 w-2 bg-accent" />
          )}
          {filled.has(i) && !accented.has(i) && (
            <span className="absolute left-2.5 top-2.5 block h-2 w-2 bg-foreground" />
          )}
        </div>
      ))}
    </div>
  );
}

const ARCHITECTURE = [
  {
    code: "L1",
    title: "Antarmuka — Next.js App Router",
    detail:
      "Server Components membaca data langsung dari Supabase; Client Components hanya menangani interaksi. Seluruh mutasi lewat Server Action yang diautentikasi.",
    stack: [
      "Next.js 14 App Router (TypeScript strict)",
      "Tailwind CSS + komponen gaya shadcn/ui",
      "Framer Motion untuk reveal & tap state",
      "Recharts untuk grafik pegunungan",
    ],
    Icon: Zap,
  },
  {
    code: "L2",
    title: "Autentikasi — Pengguna Tunggal",
    detail:
      "Tidak ada tabel pengguna dan tidak ada pendaftaran. Identitas adalah JWT HS256 bertanda tangan di cookie HttpOnly, diverifikasi di Edge middleware sebelum render.",
    stack: [
      "jose — SignJWT / jwtVerify HS256",
      "Cookie HttpOnly · Secure · SameSite=Lax",
      "middleware.ts melindungi 7 rute privat",
      "Perbandingan kredensial constant-time",
    ],
    Icon: ShieldCheck,
  },
  {
    code: "L3",
    title: "Data — Supabase PostgreSQL",
    detail:
      "Empat tabel, lima trigger, RLS aktif, dan publikasi Realtime. Saldo dompet adalah nilai turunan yang dijaga database, bukan angka yang bisa diketik manual.",
    stack: [
      "4 tabel + Row Level Security",
      "Trigger sinkronisasi saldo otomatis",
      "Realtime postgres_changes di semua tabel",
      "Migrasi SQL idempoten via Supabase CLI",
    ],
    Icon: Database,
  },
  {
    code: "L4",
    title: "Dompet & Brankas",
    detail:
      "Maksimal lima kantong agar struktur tetap terbaca. Transfer antar dompet dicatat sebagai satu baris buku besar dengan efek ganda yang presisi.",
    stack: [
      "Batas 5 dompet dipaksakan trigger",
      "Progres target per dompet",
      "Transfer dua arah dalam satu baris",
      "Rekalkulasi saldo dari buku besar",
    ],
    Icon: WalletIcon,
  },
  {
    code: "L5",
    title: "Kanban & Karantina 48 Jam",
    detail:
      "Keinginan belanja non-esensial wajib menunggu 48 jam penuh. Penguncian bukan sekadar UI: trigger database menolak penyelesaian yang terlalu cepat.",
    stack: [
      "4 kolom dengan drag-and-drop",
      "Hitungan mundur langsung per kartu",
      "Animasi layout Framer Motion",
      "Penguncian ganda UI + database",
    ],
    Icon: KanbanSquare,
  },
  {
    code: "L6",
    title: "Laporan & Portabilitas",
    detail:
      "Rollup harian, mingguan, bulanan, dan tahunan dihitung dari fungsi yang sama dengan dashboard. Impor dan ekspor CSV membuat data Anda tetap bisa dibawa pergi.",
    stack: [
      "Rollup 4 tingkat otomatis",
      "Parser CSV RFC-4180 tanpa dependensi",
      "Ekspor round-trip (nama dompet)",
      "Timeline sejak 13 Nov 2026",
    ],
    Icon: FileSpreadsheet,
  },
] as const;

const DB_GUARANTEES = [
  {
    fn: "enforce_max_5_wallets()",
    trigger: "BEFORE INSERT",
    detail:
      "Menolak dompet keenam dengan exception, sehingga batas 5 slot tidak bisa dilewati walau lewat SQL langsung atau insert bersamaan.",
  },
  {
    fn: "sync_wallet_balances()",
    trigger: "AFTER INSERT / UPDATE / DELETE",
    detail:
      "Menambah, mengurangi, dan membalik efek setiap transaksi pada saldo dompet. Edit transaksi membalik baris lama lalu menerapkan baris baru, sehingga hasilnya selalu eksak.",
  },
  {
    fn: "enforce_wishlist_quarantine()",
    trigger: "BEFORE INSERT / UPDATE",
    detail:
      "Menolak kartu Wishlist 48H yang dipindahkan ke kolom Done sebelum 48 jam penuh terlewati.",
  },
  {
    fn: "derive_transaction_calendar()",
    trigger: "BEFORE INSERT / UPDATE",
    detail:
      "Mengisi hari, minggu ke-, dan bulan dalam bahasa Indonesia dari kolom tanggal, serta mengosongkan field yang tidak relevan dengan jenis transaksi.",
  },
] as const;

/**
 * Explicitly typed so the optional `command` exists on every element.
 * With a bare `as const`, TypeScript narrows each entry individually and the
 * steps that have no command lack the property entirely, which makes
 * `step.command` an error on the union.
 */
interface SetupStep {
  title: string;
  detail: string;
  command?: string;
}

const SETUP_STEPS: readonly SetupStep[] = [
  {
    title: "Clone repositori dan pasang dependensi",
    detail: "Butuh Node.js 18.18 atau lebih baru.",
    command: "git clone <repo-url> personal-finance-os\ncd personal-finance-os\nnpm install",
  },
  {
    title: "Buat proyek Supabase",
    detail:
      "Buat proyek baru di supabase.com, lalu catat Project URL, anon key, dan service role key dari Settings → API.",
  },
  {
    title: "Isi environment variables",
    detail:
      "Salin template lalu lengkapi setiap nilai. Buat AUTH_SECRET minimal 32 karakter.",
    command: "cp .env.example .env.local\nopenssl rand -base64 48   # untuk AUTH_SECRET",
  },
  {
    title: "Push migrasi database",
    detail:
      "Migrasi membuat 4 tabel, 5 trigger, kebijakan RLS, publikasi Realtime, dan 5 dompet bawaan beserta baseline 13 November 2026.",
    command: "npx supabase link --project-ref <project-ref>\nnpx supabase db push",
  },
  {
    title: "Jalankan secara lokal",
    detail: "Buka http://localhost:3000 lalu masuk dengan kredensial dari .env.local.",
    command: "npm run dev",
  },
  {
    title: "Deploy ke Vercel",
    detail:
      "Import repositori ke Vercel, tempelkan environment variable yang sama, lalu deploy. Tidak ada konfigurasi build tambahan yang diperlukan.",
    command: "vercel --prod",
  },
];

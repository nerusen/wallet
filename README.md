# Personal Finance OS

A self-hosted **Personal Finance & Career Command Center**. One screen to record every
Rupiah, cap impulse spending, split salary automatically, and keep a daily discipline
streak — running entirely on infrastructure you own.

Built with **Next.js (App Router, TypeScript strict)**, **Supabase (PostgreSQL +
Realtime)**, **Tailwind CSS**, **Recharts**, and **Framer Motion**, in an
architectural-brutalist UI: exposed 1px grid lines, sharp geometry, flat monochrome
surfaces with a single `#51CD85` accent, and zero gradients or glow effects.

**License:** MIT — fork it, change it, ship it.

---

## Table of contents

- [Why this exists](#why-this-exists)
- [Features](#features)
- [Architecture](#architecture)
- [Database schema](#database-schema)
- [Self-hosting setup](#self-hosting-setup)
- [Environment variables](#environment-variables)
- [Security model](#security-model)
- [Financial rules](#financial-rules)
- [CSV import / export](#csv-import--export)
- [Design system](#design-system)
- [Project structure](#project-structure)
- [Scripts](#scripts)
- [Customisation](#customisation)

---

## Why this exists

Most budgeting apps are multi-tenant SaaS: your ledger lives on someone else's server,
behind someone else's pricing page. This is the opposite — a single-user deployment,
one person per instance, with the database credentials in your own `.env`.

The design premise is that **the database, not the UI, is the authority on correctness**.
Wallet balances are never typed in; they are derived from the transaction ledger by a
PostgreSQL trigger. The 5-wallet cap and the 48-hour purchase quarantine are enforced by
triggers too, so they cannot be bypassed by a bug in the interface, a direct SQL query,
or two concurrent requests.

---

## Features

| Route | Module | What it does |
|---|---|---|
| `/` | Public docs | Landing page, architecture overview, self-hosting guide, MIT notice |
| `/login` | Auth | Single-user login. No sign-up page exists |
| `/dashboard` | Overview | 4 KPI cells, mountain-ridge cash-flow chart, daily + weekly summaries, wallet strip |
| `/pemasukan` | Income | Salary tab with 1-click 35/25/20/15/5 splitter; freelance tab with 30-day freeze tracker and 70:30 unlock calculator |
| `/pengeluaran` | Expenses | Entry form with live weekly-budget projection, cigarette quota guard, searchable ledger with daily/weekly/monthly subtotals |
| `/kanban` | Board | 4 columns, drag-and-drop + button moves, live 48-hour quarantine countdown per wishlist card |
| `/dompet` | Wallets | Up to 5 wallets, add/edit/delete, transfer between pockets with live balance preview |
| `/laporan` | Reports | Full ledger plus automatic daily/weekly/monthly/yearly rollups, CSV import and export |
| `/aturan` | SOP | Daily 21:00 WIB audit check-in, Monday 08:00 WIB split check-in, discipline streak counter, 14-day strip |

Cross-cutting:

- **Quick-log palette** — `Ctrl/Cmd + K` from any private page; routes to the correct
  transaction type without navigating away.
- **Realtime** — a single Supabase `postgres_changes` subscription refreshes the current
  route's server data on any change. Debounced, so a transfer (1 transaction insert +
  2 wallet updates) triggers exactly one refresh.
- **Light / Dark / System** theme switcher in both the public navbar and the app topbar.
- **Mobile-first** — collapsible drawer sidebar, horizontally scrollable tables, and
  touch-and-hold crosshair on the chart.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser                                                    │
│  ├─ Server Components  → read data, compute aggregates      │
│  ├─ Client Components  → interaction only                   │
│  └─ anon key           → Realtime subscription (read-only)  │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  middleware.ts (Edge)                                       │
│  └─ jose jwtVerify on the HttpOnly session cookie           │
│     → 7 private routes blocked when unauthenticated         │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Server Actions (Node)                                      │
│  ├─ requireSession()   → defence in depth                   │
│  └─ service_role key   → all writes, bypasses RLS           │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Supabase PostgreSQL                                        │
│  ├─ 4 tables + RLS + Realtime publication                   │
│  └─ 5 triggers → the authority on every invariant           │
└─────────────────────────────────────────────────────────────┘
```

Data flow for a write:

1. Client submits a `FormData` to a Server Action.
2. The action calls `requireSession()`, validates input, and inserts a ledger row.
3. The `sync_wallet_balances()` trigger adjusts the affected wallet balances.
4. Realtime emits `postgres_changes`; the browser calls `router.refresh()`.
5. Server Components re-run and React reconciles the new numbers in place.

No balance is ever computed in two places. Every aggregate on every page comes from
`src/lib/finance.ts`.

---

## Database schema

Four tables, defined in `supabase/migrations/*_init_personal_finance_os.sql`.
The migration is **idempotent** — re-applying it is safe.

### `wallets`
Pockets / vaults. Hard-capped at 5 rows.

`balance` is **derived state**. It is maintained exclusively by
`sync_wallet_balances()` and is not writable through the UI.

### `transactions`
The ledger. `tx_type` is one of `income_salary`, `income_freelance`, `expense`,
`transfer`. Indonesian calendar columns (`hari`, `minggu_ke`, `bulan`) are auto-derived
from `tanggal`.

### `kanban_tasks`
Freelance pipeline, career tasks, and the 48-hour wishlist quarantine.
`unlock_at` is set to `now() + interval '48 hours'` for `wishlist_48h` cards.

### `daily_audits`
One row per day, `audit_date` UNIQUE. Backs the evening audit, the Monday split, and the
streak counter.

### Triggers

| Function | Timing | Guarantee |
|---|---|---|
| `enforce_max_5_wallets()` | `BEFORE INSERT ON wallets` | Raises an exception once 5 wallets exist |
| `sync_wallet_balances()` | `AFTER INSERT/UPDATE/DELETE ON transactions` | Balances always equal the exact ledger sum |
| `derive_transaction_calendar()` | `BEFORE INSERT/UPDATE ON transactions` | Fills `hari`/`minggu_ke`/`bulan`, nulls inapplicable fields |
| `prepare_kanban_task()` | `BEFORE INSERT/UPDATE ON kanban_tasks` | Arms the 48h clock, auto-appends `position` |
| `enforce_wishlist_quarantine()` | `BEFORE INSERT/UPDATE ON kanban_tasks` | Blocks `done` before `unlock_at` |

`sync_wallet_balances()` handles `UPDATE` as *reverse the OLD row, then apply the NEW
row*, which keeps edits exact even when `tx_type`, `nominal`, or either wallet changes.

### Seed data

Wallet balances are seeded at `0` and the opening baseline ledger for **2026-11-13** is
inserted, so the triggers produce the intended balances:

```
Saldo awal kas            Rp 550.000  in
  → Dana Darurat          Rp 450.000
  → Operasional Harian    Rp 100.000
Pelunasan DANA PayLater   Rp 130.000  out (from Dana Darurat)
─────────────────────────────────────────
Dana Darurat    450.000 − 130.000 = Rp 320.000  ✓
Operasional Harian                = Rp 100.000  ✓
Total kas bersih                  = Rp 420.000
```

Writing `320000` directly *and* inserting the baseline rows would double-count. The
migration ends with a `DO` block that asserts these figures and fails loudly if the
trigger arithmetic is ever wrong.

---

## Self-hosting setup

Requires **Node.js 18.18+**.

### 1. Clone and install

```bash
git clone <repo-url> personal-finance-os
cd personal-finance-os
npm install
```

### 2. Create a Supabase project

Create a project at [supabase.com](https://supabase.com), then copy the **Project URL**,
**anon key**, and **service role key** from *Settings → API*.

### 3. Configure environment

```bash
cp .env.example .env.local
openssl rand -base64 48   # paste as AUTH_SECRET
```

Fill in every value in `.env.local`.

### 4. Push the migration

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

This creates the 4 tables, 5 triggers, RLS policies, the Realtime publication, the 5
default wallets, and the 13 November 2026 baseline.

> The migration file is committed but **never auto-applied**. Review it before pushing.

### 5. Run locally

```bash
npm run dev
```

Open <http://localhost:3000> and log in with the credentials from `.env.local`.

### 6. Deploy to Vercel

Import the repository, paste the same environment variables into
*Settings → Environment Variables*, and deploy. No extra build configuration is needed.

---

## Environment variables

| Variable | Scope | Purpose |
|---|---|---|
| `ADMIN_USERNAME` | server | The only username that can log in |
| `ADMIN_PASSWORD` | server | Its password. Compared in constant time |
| `AUTH_SECRET` | server | HS256 signing key. **32+ characters** |
| `AUTH_SESSION_MAX_AGE` | server | Optional. Session lifetime in seconds (default 604800) |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Anon key, used for Realtime only |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Used by Server Actions. Never prefix with `NEXT_PUBLIC_` |

---

## Security model

**Threat model: a single-user, self-hosted deployment.** Identity is established by the
Next.js middleware, not by Supabase Auth.

- There is **no sign-up page** and no user table. Public registration is impossible by
  construction, not by a feature flag.
- The session is a `jose` HS256 JWT in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie,
  verified on the Edge by `middleware.ts` before any private route renders.
- `requireSession()` runs again inside every Server Action — middleware protects
  *navigation*, but an action must never assume it was reached through one.
- Credential comparison is constant-time and both halves always execute, so response
  timing does not reveal which half was wrong.
- Login failures return a single generic message.

### A note on RLS and Realtime

RLS is enabled **and forced** on all four tables. Writes go through `service_role`,
which bypasses RLS; the explicit `*_service_role_all` policies document and pin that.

Reads additionally allow `anon`, because Supabase Realtime evaluates `postgres_changes`
against the *subscriber's* role and the browser subscribes with the publicly-shipped
anon key.

> **This is a deliberate trade-off.** The `*_anon_select_realtime` policies make your
> ledger readable by anyone holding the anon key. That is acceptable for a personal
> instance where live updates matter. If you would rather keep the data fully private,
> **drop those four policies** — the app degrades gracefully to server-rendered
> revalidation and simply stops live-updating.

---

## Financial rules

All defaults live in **`src/lib/constants.ts`**. Change them there; nothing is
hard-coded in a component.

| Rule | Default |
|---|---|
| Weekly operational cap | `Rp 67.500` (→ `Rp 9.643`/day) |
| Emergency fund target | `Rp 3.000.000` |
| Salary preset | `Rp 450.000` |
| Salary split | 35% Darurat · 25% Produktif · 20% Investasi · 15% Operasional · 5% Pengembangan Diri |
| Freelance unlock split | 70% Tabungan/Investasi : 30% Self-Reward |
| Freelance freeze | Until the 1st of the following month |
| Cigarette quota | 1 pack / 3 days, max `Rp 12.000`/pack |
| Wishlist quarantine | 48 hours |
| Max wallets | 5 |

### Rounding contract

Percentage splits never create or destroy money. Slices `1..n-1` are rounded
individually and the **final slice absorbs the remainder**, so
`sum(slices) === round(total)` always holds. Verify with:

```ts
import { splitSalary, splitFreelance } from "@/lib/finance";

splitSalary(450_000).reduce((a, s) => a + s.amount, 0);  // → exactly 450000
const f = splitFreelance(750_000);
f.tabunganInvestasi + f.selfReward;                      // → exactly 750000
```

Weekly windows are **ISO weeks** (Monday → Sunday). All dates are resolved in
`Asia/Jakarta` (WIB) regardless of server timezone, and parsed at UTC noon to avoid
DST/offset drift.

---

## CSV import / export

The parser in `src/lib/csv.ts` is hand-written and dependency-free, handling RFC-4180
quoting, embedded commas and newlines, CRLF, and the UTF-8 BOM that Excel writes.

**Canonical header** (what the exporter writes and the importer accepts verbatim):

```csv
tanggal,tx_type,kategori,barang_keperluan,nominal,dompet,dompet_tujuan,is_frozen_freelance,catatan
2026-11-16,income_salary,Gaji Utama,Gaji minggu ke-3,450000,Operasional Harian,,false,
2026-11-17,expense,Konsumsi & Jajan,Makan siang,12000,Operasional Harian,,false,
2026-11-18,transfer,Transfer Antar Dompet,Top-up investasi,50000,Operasional Harian,Investasi Pemula,false,
2026-11-20,income_freelance,Proyek Desain,Desain logo UMKM,750000,Kantong Freelance,,true,Klien: Toko Melati
```

Importer behaviour:

- Wallets may be referenced by **name or UUID**, so export → import round-trips cleanly.
- `tanggal` accepts `YYYY-MM-DD`, `DD/MM/YYYY`, `DD-MM-YYYY`, and `YYYY/MM/DD`.
- `tx_type` accepts the canonical values *or* loose Indonesian labels
  (`gaji`, `pengeluaran`, `proyek`, `transfer`, …).
- `hari`, `minggu_ke`, and `bulan` are derived when absent.
- Column names are matched case-, space-, and underscore-insensitively.
- Rows are inserted in chunks of 250, so one bad row cannot abort the file. The result
  report names every skipped row with its reason.
- Balances are fully recomputed after the import as insurance against a partially-failed
  chunk.

A sample file ships at `public/contoh_data_keuangan_nelsen_2026_2027.csv`.

---

## Design system

Synthesized strictly from three references: **getartcraft.com** (exposed 1px grid,
1280px page frame, micro mono labels), **chaingpt.org** (corner registration marks,
numbered eyebrows, flat accent CTA beside monochrome siblings), and **opencode.ai**
(`border-top: 1px solid var(--border)` hairline rows, outline grid via
`border-inline-start` + per-cell borders at `gap: 0`, forced `border-radius: 0`,
mono eyebrow at `.08em` uppercase, 14.75rem sidebar, 3.5rem topbar).

### Tokens

| Token | Light | Dark |
|---|---|---|
| Canvas | `#FFFFFF` | `#09090B` |
| Surface | `#F8F9FA` | `#111113` |
| Primary text | `#09090B` | `#FAFAFA` |
| Muted text | `#52525B` | `#A1A1AA` |
| Grid border (1px) | `#E4E4E7` | `#27272A` |
| Accent | `#51CD85` (identical in both) | |
| Warning | `#EAB308` | |
| Error | `#EF4444` | |

### Hard prohibitions

Not used anywhere in the codebase:

- `linear-gradient`, `radial-gradient`, `conic-gradient`
- `box-shadow` / `drop-shadow` as a glow
- `backdrop-filter` blur / glassmorphism
- `rounded-xl`, `rounded-2xl`, `rounded-3xl`

Elevation is expressed **only** by a 1px hairline border plus a one-step surface colour
change. `tailwind.config.ts` collapses `rounded-lg`/`xl`/`2xl`/`3xl` to `0px`, and
`globals.css` resets `border-radius: 0` on `*`, so a stray rounded utility is a no-op.

Recharts fills are explicit flat colours at `fillOpacity={0.12}` — Recharts' default
area fill is a `<defs> linearGradient`, which is why every `<Area>` sets `fill`
directly.

### Adjacent button rule

`variant="accent"` is the **only** variant that fills with `#51CD85`. Every other
variant is monochrome. Any button pair therefore uses at most one accent fill:

```tsx
<Button variant="outline" size="sm">Batal</Button>
<MotionButton variant="accent" size="sm">Simpan</MotionButton>
```

Destructive pairs use `danger-solid`, which is `#EF4444` — a semantic status colour, not
the brand accent, so the rule still holds.

### Typography

Two families only:

1. **Display / UI** — `Google Sans`, requested by `<link>` in the root layout, with
   `Plus Jakarta Sans` loaded via `next/font/google` as the self-hosted,
   zero-layout-shift fallback. (Google Sans is not served by the public Fonts CSS API,
   so the fallback is what most visitors will actually see.)
2. **Technical mono** — `JetBrains Mono` via `next/font/google`, used for every Rupiah
   value, date, percentage, eyebrow tag, table cell, and badge, always with
   `tabular-nums` so digits never shift width.

### Motion

- Page mount: `opacity 0→1`, `y 12→0`, `duration 0.35`, `ease [0.22, 1, 0.36, 1]`
- Scroll reveal: `whileInView`, `viewport={{ once: true, amount: 0.15 }}`
- Tactile press: `whileTap={{ scale: 0.985 }}`
- `prefers-reduced-motion: reduce` neutralises all of it globally

### The mountain chart

`src/components/dashboard/mountain-chart.tsx` renders three flat-filled areas (salary
`#51CD85`, freelance monochrome, expense `#EF4444`) with a `Harian | Mingguan | Bulanan`
toggle and a sharp/smooth curve toggle.

Recharts has no touch-hold mode, so the component translates `touchstart`/`touchmove`
coordinates into a bucket index and renders the same brutalist popover pinned to the
touch point, suppressing the native tooltip while a touch is active.
`touch-action: pan-y` keeps vertical page scrolling intact while horizontal sweeps read
the crosshair.

---

## Project structure

```
src/
├── app/
│   ├── (private)/            # authenticated route group
│   │   ├── layout.tsx        # requireSession + AppShell
│   │   ├── dashboard/        ├── pemasukan/    ├── pengeluaran/
│   │   ├── kanban/           ├── dompet/       ├── laporan/
│   │   └── aturan/
│   ├── actions/              # Server Actions
│   │   ├── auth.ts  transactions.ts  wallets.ts  kanban.ts
│   │   ├── audits.ts  csv.ts
│   ├── login/                # public login
│   ├── page.tsx              # public landing + docs
│   ├── layout.tsx  globals.css
├── components/
│   ├── shell/                # sidebar, topbar, quick-log, page-header
│   ├── ui/                   # button, input, panel, dialog, tabs, motion
│   ├── dashboard/  income/  expenses/  kanban/  wallets/  reports/  rules/
│   ├── public/               # public navbar
│   └── theme-provider.tsx  theme-switcher.tsx
├── hooks/                    # use-realtime-refresh, use-now, use-hotkey
├── lib/
│   ├── auth/                 # session (Edge-safe), guard (server-only)
│   ├── supabase/             # server (service role), client (anon), queries
│   ├── types/database.ts
│   ├── constants.ts          # ← all financial rules
│   ├── finance.ts            # ← all derived numbers
│   ├── format.ts             # Rupiah + Indonesian calendar
│   ├── csv.ts  env.ts  fonts.ts  utils.ts
└── middleware.ts
supabase/migrations/
```

---

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:new <name>` | New Supabase migration |
| `npm run db:push` | Apply migrations |
| `npm run db:types` | Regenerate `src/lib/types/database.ts` |

TypeScript runs with `strict: true`, `noUncheckedIndexedAccess`,
`noImplicitOverride`, and `noFallthroughCasesInSwitch`. There are no `any` types and no
`ignoreBuildErrors` escape hatch.

---

## Customisation

**Change the financial rules** — edit `src/lib/constants.ts`. Ratios, caps, categories,
and the SOP text all live there.

**Change the accent colour** — edit the `--accent` triplet in both `:root` and `.dark`
in `src/app/globals.css`. It is referenced as `rgb(var(--accent))` everywhere, including
the chart.

**Change the wallet cap** — edit `enforce_max_5_wallets()` in a *new* migration (never
edit an applied one) and update `MAX_WALLETS` in `src/app/actions/wallets.ts` plus
`MAX_WALLETS_DOC` in `src/lib/constants.ts`.

**Change the locale** — `src/lib/format.ts` is the single boundary for currency and
calendar formatting. The SQL helpers `id_hari()`, `id_bulan()`, and `id_minggu_ke()`
mirror it on the database side; change both together.

**Make the data fully private** — drop the four `*_anon_select_realtime` RLS policies.
Live updates stop; everything else keeps working.

---

## License

MIT. See [`LICENSE`](./LICENSE).

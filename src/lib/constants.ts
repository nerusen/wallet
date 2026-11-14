/**
 * Financial rule constants — the "SOP" of this system, in one file.
 * Every page reads these; nothing hard-codes a number inline.
 */

/** Baseline: the day this system started tracking. */
export const SYSTEM_START_DATE = "2026-11-13";

/** Planning horizon shown by default in /laporan. */
export const SYSTEM_HORIZON_DATE = "2027-06-30";

/** Weekly operational spending cap. */
export const WEEKLY_BUDGET_CAP = 67_500;

/** Daily allowance derived from the weekly cap (7-day week). */
export const DAILY_ALLOWANCE = WEEKLY_BUDGET_CAP / 7; // 9.642,857…

/** Default salary preset for the Monday 08:00 WIB split. */
export const DEFAULT_SALARY_PRESET = 450_000;

/** Emergency-fund goal. */
export const EMERGENCY_FUND_TARGET = 3_000_000;

/** Cigarette discipline: one pack per 3 days, max Rp12.000 per pack. */
export const CIGARETTE_CATEGORY = "Rokok (Max 12rb/3hr)";
export const CIGARETTE_MAX_PRICE = 12_000;
export const CIGARETTE_MIN_DAYS_BETWEEN = 3;

/** Audit clock, WIB. */
export const EVENING_AUDIT_HOUR = 21;
export const MONDAY_SPLIT_HOUR = 8;

/** Wishlist quarantine window. */
export const QUARANTINE_HOURS = 48;

/**
 * Maximum wallets. The authoritative enforcement lives in the
 * `enforce_max_5_wallets()` database trigger; this constant is the shared
 * client/server copy used for counters, disabled states, and the docs page.
 */
export const MAX_WALLETS = 5;

/** Canonical CSV header. The exporter writes it; the importer accepts it verbatim. */
export const CSV_HEADERS = [
  "tanggal",
  "hari",
  "minggu_ke",
  "bulan",
  "tx_type",
  "kategori",
  "barang_keperluan",
  "nominal",
  "dompet",
  "dompet_tujuan",
  "is_frozen_freelance",
  "catatan",
] as const;

/** Result of a CSV batch import. */
export interface ImportReport {
  total: number;
  inserted: number;
  skipped: number;
  /** Row-level problems, capped so the UI stays readable. */
  issues: string[];
}

/** Freelance freeze: income unlocks on the 1st of the following month. */
export const FREELANCE_FREEZE_DAYS = 30;

/* ── Expense categories ───────────────────────────────────────────────────── */

export const EXPENSE_CATEGORIES = [
  CIGARETTE_CATEGORY,
  "Kuota & Internet",
  "Transportasi & Bensin",
  "Belanja Barang",
  "Pelunasan Utang",
  "Konsumsi & Jajan",
  "Biaya Kerja / Lain-Lain",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const INCOME_SALARY_CATEGORIES = [
  "Gaji Utama",
  "Part-Time",
  "Bonus & Lembur",
  "Saldo Awal",
] as const;

export const INCOME_FREELANCE_CATEGORIES = [
  "Proyek Desain",
  "Proyek Website",
  "Proyek Konten",
  "Retainer Klien",
  "Lain-Lain Freelance",
] as const;

/* ── Monday 08:00 salary split: 35 / 25 / 20 / 15 / 5 ─────────────────────── */

export interface SplitRule {
  readonly key: string;
  readonly label: string;
  readonly ratio: number;
  /** Wallet category this slice lands in, or `null` for the self-development
   *  slice which has no dedicated wallet in the 5-slot model. */
  readonly walletCategory:
    | "darurat"
    | "produktif"
    | "investasi"
    | "operasional"
    | null;
  readonly note: string;
}

export const SALARY_SPLIT_RULES: readonly SplitRule[] = [
  {
    key: "darurat",
    label: "Dana Darurat",
    ratio: 0.35,
    walletCategory: "darurat",
    note: "Prioritas pertama sampai Rp3.000.000 tercapai.",
  },
  {
    key: "produktif",
    label: "Tabungan Produktif",
    ratio: 0.25,
    walletCategory: "produktif",
    note: "Modal alat kerja & peningkatan kapasitas.",
  },
  {
    key: "investasi",
    label: "Investasi Pemula",
    ratio: 0.2,
    walletCategory: "investasi",
    note: "Reksa dana / emas mikro, disetor rutin.",
  },
  {
    key: "operasional",
    label: "Operasional Harian",
    ratio: 0.15,
    walletCategory: "operasional",
    note: "Biaya hidup mingguan, dibatasi Rp67.500/minggu.",
  },
  {
    key: "pengembangan",
    label: "Pengembangan Diri",
    ratio: 0.05,
    walletCategory: null,
    note: "Kursus, buku, lisensi. Dicatat sebagai alokasi di Operasional.",
  },
] as const;

/** Freelance unlock split: 70% savings/investment, 30% self-reward. */
export const FREELANCE_SPLIT_RULES = [
  {
    key: "tabungan_investasi",
    label: "Tabungan & Investasi",
    ratio: 0.7,
    note: "Dipecah rata ke Tabungan Produktif dan Investasi Pemula.",
  },
  {
    key: "self_reward",
    label: "Self-Reward",
    ratio: 0.3,
    note: "Boleh dipakai bebas setelah tanggal 1 bulan berikutnya.",
  },
] as const;

/* ── Kanban columns ───────────────────────────────────────────────────────── */

export const KANBAN_COLUMNS = [
  { status: "backlog", label: "Backlog / Wishlist 48H", code: "01" },
  { status: "in_progress", label: "In Progress", code: "02" },
  { status: "review", label: "Review / Waiting", code: "03" },
  { status: "done", label: "Done / Lunas", code: "04" },
] as const;

/* ── Core rules, rendered on /aturan ──────────────────────────────────────── */

export interface CoreRule {
  readonly code: string;
  readonly title: string;
  readonly detail: string;
}

export const CORE_RULES: readonly CoreRule[] = [
  {
    code: "R01",
    title: "Audit malam 21:00 WIB",
    detail:
      "Setiap hari pukul 21:00 WIB, catat seluruh pengeluaran hari itu dan tandai audit selesai. Streak tidak boleh putus.",
  },
  {
    code: "R02",
    title: "Pecah gaji Senin 08:00 WIB",
    detail:
      "Gaji masuk langsung dipecah 35% Darurat, 25% Produktif, 20% Investasi, 15% Operasional, 5% Pengembangan Diri. Tanpa penundaan.",
  },
  {
    code: "R03",
    title: "Batas operasional Rp67.500 / minggu",
    detail:
      "Total pengeluaran harian dalam satu minggu ISO (Senin–Minggu) tidak boleh melewati Rp67.500. Setara Rp9.643 per hari.",
  },
  {
    code: "R04",
    title: "Rokok maksimal 1 bungkus / 3 hari",
    detail:
      "Harga maksimal Rp12.000 per bungkus. Jika jarak dari pembelian terakhir kurang dari 3 hari, sistem memberi peringatan.",
  },
  {
    code: "R05",
    title: "Karantina wishlist 48 jam",
    detail:
      "Setiap keinginan belanja non-esensial masuk Kanban sebagai Wishlist 48H. Tidak boleh dibeli sebelum 48 jam penuh terlewati.",
  },
  {
    code: "R06",
    title: "Freelance dibekukan 30 hari",
    detail:
      "Pemasukan freelance dibekukan sampai tanggal 1 bulan berikutnya, lalu dipecah 70% Tabungan/Investasi : 30% Self-Reward.",
  },
  {
    code: "R07",
    title: "Dana Darurat adalah prioritas mutlak",
    detail:
      "Sebelum Dana Darurat mencapai Rp3.000.000, tidak ada pembelian konsumtif di luar Operasional Harian.",
  },
  {
    code: "R08",
    title: "Maksimal 5 dompet",
    detail:
      "Struktur keuangan dijaga tetap sederhana. Batas 5 dompet dipaksakan di level database, bukan hanya di antarmuka.",
  },
] as const;

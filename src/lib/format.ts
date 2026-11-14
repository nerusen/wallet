/**
 * Indonesian currency + calendar formatting.
 *
 * Every monetary string in this app goes through here, so the Rupiah format
 * (`Rp 1.800.000`) is defined in exactly one place.
 */

const WIB_TIME_ZONE = "Asia/Jakarta";

export const HARI_ID = [
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
  "Minggu",
] as const;

export const BULAN_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

export const BULAN_ID_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
] as const;

/* ── Currency ─────────────────────────────────────────────────────────────── */

const rupiahFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const plainFormatter = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * `1800000` → `"Rp 1.800.000"`.
 * A single non-breaking-free space follows `Rp` for legibility in tabular-nums.
 */
export function formatRupiah(value: number | null | undefined): string {
  const amount = Number.isFinite(value) ? Number(value) : 0;
  // Intl renders "Rp1.800.000"; insert the space the spec asks for.
  return rupiahFormatter.format(Math.round(amount)).replace(/^Rp\s?/, "Rp ");
}

/** `1800000` → `"1.800.000"` (no symbol; for table cells with a header unit). */
export function formatNumber(value: number | null | undefined): string {
  const amount = Number.isFinite(value) ? Number(value) : 0;
  return plainFormatter.format(Math.round(amount));
}

/** Signed variant for deltas: `"+Rp 50.000"` / `"−Rp 50.000"`. */
export function formatRupiahSigned(value: number | null | undefined): string {
  const amount = Number.isFinite(value) ? Number(value) : 0;
  const rounded = Math.round(amount);
  if (rounded === 0) return formatRupiah(0);
  const sign = rounded > 0 ? "+" : "−";
  return `${sign}${formatRupiah(Math.abs(rounded))}`;
}

/** Compact axis label: `450000` → `"450rb"`, `1800000` → `"1,8jt"`. */
export function formatRupiahCompact(value: number | null | undefined): string {
  const amount = Math.round(Number.isFinite(value) ? Number(value) : 0);
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "−" : "";

  if (abs >= 1_000_000_000) {
    return `${sign}${trimZero(abs / 1_000_000_000)}M`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${trimZero(abs / 1_000_000)}jt`;
  }
  if (abs >= 1_000) {
    return `${sign}${trimZero(abs / 1_000)}rb`;
  }
  return `${sign}${abs}`;
}

function trimZero(n: number): string {
  const fixed = n >= 10 ? n.toFixed(0) : n.toFixed(1);
  return fixed.replace(/\.0$/, "").replace(".", ",");
}

/** `0.1234` → `"12,3%"`. Pass a ratio, not a percentage. */
export function formatPercent(ratio: number | null | undefined, digits = 1): string {
  const value = Number.isFinite(ratio) ? Number(ratio) : 0;
  return `${(value * 100).toFixed(digits).replace(".", ",")}%`;
}

export function formatPercentSigned(ratio: number | null | undefined, digits = 1): string {
  const value = Number.isFinite(ratio) ? Number(ratio) : 0;
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${(Math.abs(value) * 100).toFixed(digits).replace(".", ",")}%`;
}

/**
 * Parse human input into a number of Rupiah.
 * Accepts `"1.800.000"`, `"1800000"`, `"Rp 1.800.000"`, `"1800000,50"`.
 */
export function parseRupiahInput(input: string): number {
  if (typeof input !== "string") return 0;
  const cleaned = input
    .replace(/rp/gi, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

/* ── Dates ────────────────────────────────────────────────────────────────── */

/** Today's date in WIB as `'YYYY-MM-DD'`, independent of server timezone. */
export function todayWIB(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: WIB_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts; // en-CA yields YYYY-MM-DD
}

/** Current wall-clock time in WIB as `'HH:mm'`. */
export function timeWIB(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: WIB_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
}

/** Parse `'YYYY-MM-DD'` into a UTC-noon Date — immune to DST/offset drift. */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map((part) => Number.parseInt(part, 10));
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12, 0, 0));
}

export function toISODate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** ISO day-of-week: Monday = 1 … Sunday = 7. */
export function isoDayOfWeek(iso: string): number {
  const day = parseISODate(iso).getUTCDay(); // 0 = Sunday
  return day === 0 ? 7 : day;
}

/** Indonesian weekday label — mirrors the SQL `id_hari()` function. */
export function hariIndonesia(iso: string): string {
  return HARI_ID[isoDayOfWeek(iso) - 1] ?? "Senin";
}

/** Indonesian month label — mirrors the SQL `id_bulan()` function. */
export function bulanIndonesia(iso: string): string {
  const monthIndex = parseISODate(iso).getUTCMonth();
  return BULAN_ID[monthIndex] ?? "Januari";
}

/** Week-of-month ordinal 1..5 — mirrors the SQL `id_minggu_ke()` function. */
export function mingguKe(iso: string): number {
  const day = parseISODate(iso).getUTCDate();
  return Math.floor((day - 1) / 7) + 1;
}

/** `'2026-11-13'` → `"13 Nov 2026"`. */
export function formatDateShort(iso: string): string {
  const date = parseISODate(iso);
  const month = BULAN_ID_SHORT[date.getUTCMonth()] ?? "";
  return `${date.getUTCDate()} ${month} ${date.getUTCFullYear()}`;
}

/** `'2026-11-13'` → `"Jumat, 13 November 2026"`. */
export function formatDateLong(iso: string): string {
  const date = parseISODate(iso);
  const month = BULAN_ID[date.getUTCMonth()] ?? "";
  return `${hariIndonesia(iso)}, ${date.getUTCDate()} ${month} ${date.getUTCFullYear()}`;
}

/** `'2026-11'` → `"November 2026"`. */
export function formatMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split("-").map((part) => Number.parseInt(part, 10));
  const month = BULAN_ID[(m ?? 1) - 1] ?? "";
  return `${month} ${y ?? ""}`.trim();
}

export function monthKeyOf(iso: string): string {
  return iso.slice(0, 7);
}

/** ISO-week key such as `'2026-W46'`. Weeks start on Monday. */
export function weekKeyOf(iso: string): string {
  const date = parseISODate(iso);
  const target = new Date(date.getTime());
  const dayNumber = isoDayOfWeek(iso);
  target.setUTCDate(target.getUTCDate() - dayNumber + 4); // Thursday of this ISO week
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1, 12, 0, 0));
  const week = Math.ceil(
    ((target.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Monday (inclusive) of the ISO week containing `iso`. */
export function startOfWeek(iso: string): string {
  const date = parseISODate(iso);
  date.setUTCDate(date.getUTCDate() - (isoDayOfWeek(iso) - 1));
  return toISODate(date);
}

/** Sunday (inclusive) of the ISO week containing `iso`. */
export function endOfWeek(iso: string): string {
  const date = parseISODate(startOfWeek(iso));
  date.setUTCDate(date.getUTCDate() + 6);
  return toISODate(date);
}

export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function endOfMonth(iso: string): string {
  const date = parseISODate(iso);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12));
  return toISODate(last);
}

/** First day of the following month — the freelance-freeze unlock date. */
export function firstOfNextMonth(iso: string): string {
  const date = parseISODate(iso);
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 12));
  return toISODate(next);
}

export function addDays(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toISODate(date);
}

/** Whole days from `a` to `b` (positive when `b` is later). */
export function daysBetween(a: string, b: string): number {
  return Math.round(
    (parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000,
  );
}

/** Inclusive list of ISO dates between two bounds. */
export function dateRange(fromISO: string, toISO: string): string[] {
  const out: string[] = [];
  const total = daysBetween(fromISO, toISO);
  if (total < 0) return out;
  for (let i = 0; i <= total; i += 1) out.push(addDays(fromISO, i));
  return out;
}

/* ── Countdown ────────────────────────────────────────────────────────────── */

export interface Countdown {
  totalMs: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
  /** `"47j 59m"` — the format the 48-hour quarantine card shows. */
  label: string;
  /** `"47j 59m 12s"` for the live ticking variant. */
  labelPrecise: string;
}

export function countdownTo(target: string | Date | null, now: Date = new Date()): Countdown {
  if (target === null) {
    return {
      totalMs: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      expired: true,
      label: "Terbuka",
      labelPrecise: "Terbuka",
    };
  }

  const targetMs = (target instanceof Date ? target : new Date(target)).getTime();
  const totalMs = targetMs - now.getTime();

  if (!Number.isFinite(totalMs) || totalMs <= 0) {
    return {
      totalMs: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      expired: true,
      label: "Terbuka",
      labelPrecise: "Terbuka",
    };
  }

  const totalSeconds = Math.floor(totalMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    totalMs,
    hours,
    minutes,
    seconds,
    expired: false,
    label: `${hours}j ${String(minutes).padStart(2, "0")}m`,
    labelPrecise: `${hours}j ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`,
  };
}

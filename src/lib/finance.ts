/**
 * Finance engine — all derived numbers in the app are computed here.
 *
 * Correctness rules observed throughout:
 *  • Money is rounded to whole Rupiah at every boundary via `toRupiah()`.
 *  • Percentage splits never lose or invent money: the final slice absorbs
 *    the rounding remainder so the parts always sum to the whole exactly.
 *  • Weekly windows are ISO weeks (Monday→Sunday), matching rule R03.
 */

import {
  CIGARETTE_CATEGORY,
  CIGARETTE_MIN_DAYS_BETWEEN,
  DAILY_ALLOWANCE,
  EMERGENCY_FUND_TARGET,
  FREELANCE_SPLIT_RULES,
  SALARY_SPLIT_RULES,
  WEEKLY_BUDGET_CAP,
  type SplitRule,
} from "@/lib/constants";
import {
  daysBetween,
  endOfWeek,
  firstOfNextMonth,
  formatMonthKey,
  formatDateShort,
  monthKeyOf,
  startOfWeek,
  todayWIB,
  weekKeyOf,
} from "@/lib/format";
import type { DailyAudit, Transaction, TxType, Wallet } from "@/lib/types/database";

/** Round to whole Rupiah. The single rounding boundary for all money math. */
export function toRupiah(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

export function sum(values: readonly number[]): number {
  return toRupiah(values.reduce((acc, n) => acc + (Number.isFinite(n) ? n : 0), 0));
}

const INCOME_TYPES: readonly TxType[] = ["income_salary", "income_freelance"];

export function isIncome(tx: Transaction): boolean {
  return INCOME_TYPES.includes(tx.tx_type);
}

export function isExpense(tx: Transaction): boolean {
  return tx.tx_type === "expense";
}

/** Transfers move money between pockets; they are never net income or spend. */
export function isTransfer(tx: Transaction): boolean {
  return tx.tx_type === "transfer";
}

/* ── Percentage splits ────────────────────────────────────────────────────── */

export interface SplitSlice {
  key: string;
  label: string;
  ratio: number;
  amount: number;
  walletCategory: SplitRule["walletCategory"];
  note: string;
}

/**
 * Distribute `total` across the 35/25/20/15/5 salary rules.
 *
 * Rounding contract: slices 1..n-1 are rounded individually; the last slice is
 * `total − sum(previous)`. The result therefore always satisfies
 * `sum(slices) === toRupiah(total)` — no Rupiah is created or destroyed.
 */
export function splitSalary(total: number): SplitSlice[] {
  const whole = toRupiah(total);
  const slices: SplitSlice[] = [];
  let allocated = 0;

  SALARY_SPLIT_RULES.forEach((rule, index) => {
    const isLast = index === SALARY_SPLIT_RULES.length - 1;
    const amount = isLast ? whole - allocated : toRupiah(whole * rule.ratio);
    allocated += amount;
    slices.push({
      key: rule.key,
      label: rule.label,
      ratio: rule.ratio,
      amount,
      walletCategory: rule.walletCategory,
      note: rule.note,
    });
  });

  return slices;
}

export interface FreelanceSplit {
  total: number;
  /** 70% slice. */
  tabunganInvestasi: number;
  /** Half of the 70% slice, into Tabungan Produktif. */
  tabunganProduktif: number;
  /** Half of the 70% slice, into Investasi Pemula. */
  investasiPemula: number;
  /** 30% slice. */
  selfReward: number;
  rules: typeof FREELANCE_SPLIT_RULES;
}

/** 70% Tabungan/Investasi : 30% Self-Reward, exact to the Rupiah. */
export function splitFreelance(total: number): FreelanceSplit {
  const whole = toRupiah(total);
  const tabunganInvestasi = toRupiah(whole * 0.7);
  const selfReward = whole - tabunganInvestasi; // absorbs remainder
  const tabunganProduktif = toRupiah(tabunganInvestasi / 2);
  const investasiPemula = tabunganInvestasi - tabunganProduktif;

  return {
    total: whole,
    tabunganInvestasi,
    tabunganProduktif,
    investasiPemula,
    selfReward,
    rules: FREELANCE_SPLIT_RULES,
  };
}

/* ── Daily / weekly / monthly summaries ───────────────────────────────────── */

export interface DailySummary {
  date: string;
  income: number;
  incomeSalary: number;
  incomeFreelance: number;
  expense: number;
  net: number;
  /** Rp67.500 ÷ 7, minus today's spend. Negative means over allowance. */
  remainingAllowance: number;
  txCount: number;
}

export function summarizeDay(
  transactions: readonly Transaction[],
  dateISO: string,
): DailySummary {
  const rows = transactions.filter((tx) => tx.tanggal === dateISO);
  const incomeSalary = sum(
    rows.filter((tx) => tx.tx_type === "income_salary").map((tx) => tx.nominal),
  );
  const incomeFreelance = sum(
    rows.filter((tx) => tx.tx_type === "income_freelance").map((tx) => tx.nominal),
  );
  const expense = sum(rows.filter(isExpense).map((tx) => tx.nominal));
  const income = toRupiah(incomeSalary + incomeFreelance);

  return {
    date: dateISO,
    income,
    incomeSalary,
    incomeFreelance,
    expense,
    net: toRupiah(income - expense),
    remainingAllowance: toRupiah(DAILY_ALLOWANCE - expense),
    txCount: rows.length,
  };
}

export type BudgetStatus = "aman" | "waspada" | "lewat";

export interface WeeklySummary {
  weekKey: string;
  startDate: string;
  endDate: string;
  income: number;
  expense: number;
  net: number;
  cap: number;
  /** `expense / cap`. Can exceed 1. */
  usageRatio: number;
  remaining: number;
  status: BudgetStatus;
  cigarettePacks: number;
  cigaretteSpend: number;
  txCount: number;
}

export function summarizeWeek(
  transactions: readonly Transaction[],
  anchorISO: string,
): WeeklySummary {
  const startDate = startOfWeek(anchorISO);
  const endDate = endOfWeek(anchorISO);
  const rows = transactions.filter(
    (tx) => tx.tanggal >= startDate && tx.tanggal <= endDate,
  );

  const income = sum(rows.filter(isIncome).map((tx) => tx.nominal));
  const expense = sum(rows.filter(isExpense).map((tx) => tx.nominal));
  const cigaretteRows = rows.filter(
    (tx) => isExpense(tx) && tx.kategori === CIGARETTE_CATEGORY,
  );
  const usageRatio = WEEKLY_BUDGET_CAP > 0 ? expense / WEEKLY_BUDGET_CAP : 0;

  return {
    weekKey: weekKeyOf(anchorISO),
    startDate,
    endDate,
    income,
    expense,
    net: toRupiah(income - expense),
    cap: WEEKLY_BUDGET_CAP,
    usageRatio,
    remaining: toRupiah(WEEKLY_BUDGET_CAP - expense),
    status: budgetStatus(usageRatio),
    cigarettePacks: cigaretteRows.length,
    cigaretteSpend: sum(cigaretteRows.map((tx) => tx.nominal)),
    txCount: rows.length,
  };
}

export function budgetStatus(usageRatio: number): BudgetStatus {
  if (usageRatio > 1) return "lewat";
  if (usageRatio >= 0.8) return "waspada";
  return "aman";
}

export const BUDGET_STATUS_LABEL: Record<BudgetStatus, string> = {
  aman: "Aman",
  waspada: "Waspada",
  lewat: "Lewat Batas",
};

export interface MonthlySummary {
  monthKey: string;
  label: string;
  incomeSalary: number;
  incomeFreelance: number;
  income: number;
  expense: number;
  net: number;
  savingsRate: number;
  txCount: number;
}

export function summarizeMonth(
  transactions: readonly Transaction[],
  monthKey: string,
): MonthlySummary {
  const rows = transactions.filter((tx) => monthKeyOf(tx.tanggal) === monthKey);
  const incomeSalary = sum(
    rows.filter((tx) => tx.tx_type === "income_salary").map((tx) => tx.nominal),
  );
  const incomeFreelance = sum(
    rows.filter((tx) => tx.tx_type === "income_freelance").map((tx) => tx.nominal),
  );
  const income = toRupiah(incomeSalary + incomeFreelance);
  const expense = sum(rows.filter(isExpense).map((tx) => tx.nominal));

  return {
    monthKey,
    label: formatMonthKey(monthKey),
    incomeSalary,
    incomeFreelance,
    income,
    expense,
    net: toRupiah(income - expense),
    savingsRate: income > 0 ? (income - expense) / income : 0,
    txCount: rows.length,
  };
}

export interface YearlySummary {
  year: string;
  incomeSalary: number;
  incomeFreelance: number;
  income: number;
  expense: number;
  net: number;
  savingsRate: number;
  txCount: number;
}

export function summarizeYear(
  transactions: readonly Transaction[],
  year: string,
): YearlySummary {
  const rows = transactions.filter((tx) => tx.tanggal.startsWith(year));
  const incomeSalary = sum(
    rows.filter((tx) => tx.tx_type === "income_salary").map((tx) => tx.nominal),
  );
  const incomeFreelance = sum(
    rows.filter((tx) => tx.tx_type === "income_freelance").map((tx) => tx.nominal),
  );
  const income = toRupiah(incomeSalary + incomeFreelance);
  const expense = sum(rows.filter(isExpense).map((tx) => tx.nominal));

  return {
    year,
    incomeSalary,
    incomeFreelance,
    income,
    expense,
    net: toRupiah(income - expense),
    savingsRate: income > 0 ? (income - expense) / income : 0,
    txCount: rows.length,
  };
}

/* ── Chart series ─────────────────────────────────────────────────────────── */

export type ChartGranularity = "harian" | "mingguan" | "bulanan";

export interface ChartPoint {
  /** Bucket key: ISO date, ISO week, or month key. */
  key: string;
  /** Short axis label. */
  label: string;
  /** Long label for the crosshair tooltip. */
  fullLabel: string;
  gaji: number;
  freelance: number;
  pengeluaran: number;
}

/**
 * Build the mountain-chart series.
 *
 * Buckets with no activity are preserved for `harian` so the ridge line keeps
 * an even time axis instead of compressing gaps.
 */
export function buildChartSeries(
  transactions: readonly Transaction[],
  granularity: ChartGranularity,
  options: { days?: number; today?: string } = {},
): ChartPoint[] {
  const today = options.today ?? todayWIB();

  const bucketOf = (iso: string): string => {
    if (granularity === "harian") return iso;
    if (granularity === "mingguan") return weekKeyOf(iso);
    return monthKeyOf(iso);
  };

  const buckets = new Map<string, ChartPoint>();

  const ensure = (key: string, sampleISO: string): ChartPoint => {
    const existing = buckets.get(key);
    if (existing) return existing;

    const point: ChartPoint = {
      key,
      label: bucketLabel(key, granularity, sampleISO),
      fullLabel: bucketFullLabel(key, granularity, sampleISO),
      gaji: 0,
      freelance: 0,
      pengeluaran: 0,
    };
    buckets.set(key, point);
    return point;
  };

  // Seed an even daily axis for the trailing window.
  if (granularity === "harian") {
    const days = options.days ?? 30;
    for (let i = days - 1; i >= 0; i -= 1) {
      const iso = shiftISO(today, -i);
      ensure(iso, iso);
    }
  }

  for (const tx of transactions) {
    const key = bucketOf(tx.tanggal);
    // For `harian`, ignore rows outside the seeded window.
    if (granularity === "harian" && !buckets.has(key)) continue;

    const point = ensure(key, tx.tanggal);
    if (tx.tx_type === "income_salary") point.gaji += tx.nominal;
    else if (tx.tx_type === "income_freelance") point.freelance += tx.nominal;
    else if (tx.tx_type === "expense") point.pengeluaran += tx.nominal;
  }

  return [...buckets.values()]
    .map((point) => ({
      ...point,
      gaji: toRupiah(point.gaji),
      freelance: toRupiah(point.freelance),
      pengeluaran: toRupiah(point.pengeluaran),
    }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

function shiftISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map((n) => Number.parseInt(n, 10));
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days, 12));
  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function bucketLabel(key: string, granularity: ChartGranularity, sampleISO: string): string {
  if (granularity === "harian") {
    const [, , d] = key.split("-");
    return d ?? key;
  }
  if (granularity === "mingguan") {
    return `W${key.split("-W")[1] ?? ""}`;
  }
  return formatMonthKey(key).split(" ")[0]?.slice(0, 3) ?? sampleISO;
}

function bucketFullLabel(
  key: string,
  granularity: ChartGranularity,
  sampleISO: string,
): string {
  if (granularity === "harian") return formatDateShort(key);
  if (granularity === "mingguan") {
    return `Minggu ${key.split("-W")[1] ?? ""} · ${formatDateShort(startOfWeek(sampleISO))} – ${formatDateShort(endOfWeek(sampleISO))}`;
  }
  return formatMonthKey(key);
}

/* ── KPI block ────────────────────────────────────────────────────────────── */

export interface DashboardKpis {
  salaryTotal: number;
  /** Month-over-month growth of salary income, as a ratio. */
  salaryGrowth: number;
  freelanceTotal: number;
  /** Freelance income still frozen, waiting for the 1st of next month. */
  freelanceFrozen: number;
  freelanceUnlockDate: string;
  expenseTotal: number;
  week: WeeklySummary;
  today: DailySummary;
  totalBalance: number;
  emergencyBalance: number;
  emergencyTarget: number;
  emergencyProgress: number;
}

export function computeDashboardKpis(
  transactions: readonly Transaction[],
  wallets: readonly Wallet[],
  todayISO: string = todayWIB(),
): DashboardKpis {
  const salaryRows = transactions.filter((tx) => tx.tx_type === "income_salary");
  const freelanceRows = transactions.filter((tx) => tx.tx_type === "income_freelance");

  const thisMonth = monthKeyOf(todayISO);
  const prevMonth = previousMonthKey(thisMonth);

  const salaryThisMonth = sum(
    salaryRows.filter((tx) => monthKeyOf(tx.tanggal) === thisMonth).map((tx) => tx.nominal),
  );
  const salaryPrevMonth = sum(
    salaryRows.filter((tx) => monthKeyOf(tx.tanggal) === prevMonth).map((tx) => tx.nominal),
  );

  const emergencyWallet = wallets.find((w) => w.category === "darurat");
  const emergencyBalance = toRupiah(emergencyWallet?.balance ?? 0);
  const emergencyTarget = toRupiah(emergencyWallet?.target_amount ?? EMERGENCY_FUND_TARGET);

  return {
    salaryTotal: sum(salaryRows.map((tx) => tx.nominal)),
    salaryGrowth:
      salaryPrevMonth > 0 ? (salaryThisMonth - salaryPrevMonth) / salaryPrevMonth : 0,
    freelanceTotal: sum(freelanceRows.map((tx) => tx.nominal)),
    freelanceFrozen: sum(
      freelanceRows.filter((tx) => tx.is_frozen_freelance).map((tx) => tx.nominal),
    ),
    freelanceUnlockDate: firstOfNextMonth(todayISO),
    expenseTotal: sum(transactions.filter(isExpense).map((tx) => tx.nominal)),
    week: summarizeWeek(transactions, todayISO),
    today: summarizeDay(transactions, todayISO),
    totalBalance: sum(wallets.map((w) => w.balance)),
    emergencyBalance,
    emergencyTarget,
    emergencyProgress:
      emergencyTarget > 0 ? Math.min(emergencyBalance / emergencyTarget, 1) : 0,
  };
}

export function previousMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split("-").map((n) => Number.parseInt(n, 10));
  const year = y ?? 1970;
  const month = m ?? 1;
  return month === 1
    ? `${year - 1}-12`
    : `${year}-${String(month - 1).padStart(2, "0")}`;
}

/* ── Cigarette quota guard (rule R04) ─────────────────────────────────────── */

export interface CigaretteGuard {
  /** True when the last pack was bought less than 3 days ago. */
  blocked: boolean;
  lastPurchaseDate: string | null;
  daysSince: number | null;
  daysRemaining: number;
  nextAllowedDate: string | null;
  packsThisWeek: number;
  spendThisWeek: number;
  message: string;
}

export function evaluateCigaretteGuard(
  transactions: readonly Transaction[],
  todayISO: string = todayWIB(),
): CigaretteGuard {
  const packs = transactions
    .filter((tx) => isExpense(tx) && tx.kategori === CIGARETTE_CATEGORY)
    .sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1));

  const week = summarizeWeek(transactions, todayISO);
  const last = packs[0];

  if (!last) {
    return {
      blocked: false,
      lastPurchaseDate: null,
      daysSince: null,
      daysRemaining: 0,
      nextAllowedDate: null,
      packsThisWeek: week.cigarettePacks,
      spendThisWeek: week.cigaretteSpend,
      message: "Belum ada pembelian rokok tercatat. Kuota 1 bungkus / 3 hari masih utuh.",
    };
  }

  const daysSince = daysBetween(last.tanggal, todayISO);
  const blocked = daysSince < CIGARETTE_MIN_DAYS_BETWEEN;
  const daysRemaining = blocked ? CIGARETTE_MIN_DAYS_BETWEEN - daysSince : 0;
  const nextAllowedDate = shiftISO(last.tanggal, CIGARETTE_MIN_DAYS_BETWEEN);

  return {
    blocked,
    lastPurchaseDate: last.tanggal,
    daysSince,
    daysRemaining,
    nextAllowedDate,
    packsThisWeek: week.cigarettePacks,
    spendThisWeek: week.cigaretteSpend,
    message: blocked
      ? `Pembelian terakhir ${formatDateShort(last.tanggal)} (${daysSince} hari lalu). Aturan 1 bungkus / 3 hari belum terpenuhi — tunggu ${daysRemaining} hari lagi, boleh beli lagi ${formatDateShort(nextAllowedDate)}.`
      : `Pembelian terakhir ${formatDateShort(last.tanggal)} (${daysSince} hari lalu). Kuota 1 bungkus / 3 hari sudah terpenuhi.`,
  };
}

/* ── Discipline streak (rule R01) ─────────────────────────────────────────── */

export interface StreakResult {
  current: number;
  longest: number;
  totalAudited: number;
  /** True when today's evening audit is already checked off. */
  todayDone: boolean;
  lastAuditDate: string | null;
}

/**
 * Consecutive-day streak of completed evening audits, counted backwards from
 * today. If today is not yet audited, the streak is measured from yesterday so
 * an unfinished evening does not falsely zero the counter before 21:00.
 */
export function computeStreak(
  audits: readonly DailyAudit[],
  todayISO: string = todayWIB(),
): StreakResult {
  const done = new Set(
    audits.filter((a) => a.evening_audit_done).map((a) => a.audit_date),
  );
  const todayDone = done.has(todayISO);

  let current = 0;
  let cursor = todayDone ? todayISO : shiftISO(todayISO, -1);
  while (done.has(cursor)) {
    current += 1;
    cursor = shiftISO(cursor, -1);
  }

  const sorted = [...done].sort();
  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const date of sorted) {
    run = previous !== null && daysBetween(previous, date) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = date;
  }

  return {
    current,
    longest,
    totalAudited: done.size,
    todayDone,
    lastAuditDate: sorted.length > 0 ? (sorted[sorted.length - 1] ?? null) : null,
  };
}

/* ── Wallet helpers ───────────────────────────────────────────────────────── */

export function walletProgress(wallet: Wallet): number {
  const target = wallet.target_amount ?? 0;
  if (target <= 0) return 0;
  return Math.min(Math.max(wallet.balance / target, 0), 1);
}

export function walletById(
  wallets: readonly Wallet[],
  id: string | null,
): Wallet | undefined {
  if (id === null) return undefined;
  return wallets.find((w) => w.id === id);
}

export function walletByCategory(
  wallets: readonly Wallet[],
  category: Wallet["category"],
): Wallet | undefined {
  return wallets.find((w) => w.category === category);
}

/** Net flow attributable to one wallet, recomputed from the ledger. */
export function walletLedgerBalance(
  transactions: readonly Transaction[],
  walletId: string,
): number {
  let total = 0;
  for (const tx of transactions) {
    if (tx.wallet_id === walletId) {
      if (isIncome(tx)) total += tx.nominal;
      else if (isExpense(tx) || isTransfer(tx)) total -= tx.nominal;
    }
    if (tx.target_wallet_id === walletId && isTransfer(tx)) {
      total += tx.nominal;
    }
  }
  return toRupiah(total);
}

/* ── Category breakdown ───────────────────────────────────────────────────── */

export interface CategoryTotal {
  kategori: string;
  total: number;
  count: number;
  share: number;
}

export function expenseByCategory(
  transactions: readonly Transaction[],
): CategoryTotal[] {
  const rows = transactions.filter(isExpense);
  const grand = sum(rows.map((tx) => tx.nominal));
  const map = new Map<string, { total: number; count: number }>();

  for (const tx of rows) {
    const entry = map.get(tx.kategori) ?? { total: 0, count: 0 };
    entry.total += tx.nominal;
    entry.count += 1;
    map.set(tx.kategori, entry);
  }

  return [...map.entries()]
    .map(([kategori, { total, count }]) => ({
      kategori,
      total: toRupiah(total),
      count,
      share: grand > 0 ? total / grand : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

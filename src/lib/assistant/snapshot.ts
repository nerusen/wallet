import "server-only";

import {
  CIGARETTE_CATEGORY,
  EMERGENCY_FUND_TARGET,
  SYSTEM_HORIZON_DATE,
  SYSTEM_START_DATE,
  WEEKLY_BUDGET_CAP,
} from "@/lib/constants";
import {
  computeDashboardKpis,
  evaluateCigaretteGuard,
  expenseByCategory,
  summarizeMonth,
  summarizeWeek,
  sum,
} from "@/lib/finance";
import {
  formatDateShort,
  formatPercent,
  formatRupiah,
  monthKeyOf,
  todayWIB,
} from "@/lib/format";
import { fetchSnapshot } from "@/lib/supabase/queries";
import type { ChatMessage } from "@/lib/types/database";

/**
 * Builds the READ-ONLY financial context handed to Gemini.
 *
 * Rendered as compact labelled text rather than raw JSON: it costs noticeably
 * fewer tokens than pretty-printed JSON and the model reads pre-formatted
 * Rupiah figures more reliably than raw integers (it never has to re-derive
 * `450000` into `Rp 450.000`).
 *
 * Nothing here can mutate data — the assistant is strictly advisory.
 */
export interface SnapshotResult {
  text: string;
  error: string | null;
}

/** Month keys from the system baseline through the planning horizon. */
function horizonMonthKeys(): string[] {
  const keys: string[] = [];
  const start = SYSTEM_START_DATE.slice(0, 7);
  const end = SYSTEM_HORIZON_DATE.slice(0, 7);

  let [y, m] = start.split("-").map((n) => Number.parseInt(n, 10));
  let year = y ?? 2026;
  let month = m ?? 11;

  // Hard cap at 36 iterations so a bad constant can never spin forever.
  for (let i = 0; i < 36; i += 1) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    keys.push(key);
    if (key === end) break;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return keys;
}

export async function buildFinancialSnapshot(
  history: readonly ChatMessage[] = [],
): Promise<SnapshotResult> {
  const today = todayWIB();

  const snapshot = await fetchSnapshot({
    wallets: true,
    transactions: true,
    tasks: false,
    audits: false,
  });

  if (snapshot.error !== null) {
    return { text: "", error: snapshot.error };
  }

  const { wallets, transactions } = snapshot;
  const kpis = computeDashboardKpis(transactions, wallets, today);
  const week = summarizeWeek(transactions, today);
  const guard = evaluateCigaretteGuard(transactions, today);
  const categories = expenseByCategory(transactions);

  const lines: string[] = [];
  const push = (s: string) => lines.push(s);

  push(`# SNAPSHOT KEUANGAN — ${formatDateShort(today)} (WIB)`);
  push(`Data baca-saja. Sistem berjalan sejak ${formatDateShort(SYSTEM_START_DATE)}.`);
  push("");

  /* 1. Wallets */
  push("## 1. DOMPET");
  if (wallets.length === 0) {
    push("(belum ada dompet)");
  } else {
    for (const w of wallets) {
      const target = w.target_amount ?? 0;
      const pct =
        target > 0 ? ` · ${formatPercent(Math.min(w.balance / target, 1), 0)} dari target` : "";
      push(
        `- ${w.name} [${w.category}]: ${formatRupiah(w.balance)}${
          target > 0 ? ` / target ${formatRupiah(target)}` : ""
        }${pct}`,
      );
    }
  }
  push("");

  /* 2. Totals */
  push("## 2. TOTAL KESELURUHAN");
  push(`- Total pemasukan gaji: ${formatRupiah(kpis.salaryTotal)}`);
  push(`- Total pemasukan freelance: ${formatRupiah(kpis.freelanceTotal)}`);
  push(
    `- Freelance BEKU (belum cair): ${formatRupiah(kpis.freelanceFrozen)} · unlock ${formatDateShort(kpis.freelanceUnlockDate)}`,
  );
  push(
    `- Freelance AKTIF/LIKUID: ${formatRupiah(kpis.freelanceTotal - kpis.freelanceFrozen)}`,
  );
  push(`- Total pengeluaran: ${formatRupiah(kpis.expenseTotal)}`);
  push(`- Saldo bersih seluruh dompet: ${formatRupiah(kpis.totalBalance)}`);
  push(
    `- Dana darurat: ${formatRupiah(kpis.emergencyBalance)} / ${formatRupiah(EMERGENCY_FUND_TARGET)} (${formatPercent(kpis.emergencyProgress, 1)})`,
  );
  push("");

  /* 3. Current week + cigarette rule */
  push("## 3. MINGGU BERJALAN & ATURAN");
  push(
    `- Periode: ${formatDateShort(week.startDate)} – ${formatDateShort(week.endDate)}`,
  );
  push(
    `- Realisasi belanja: ${formatRupiah(week.expense)} dari batas ${formatRupiah(WEEKLY_BUDGET_CAP)} (${formatPercent(week.usageRatio, 0)})`,
  );
  push(
    week.remaining >= 0
      ? `- Sisa jatah minggu ini: ${formatRupiah(week.remaining)}`
      : `- LEWAT BATAS sebesar ${formatRupiah(Math.abs(week.remaining))}`,
  );
  push(`- Status: ${week.status.toUpperCase()}`);
  push(
    `- Jatah harian hari ini tersisa: ${formatRupiah(kpis.today.remainingAllowance)}`,
  );
  push(
    `- Rokok: ${guard.daysSince === null ? "belum ada pembelian tercatat" : `${guard.daysSince} hari sejak pembelian terakhir (${formatDateShort(guard.lastPurchaseDate ?? today)})`}; aturan 1 bungkus / 3 hari ${guard.blocked ? `BELUM terpenuhi, tunggu ${guard.daysRemaining} hari lagi` : "sudah terpenuhi"}`,
  );
  push(
    `- Rokok minggu ini: ${week.cigarettePacks} bungkus (${formatRupiah(week.cigaretteSpend)})`,
  );
  push("");

  /* 4. Monthly chart summary */
  push("## 4. RINGKASAN BULANAN (Nov 2026 – Jun 2027)");
  const monthRows = horizonMonthKeys()
    .map((key) => summarizeMonth(transactions, key))
    .filter((m) => m.txCount > 0);

  if (monthRows.length === 0) {
    push("(belum ada transaksi dalam rentang ini)");
  } else {
    for (const m of monthRows) {
      push(
        `- ${m.label}: masuk ${formatRupiah(m.income)} (gaji ${formatRupiah(m.incomeSalary)} + freelance ${formatRupiah(m.incomeFreelance)}) · keluar ${formatRupiah(m.expense)} · net ${formatRupiah(m.net)} · rasio tabung ${formatPercent(m.savingsRate, 1)}`,
      );
    }
  }
  push("");

  /* 5. Category spending */
  push("## 5. PENGELUARAN PER KATEGORI (akumulasi)");
  if (categories.length === 0) {
    push("(belum ada pengeluaran)");
  } else {
    for (const c of categories) {
      const flag = c.kategori === CIGARETTE_CATEGORY ? " [kategori rokok]" : "";
      push(
        `- ${c.kategori}: ${formatRupiah(c.total)} · ${c.count}x · ${formatPercent(c.share, 1)} dari total${flag}`,
      );
    }
  }
  push("");

  /* 6. Last 30 transactions */
  push("## 6. 30 TRANSAKSI TERAKHIR");
  const walletName = new Map(wallets.map((w) => [w.id, w.name]));
  const recent = [...transactions]
    .sort((a, b) =>
      a.tanggal < b.tanggal ? 1 : a.tanggal > b.tanggal ? -1 : a.created_at < b.created_at ? 1 : -1,
    )
    .slice(0, 30);

  if (recent.length === 0) {
    push("(belum ada transaksi)");
  } else {
    for (const tx of recent) {
      const from = tx.wallet_id === null ? "—" : (walletName.get(tx.wallet_id) ?? "—");
      const to =
        tx.target_wallet_id === null ? null : (walletName.get(tx.target_wallet_id) ?? null);
      const frozen = tx.tx_type === "income_freelance" ? (tx.is_frozen_freelance ? " [BEKU]" : " [CAIR]") : "";
      push(
        `- ${tx.tanggal} | ${tx.tx_type} | ${tx.kategori} | ${tx.barang_keperluan} | ${formatRupiah(tx.nominal)} | dompet: ${from}${to === null ? "" : ` → ${to}`}${frozen}${tx.catatan === null ? "" : ` | catatan: ${tx.catatan}`}`,
      );
    }
  }
  push("");

  /* 7. Conversation history */
  if (history.length > 0) {
    push("## 7. RIWAYAT OBROLAN TERAKHIR");
    for (const m of history) {
      const who = m.role === "user" ? "Pengguna" : "Asisten";
      // Trim long turns so history cannot dominate the prompt budget.
      const body = m.content.length > 400 ? `${m.content.slice(0, 400)}…` : m.content;
      push(`- ${who}: ${body}`);
    }
    push("");
  }

  push(
    `Catatan: total transaksi tercatat ${transactions.length}, total pemasukan ${formatRupiah(sum(transactions.filter((t) => t.tx_type === "income_salary" || t.tx_type === "income_freelance").map((t) => t.nominal)))}.`,
  );
  push(
    `Bulan berjalan: ${monthKeyOf(today)}. Gunakan angka di atas; jangan mengarang data yang tidak ada.`,
  );

  return { text: lines.join("\n"), error: null };
}

"use client";

import * as React from "react";

import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui/panel";
import { TabRail } from "@/components/ui/tabs";
import { WEEKLY_BUDGET_CAP } from "@/lib/constants";
import {
  formatDateShort,
  formatPercent,
  formatRupiah,
  hariIndonesia,
  monthKeyOf,
  weekKeyOf,
} from "@/lib/format";
import {
  BUDGET_STATUS_LABEL,
  summarizeDay,
  summarizeMonth,
  summarizeWeek,
  summarizeYear,
  sum,
} from "@/lib/finance";
import type { Transaction, Wallet } from "@/lib/types/database";

type Rollup = "harian" | "mingguan" | "bulanan" | "tahunan" | "ledger";

/**
 * Historical ledger with automatic daily / weekly / monthly / yearly rollups.
 *
 * Every rollup is derived from the same `summarize*` functions the dashboard
 * uses, so a figure here can never disagree with a figure there.
 */
export function LedgerTabs({
  transactions,
  wallets,
  today,
}: {
  transactions: readonly Transaction[];
  wallets: readonly Wallet[];
  today: string;
}) {
  const [tab, setTab] = React.useState<Rollup>("bulanan");

  const walletName = React.useMemo(
    () => new Map(wallets.map((w) => [w.id, w.name])),
    [wallets],
  );

  const keys = React.useMemo(() => {
    const days = new Set<string>();
    const weeks = new Set<string>();
    const months = new Set<string>();
    const years = new Set<string>();

    for (const tx of transactions) {
      days.add(tx.tanggal);
      weeks.add(tx.tanggal); // anchor dates; collapsed below
      months.add(monthKeyOf(tx.tanggal));
      years.add(tx.tanggal.slice(0, 4));
    }

    // Collapse week anchors to one representative date per ISO week.
    const weekAnchors = new Map<string, string>();
    for (const date of weeks) {
      const key = weekKeyOf(date);
      const existing = weekAnchors.get(key);
      if (existing === undefined || date < existing) weekAnchors.set(key, date);
    }

    return {
      days: [...days].sort().reverse(),
      weekAnchors: [...weekAnchors.entries()].sort((a, b) =>
        a[0] < b[0] ? 1 : -1,
      ),
      months: [...months].sort().reverse(),
      years: [...years].sort().reverse(),
    };
  }, [transactions]);

  const ledger = React.useMemo(
    () =>
      [...transactions].sort((a, b) =>
        a.tanggal < b.tanggal
          ? 1
          : a.tanggal > b.tanggal
            ? -1
            : a.created_at < b.created_at
              ? 1
              : -1,
      ),
    [transactions],
  );

  return (
    <Panel>
      <PanelHeader
        code="03"
        eyebrow="Buku Besar & Rollup"
        title="Timeline Historis"
        description="Rollup otomatis dari seluruh transaksi yang tercatat. Semua angka diturunkan dari fungsi perhitungan yang sama dengan dashboard."
        actions={<Badge tone="neutral">{transactions.length} transaksi</Badge>}
      />

      <TabRail
        items={[
          { value: "harian" as const, label: "Harian", meta: String(keys.days.length) },
          { value: "mingguan" as const, label: "Mingguan", meta: String(keys.weekAnchors.length) },
          { value: "bulanan" as const, label: "Bulanan", meta: String(keys.months.length) },
          { value: "tahunan" as const, label: "Tahunan", meta: String(keys.years.length) },
          { value: "ledger" as const, label: "Buku Besar", meta: String(ledger.length) },
        ]}
        value={tab}
        onChange={setTab}
      />

      {transactions.length === 0 ? (
        <EmptyState
          title="Belum ada transaksi"
          description="Impor CSV atau catat transaksi pertama untuk mulai membangun timeline."
        />
      ) : (
        <div className="table-scroll">
          {tab === "harian" && (
            <DailyTable dates={keys.days} transactions={transactions} />
          )}
          {tab === "mingguan" && (
            <WeeklyTable anchors={keys.weekAnchors} transactions={transactions} />
          )}
          {tab === "bulanan" && (
            <MonthlyTable months={keys.months} transactions={transactions} />
          )}
          {tab === "tahunan" && (
            <YearlyTable years={keys.years} transactions={transactions} />
          )}
          {tab === "ledger" && (
            <LedgerTable rows={ledger} walletName={walletName} today={today} />
          )}
        </div>
      )}
    </Panel>
  );
}

function DailyTable({
  dates,
  transactions,
}: {
  dates: readonly string[];
  transactions: readonly Transaction[];
}) {
  const rows = dates.map((date) => summarizeDay(transactions, date));

  return (
    <table className="brutal-table">
      <thead>
        <tr>
          <th>Tanggal</th>
          <th>Hari</th>
          <th className="text-right">Gaji</th>
          <th className="text-right">Freelance</th>
          <th className="text-right">Keluar</th>
          <th className="text-right">Net</th>
          <th className="text-right">Sisa Jatah</th>
          <th className="text-right">Tx</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.date}>
            <td className="font-mono text-[12px] tabular">
              {formatDateShort(row.date)}
            </td>
            <td className="font-mono text-[11px] text-muted-foreground">
              {hariIndonesia(row.date)}
            </td>
            <td className="text-right font-mono text-[12px] text-accent tabular">
              {row.incomeSalary > 0 ? formatRupiah(row.incomeSalary) : "—"}
            </td>
            <td className="text-right font-mono text-[12px] text-foreground tabular">
              {row.incomeFreelance > 0 ? formatRupiah(row.incomeFreelance) : "—"}
            </td>
            <td className="text-right font-mono text-[12px] text-danger tabular">
              {row.expense > 0 ? formatRupiah(row.expense) : "—"}
            </td>
            <td
              className={`text-right font-mono text-[12px] font-semibold tabular ${
                row.net >= 0 ? "text-success" : "text-danger"
              }`}
            >
              {formatRupiah(row.net)}
            </td>
            <td
              className={`text-right font-mono text-[11px] tabular ${
                row.remainingAllowance >= 0 ? "text-muted-foreground" : "text-danger"
              }`}
            >
              {formatRupiah(row.remainingAllowance)}
            </td>
            <td className="text-right font-mono text-[11px] text-muted-foreground tabular">
              {row.txCount}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={2} className="font-mono text-[11px] uppercase tracking-[0.08em]">
            Total {rows.length} hari
          </td>
          <td className="text-right font-mono text-[12px] tabular">
            {formatRupiah(sum(rows.map((r) => r.incomeSalary)))}
          </td>
          <td className="text-right font-mono text-[12px] tabular">
            {formatRupiah(sum(rows.map((r) => r.incomeFreelance)))}
          </td>
          <td className="text-right font-mono text-[12px] tabular">
            {formatRupiah(sum(rows.map((r) => r.expense)))}
          </td>
          <td className="text-right font-mono text-[13px] tabular">
            {formatRupiah(sum(rows.map((r) => r.net)))}
          </td>
          <td colSpan={2} />
        </tr>
      </tfoot>
    </table>
  );
}

function WeeklyTable({
  anchors,
  transactions,
}: {
  anchors: readonly [string, string][];
  transactions: readonly Transaction[];
}) {
  const rows = anchors.map(([, anchorDate]) => summarizeWeek(transactions, anchorDate));

  return (
    <table className="brutal-table">
      <thead>
        <tr>
          <th>Minggu</th>
          <th>Periode</th>
          <th className="text-right">Masuk</th>
          <th className="text-right">Keluar</th>
          <th className="text-right">Batas</th>
          <th className="text-right">Pemakaian</th>
          <th className="text-right">Net</th>
          <th>Status</th>
          <th className="text-right">Rokok</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const tone =
            row.status === "lewat"
              ? "text-danger"
              : row.status === "waspada"
                ? "text-warning"
                : "text-success";

          return (
            <tr key={row.weekKey}>
              <td className="font-mono text-[12px] tabular">{row.weekKey}</td>
              <td className="font-mono text-[11px] text-muted-foreground tabular">
                {formatDateShort(row.startDate)} – {formatDateShort(row.endDate)}
              </td>
              <td className="text-right font-mono text-[12px] text-accent tabular">
                {formatRupiah(row.income)}
              </td>
              <td className="text-right font-mono text-[12px] text-danger tabular">
                {formatRupiah(row.expense)}
              </td>
              <td className="text-right font-mono text-[11px] text-muted-foreground tabular">
                {formatRupiah(row.cap)}
              </td>
              <td className={`text-right font-mono text-[12px] tabular ${tone}`}>
                {formatPercent(row.usageRatio, 0)}
              </td>
              <td
                className={`text-right font-mono text-[12px] font-semibold tabular ${
                  row.net >= 0 ? "text-success" : "text-danger"
                }`}
              >
                {formatRupiah(row.net)}
              </td>
              <td>
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="status-dot"
                    data-tone={
                      row.status === "lewat"
                        ? "danger"
                        : row.status === "waspada"
                          ? "warning"
                          : "success"
                    }
                  />
                  <span className="font-mono text-[10px] uppercase tracking-[0.07em] text-muted-foreground">
                    {BUDGET_STATUS_LABEL[row.status]}
                  </span>
                </span>
              </td>
              <td className="text-right font-mono text-[11px] text-muted-foreground tabular">
                {row.cigarettePacks}×
              </td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={2} className="font-mono text-[11px] uppercase tracking-[0.08em]">
            Total {rows.length} minggu
          </td>
          <td className="text-right font-mono text-[12px] tabular">
            {formatRupiah(sum(rows.map((r) => r.income)))}
          </td>
          <td className="text-right font-mono text-[12px] tabular">
            {formatRupiah(sum(rows.map((r) => r.expense)))}
          </td>
          <td className="text-right font-mono text-[11px] tabular">
            {formatRupiah(rows.length * WEEKLY_BUDGET_CAP)}
          </td>
          <td className="text-right font-mono text-[12px] tabular">
            {formatPercent(
              rows.length > 0
                ? sum(rows.map((r) => r.expense)) / (rows.length * WEEKLY_BUDGET_CAP)
                : 0,
              0,
            )}
          </td>
          <td className="text-right font-mono text-[13px] tabular">
            {formatRupiah(sum(rows.map((r) => r.net)))}
          </td>
          <td />
          <td className="text-right font-mono text-[11px] tabular">
            {rows.reduce((acc, r) => acc + r.cigarettePacks, 0)}×
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

function MonthlyTable({
  months,
  transactions,
}: {
  months: readonly string[];
  transactions: readonly Transaction[];
}) {
  const rows = months.map((month) => summarizeMonth(transactions, month));

  return (
    <table className="brutal-table">
      <thead>
        <tr>
          <th>Bulan</th>
          <th className="text-right">Gaji</th>
          <th className="text-right">Freelance</th>
          <th className="text-right">Total Masuk</th>
          <th className="text-right">Keluar</th>
          <th className="text-right">Net</th>
          <th className="text-right">Rasio Tabung</th>
          <th className="text-right">Tx</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.monthKey}>
            <td className="font-mono text-[12px]">{row.label}</td>
            <td className="text-right font-mono text-[12px] text-accent tabular">
              {formatRupiah(row.incomeSalary)}
            </td>
            <td className="text-right font-mono text-[12px] text-foreground tabular">
              {formatRupiah(row.incomeFreelance)}
            </td>
            <td className="text-right font-mono text-[12px] font-semibold text-foreground tabular">
              {formatRupiah(row.income)}
            </td>
            <td className="text-right font-mono text-[12px] text-danger tabular">
              {formatRupiah(row.expense)}
            </td>
            <td
              className={`text-right font-mono text-[12px] font-semibold tabular ${
                row.net >= 0 ? "text-success" : "text-danger"
              }`}
            >
              {formatRupiah(row.net)}
            </td>
            <td
              className={`text-right font-mono text-[11px] tabular ${
                row.savingsRate >= 0.3
                  ? "text-success"
                  : row.savingsRate >= 0
                    ? "text-muted-foreground"
                    : "text-danger"
              }`}
            >
              {formatPercent(row.savingsRate, 1)}
            </td>
            <td className="text-right font-mono text-[11px] text-muted-foreground tabular">
              {row.txCount}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td className="font-mono text-[11px] uppercase tracking-[0.08em]">
            Total {rows.length} bulan
          </td>
          <td className="text-right font-mono text-[12px] tabular">
            {formatRupiah(sum(rows.map((r) => r.incomeSalary)))}
          </td>
          <td className="text-right font-mono text-[12px] tabular">
            {formatRupiah(sum(rows.map((r) => r.incomeFreelance)))}
          </td>
          <td className="text-right font-mono text-[12px] tabular">
            {formatRupiah(sum(rows.map((r) => r.income)))}
          </td>
          <td className="text-right font-mono text-[12px] tabular">
            {formatRupiah(sum(rows.map((r) => r.expense)))}
          </td>
          <td className="text-right font-mono text-[13px] tabular">
            {formatRupiah(sum(rows.map((r) => r.net)))}
          </td>
          <td colSpan={2} />
        </tr>
      </tfoot>
    </table>
  );
}

function YearlyTable({
  years,
  transactions,
}: {
  years: readonly string[];
  transactions: readonly Transaction[];
}) {
  const rows = years.map((year) => summarizeYear(transactions, year));

  return (
    <table className="brutal-table">
      <thead>
        <tr>
          <th>Tahun</th>
          <th className="text-right">Gaji</th>
          <th className="text-right">Freelance</th>
          <th className="text-right">Total Masuk</th>
          <th className="text-right">Keluar</th>
          <th className="text-right">Net</th>
          <th className="text-right">Rasio Tabung</th>
          <th className="text-right">Tx</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.year}>
            <td className="font-mono text-[13px] font-semibold tabular">{row.year}</td>
            <td className="text-right font-mono text-[12px] text-accent tabular">
              {formatRupiah(row.incomeSalary)}
            </td>
            <td className="text-right font-mono text-[12px] text-foreground tabular">
              {formatRupiah(row.incomeFreelance)}
            </td>
            <td className="text-right font-mono text-[12px] font-semibold text-foreground tabular">
              {formatRupiah(row.income)}
            </td>
            <td className="text-right font-mono text-[12px] text-danger tabular">
              {formatRupiah(row.expense)}
            </td>
            <td
              className={`text-right font-mono text-[12px] font-semibold tabular ${
                row.net >= 0 ? "text-success" : "text-danger"
              }`}
            >
              {formatRupiah(row.net)}
            </td>
            <td className="text-right font-mono text-[11px] text-muted-foreground tabular">
              {formatPercent(row.savingsRate, 1)}
            </td>
            <td className="text-right font-mono text-[11px] text-muted-foreground tabular">
              {row.txCount}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const TX_LABEL: Record<Transaction["tx_type"], string> = {
  income_salary: "Gaji",
  income_freelance: "Freelance",
  expense: "Keluar",
  transfer: "Transfer",
};

function LedgerTable({
  rows,
  walletName,
  today,
}: {
  rows: readonly Transaction[];
  walletName: Map<string, string>;
  today: string;
}) {
  return (
    <table className="brutal-table">
      <thead>
        <tr>
          <th>Tanggal</th>
          <th>Hari</th>
          <th>Mg</th>
          <th>Bulan</th>
          <th>Jenis</th>
          <th>Kategori</th>
          <th>Barang / Keperluan</th>
          <th>Dompet</th>
          <th>Tujuan</th>
          <th className="text-right">Nominal</th>
          <th>Catatan</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((tx) => (
          <tr key={tx.id} className={tx.tanggal === today ? "bg-surface" : undefined}>
            <td className="font-mono text-[12px] tabular">
              {formatDateShort(tx.tanggal)}
            </td>
            <td className="font-mono text-[11px] text-muted-foreground">{tx.hari}</td>
            <td className="font-mono text-[11px] text-muted-foreground tabular">
              {tx.minggu_ke}
            </td>
            <td className="font-mono text-[11px] text-muted-foreground">{tx.bulan}</td>
            <td>
              <span
                className={`font-mono text-[10px] uppercase tracking-[0.07em] ${
                  tx.tx_type === "expense"
                    ? "text-danger"
                    : tx.tx_type === "income_salary"
                      ? "text-accent"
                      : "text-foreground"
                }`}
              >
                {TX_LABEL[tx.tx_type]}
              </span>
            </td>
            <td className="max-w-[12rem] truncate text-[12px] text-muted-foreground">
              {tx.kategori}
            </td>
            <td className="max-w-[18rem] truncate text-[12px] text-foreground">
              {tx.barang_keperluan}
            </td>
            <td className="text-[12px] text-muted-foreground">
              {tx.wallet_id === null ? "—" : (walletName.get(tx.wallet_id) ?? "—")}
            </td>
            <td className="text-[12px] text-muted-foreground">
              {tx.target_wallet_id === null
                ? "—"
                : (walletName.get(tx.target_wallet_id) ?? "—")}
            </td>
            <td
              className={`text-right font-mono text-[12px] font-semibold tabular ${
                tx.tx_type === "expense" ? "text-danger" : "text-foreground"
              }`}
            >
              {formatRupiah(tx.nominal)}
            </td>
            <td className="max-w-[16rem] truncate text-[11px] text-muted-foreground">
              {tx.catatan ?? "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

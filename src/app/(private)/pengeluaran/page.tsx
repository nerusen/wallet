import type { Metadata } from "next";

import { ExpenseForm } from "@/components/expenses/expense-form";
import { ExpenseTable } from "@/components/expenses/expense-table";
import { LoadError, PageBody, PageHeader } from "@/components/shell/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { RevealOnScroll } from "@/components/ui/motion";
import { WEEKLY_BUDGET_CAP } from "@/lib/constants";
import { formatPercent, formatRupiah, todayWIB } from "@/lib/format";
import {
  evaluateCigaretteGuard,
  expenseByCategory,
  summarizeWeek,
} from "@/lib/finance";
import { fetchSnapshot } from "@/lib/supabase/queries";

export const metadata: Metadata = {
  title: "Pengeluaran",
  description: "Pencatatan pengeluaran harian dengan penjaga kuota rokok.",
};

export const dynamic = "force-dynamic";

export default async function PengeluaranPage() {
  const today = todayWIB();
  const snapshot = await fetchSnapshot({ wallets: true, transactions: true });

  const week = summarizeWeek(snapshot.transactions, today);
  const guard = evaluateCigaretteGuard(snapshot.transactions, today);
  const byCategory = expenseByCategory(snapshot.transactions);

  return (
    <>
      <PageHeader
        eyebrow="Modul 03 · Expense Tracker"
        title="Pengeluaran Harian"
        description="Setiap Rupiah keluar dicatat dengan kategori, dompet sumber, dan catatan. Dua pagar disiplin aktif: batas Rp67.500 per minggu dan kuota 1 bungkus rokok per 3 hari."
        meta={[
          { label: "Belanja Minggu Ini", value: formatRupiah(week.expense) },
          { label: "Batas Mingguan", value: formatRupiah(WEEKLY_BUDGET_CAP) },
          { label: "Pemakaian", value: formatPercent(week.usageRatio, 0) },
          {
            label: "Kuota Rokok",
            value: guard.blocked ? `Tunggu ${guard.daysRemaining} hari` : "Boleh beli",
          },
        ]}
      />

      <PageBody>
        {snapshot.error !== null && <LoadError message={snapshot.error} />}

        <ExpenseForm
          wallets={snapshot.wallets}
          today={today}
          guard={guard}
          week={week}
        />

        <ExpenseTable
          transactions={snapshot.transactions}
          wallets={snapshot.wallets}
          today={today}
        />

        {/* Category breakdown */}
        {byCategory.length > 0 && (
          <RevealOnScroll>
            <Panel>
              <PanelHeader
                code="04"
                eyebrow="Komposisi Pengeluaran"
                title="Distribusi per Kategori"
                description="Akumulasi seluruh periode. Bar menggunakan isian rata tanpa gradien."
              />
              <ul className="divide-grid-y">
                {byCategory.map((item) => (
                  <li key={item.kategori} className="px-4 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-[12px] text-foreground">
                        {item.kategori}
                      </span>
                      <span className="flex shrink-0 items-baseline gap-3">
                        <span className="font-mono text-[10px] text-muted-foreground tabular">
                          {item.count}×
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground tabular">
                          {formatPercent(item.share, 1)}
                        </span>
                        <span className="font-mono text-[12px] font-semibold text-foreground tabular">
                          {formatRupiah(item.total)}
                        </span>
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full border border-border bg-surface">
                      <span
                        aria-hidden
                        className="block h-full bg-foreground"
                        style={{ width: `${Math.min(item.share * 100, 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          </RevealOnScroll>
        )}
      </PageBody>
    </>
  );
}

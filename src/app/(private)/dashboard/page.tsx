import type { Metadata } from "next";
import Link from "next/link";

import { KpiCell, KpiGrid } from "@/components/dashboard/kpi-cell";
import { MountainChart } from "@/components/dashboard/mountain-chart";
import { SummaryTables } from "@/components/dashboard/summary-tables";
import { WalletsStrip } from "@/components/dashboard/wallets-strip";
import { LoadError, PageBody, PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/motion";
import { WEEKLY_BUDGET_CAP } from "@/lib/constants";
import {
  formatDateShort,
  formatPercentSigned,
  formatRupiah,
  todayWIB,
} from "@/lib/format";
import { BUDGET_STATUS_LABEL, computeDashboardKpis } from "@/lib/finance";
import { fetchSnapshot } from "@/lib/supabase/queries";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Ringkasan KPI, arus kas, dan saldo dompet.",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const today = todayWIB();
  const snapshot = await fetchSnapshot({ wallets: true, transactions: true });
  const kpis = computeDashboardKpis(snapshot.transactions, snapshot.wallets, today);

  const weekTone =
    kpis.week.status === "lewat"
      ? "danger"
      : kpis.week.status === "waspada"
        ? "warning"
        : "success";

  return (
    <>
      <PageHeader
        eyebrow="Modul 01 · Overview"
        title="Command Center"
        description="Satu layar untuk melihat seluruh posisi keuangan: pemasukan, pengeluaran, batas mingguan, dan progres Dana Darurat."
        actions={
          <>
            <Button asChild variant="accent" size="sm">
              <Link href="/pengeluaran">Catat Pengeluaran</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/pemasukan">Catat Pemasukan</Link>
            </Button>
          </>
        }
        meta={[
          { label: "Tanggal", value: formatDateShort(today) },
          {
            label: "Minggu Berjalan",
            value: `${formatDateShort(kpis.week.startDate)} – ${formatDateShort(kpis.week.endDate)}`,
          },
          { label: "Total Transaksi", value: String(snapshot.transactions.length) },
          { label: "Dompet Aktif", value: `${snapshot.wallets.length}/5` },
        ]}
      />

      <PageBody>
        {snapshot.error !== null && <LoadError message={snapshot.error} />}

        {/* ── KPI grid: 4 columns, shared 1px lattice ── */}
        <Reveal>
          <KpiGrid>
            <KpiCell
              code="01"
              eyebrow="Total Pemasukan Gaji"
              value={formatRupiah(kpis.salaryTotal)}
              delta={
                kpis.salaryGrowth === 0
                  ? undefined
                  : `${formatPercentSigned(kpis.salaryGrowth, 1)} MoM`
              }
              deltaTone={kpis.salaryGrowth >= 0 ? "success" : "danger"}
              footnote="Akumulasi gaji utama, part-time, dan saldo awal sejak 13 Nov 2026."
            />

            <KpiCell
              code="02"
              eyebrow="Total Pemasukan Freelance"
              value={formatRupiah(kpis.freelanceTotal)}
              badge={
                kpis.freelanceFrozen > 0
                  ? { label: "Dibekukan", tone: "warning" }
                  : { label: "Bersih", tone: "neutral" }
              }
              footnote={
                kpis.freelanceFrozen > 0
                  ? `${formatRupiah(kpis.freelanceFrozen)} menunggu tanggal 1 (${formatDateShort(kpis.freelanceUnlockDate)}).`
                  : "Tidak ada dana freelance yang sedang dibekukan."
              }
            />

            <KpiCell
              code="03"
              eyebrow="Total Pengeluaran"
              value={formatRupiah(kpis.expenseTotal)}
              progress={kpis.week.usageRatio}
              progressTone={
                kpis.week.status === "lewat"
                  ? "danger"
                  : kpis.week.status === "waspada"
                    ? "warning"
                    : "accent"
              }
              badge={{ label: BUDGET_STATUS_LABEL[kpis.week.status], tone: weekTone }}
              footnote={`Minggu ini ${formatRupiah(kpis.week.expense)} dari batas ${formatRupiah(WEEKLY_BUDGET_CAP)}.`}
            />

            <KpiCell
              code="04"
              eyebrow="Saldo Bersih & Dana Darurat"
              value={formatRupiah(kpis.totalBalance)}
              progress={kpis.emergencyProgress}
              progressTone="accent"
              footnote={`Dana Darurat ${formatRupiah(kpis.emergencyBalance)} dari target ${formatRupiah(kpis.emergencyTarget)}.`}
            />
          </KpiGrid>
        </Reveal>

        {/* ── Mountain chart ── */}
        <Reveal delay={0.08}>
          <MountainChart transactions={snapshot.transactions} today={today} />
        </Reveal>

        {/* ── Daily + weekly summaries ── */}
        <SummaryTables today={kpis.today} week={kpis.week} todayISO={today} />

        {/* ── Wallet snapshot strip ── */}
        <WalletsStrip wallets={snapshot.wallets} />
      </PageBody>
    </>
  );
}

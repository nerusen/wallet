import type { Metadata } from "next";

import { CsvPanel } from "@/components/reports/csv-panel";
import { LedgerTabs } from "@/components/reports/ledger-tabs";
import { LoadError, PageBody, PageHeader } from "@/components/shell/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Reveal, RevealOnScroll } from "@/components/ui/motion";
import { SYSTEM_HORIZON_DATE, SYSTEM_START_DATE } from "@/lib/constants";
import { formatDateShort, formatRupiah, todayWIB } from "@/lib/format";
import { sum } from "@/lib/finance";
import { fetchSnapshot } from "@/lib/supabase/queries";

export const metadata: Metadata = {
  title: "Laporan & CSV",
  description: "Buku besar historis, rollup periodik, serta impor dan ekspor CSV.",
};

export const dynamic = "force-dynamic";

export default async function LaporanPage() {
  const today = todayWIB();
  const snapshot = await fetchSnapshot({ wallets: true, transactions: true });

  const income = sum(
    snapshot.transactions
      .filter(
        (tx) =>
          tx.tx_type === "income_salary" || tx.tx_type === "income_freelance",
      )
      .map((tx) => tx.nominal),
  );
  const expense = sum(
    snapshot.transactions.filter((tx) => tx.tx_type === "expense").map((tx) => tx.nominal),
  );

  const dates = snapshot.transactions.map((tx) => tx.tanggal).sort();
  const firstDate = dates[0] ?? SYSTEM_START_DATE;
  const lastDate = dates[dates.length - 1] ?? today;

  return (
    <>
      <PageHeader
        eyebrow="Modul 06 · Ledger"
        title="Laporan & Import CSV"
        description={`Timeline lengkap sejak ${formatDateShort(SYSTEM_START_DATE)} hingga ${formatDateShort(SYSTEM_HORIZON_DATE)} dan seterusnya, dengan rollup harian, mingguan, bulanan, dan tahunan yang dihitung otomatis.`}
        meta={[
          { label: "Rentang Data", value: `${formatDateShort(firstDate)} – ${formatDateShort(lastDate)}` },
          { label: "Total Pemasukan", value: formatRupiah(income) },
          { label: "Total Pengeluaran", value: formatRupiah(expense) },
          { label: "Net Kumulatif", value: formatRupiah(income - expense) },
        ]}
      />

      <PageBody>
        {snapshot.error !== null && <LoadError message={snapshot.error} />}

        <Reveal>
          <CsvPanel today={today} />
        </Reveal>

        <LedgerTabs
          transactions={snapshot.transactions}
          wallets={snapshot.wallets}
          today={today}
        />

        <RevealOnScroll>
          <Panel>
            <PanelHeader
              code="04"
              eyebrow="Format Berkas"
              title="Contoh Baris CSV"
              description="Gunakan format ini untuk menyiapkan berkas impor secara manual."
            />
            <div className="table-scroll border-t border-border">
              <pre className="min-w-max px-4 py-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
{`tanggal,tx_type,kategori,barang_keperluan,nominal,dompet,dompet_tujuan,is_frozen_freelance,catatan
2026-11-13,income_salary,Saldo Awal,Saldo awal kas,450000,Dana Darurat,,false,Baseline sistem
2026-11-13,expense,Pelunasan Utang,Pelunasan DANA PayLater,130000,Dana Darurat,,false,Utang ditutup
2026-11-16,income_salary,Gaji Utama,Gaji minggu ke-3,450000,Operasional Harian,,false,
2026-11-17,expense,Konsumsi & Jajan,Makan siang,12000,Operasional Harian,,false,
2026-11-18,transfer,Transfer Antar Dompet,Top-up investasi,50000,Operasional Harian,Investasi Pemula,false,
2026-11-20,income_freelance,Proyek Desain,Desain logo UMKM,750000,Kantong Freelance,,true,Klien: Toko Melati`}
              </pre>
            </div>
          </Panel>
        </RevealOnScroll>
      </PageBody>
    </>
  );
}

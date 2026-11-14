import type { Metadata } from "next";

import { IncomeTabs } from "@/components/income/income-tabs";
import { LoadError, PageBody, PageHeader } from "@/components/shell/page-header";
import { Panel, PanelHeader, EmptyState } from "@/components/ui/panel";
import { RevealOnScroll } from "@/components/ui/motion";
import { formatDateShort, formatRupiah, todayWIB } from "@/lib/format";
import { sum } from "@/lib/finance";
import { fetchSnapshot } from "@/lib/supabase/queries";

export const metadata: Metadata = {
  title: "Pemasukan",
  description: "Pencatatan gaji, part-time, dan proyek freelance.",
};

export const dynamic = "force-dynamic";

export default async function PemasukanPage() {
  const today = todayWIB();
  const snapshot = await fetchSnapshot({ wallets: true, transactions: true });

  const salaryRows = snapshot.transactions.filter(
    (tx) => tx.tx_type === "income_salary",
  );
  const freelanceRows = snapshot.transactions.filter(
    (tx) => tx.tx_type === "income_freelance",
  );

  const salaryTotal = sum(salaryRows.map((tx) => tx.nominal));
  const freelanceTotal = sum(freelanceRows.map((tx) => tx.nominal));
  const frozenTotal = sum(
    freelanceRows.filter((tx) => tx.is_frozen_freelance).map((tx) => tx.nominal),
  );

  const recent = [...salaryRows, ...freelanceRows]
    .sort((a, b) =>
      a.tanggal < b.tanggal ? 1 : a.tanggal > b.tanggal ? -1 : 0,
    )
    .slice(0, 20);

  const walletName = new Map(snapshot.wallets.map((w) => [w.id, w.name]));

  return (
    <>
      <PageHeader
        eyebrow="Modul 02 · Income Tracker"
        title="Pemasukan"
        description="Dua aliran pemasukan dipisah tegas: gaji yang dipecah otomatis setiap Senin 08:00 WIB, dan freelance yang dibekukan sampai tanggal 1 bulan berikutnya."
        meta={[
          { label: "Total Gaji", value: formatRupiah(salaryTotal) },
          { label: "Total Freelance", value: formatRupiah(freelanceTotal) },
          { label: "Freelance Beku", value: formatRupiah(frozenTotal) },
          {
            label: "Total Pemasukan",
            value: formatRupiah(salaryTotal + freelanceTotal),
          },
        ]}
      />

      <PageBody>
        {snapshot.error !== null && <LoadError message={snapshot.error} />}

        <IncomeTabs
          wallets={snapshot.wallets}
          transactions={snapshot.transactions}
          today={today}
          salaryCount={salaryRows.length}
          freelanceCount={freelanceRows.length}
        />

        {/* Recent income ledger */}
        <RevealOnScroll>
          <Panel>
            <PanelHeader
              code="04"
              eyebrow="Riwayat Terakhir"
              title="20 Pemasukan Terbaru"
              description="Gabungan gaji dan freelance, diurutkan dari yang terbaru."
            />
            {recent.length === 0 ? (
              <EmptyState
                title="Belum ada pemasukan"
                description="Catat gaji atau proyek freelance pertama untuk mengisi buku besar."
              />
            ) : (
              <div className="table-scroll">
                <table className="brutal-table">
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Hari</th>
                      <th>Jenis</th>
                      <th>Kategori</th>
                      <th>Keterangan</th>
                      <th>Dompet</th>
                      <th className="text-right">Nominal</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((tx) => (
                      <tr key={tx.id}>
                        <td className="font-mono text-[12px] tabular">
                          {formatDateShort(tx.tanggal)}
                        </td>
                        <td className="font-mono text-[11px] text-muted-foreground">
                          {tx.hari}
                        </td>
                        <td>
                          <span
                            className={`font-mono text-[10px] uppercase tracking-[0.07em] ${
                              tx.tx_type === "income_salary"
                                ? "text-accent"
                                : "text-foreground"
                            }`}
                          >
                            {tx.tx_type === "income_salary" ? "Gaji" : "Freelance"}
                          </span>
                        </td>
                        <td className="text-[12px] text-muted-foreground">
                          {tx.kategori}
                        </td>
                        <td className="max-w-[18rem] truncate text-[12px] text-foreground">
                          {tx.barang_keperluan}
                        </td>
                        <td className="text-[12px] text-muted-foreground">
                          {tx.wallet_id === null
                            ? "—"
                            : (walletName.get(tx.wallet_id) ?? "—")}
                        </td>
                        <td className="text-right font-mono text-[12px] font-semibold text-foreground tabular">
                          {formatRupiah(tx.nominal)}
                        </td>
                        <td>
                          <span className="flex items-center gap-2">
                            <span
                              aria-hidden
                              className="status-dot"
                              data-tone={tx.is_frozen_freelance ? "warning" : "success"}
                            />
                            <span className="font-mono text-[10px] uppercase tracking-[0.07em] text-muted-foreground">
                              {tx.is_frozen_freelance ? "Beku" : "Cair"}
                            </span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={6} className="font-mono text-[11px] uppercase tracking-[0.08em]">
                        Subtotal {recent.length} baris
                      </td>
                      <td className="text-right font-mono text-[13px] tabular">
                        {formatRupiah(sum(recent.map((tx) => tx.nominal)))}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Panel>
        </RevealOnScroll>
      </PageBody>
    </>
  );
}

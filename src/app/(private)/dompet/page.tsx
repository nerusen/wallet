import type { Metadata } from "next";

import { LoadError, PageBody, PageHeader } from "@/components/shell/page-header";
import { WalletManager } from "@/components/wallets/wallet-manager";
import { Panel, PanelHeader, EmptyState } from "@/components/ui/panel";
import { RevealOnScroll } from "@/components/ui/motion";
import { MAX_WALLETS } from "@/lib/constants";
import { formatDateShort, formatRupiah, todayWIB } from "@/lib/format";
import { sum } from "@/lib/finance";
import { fetchSnapshot } from "@/lib/supabase/queries";

export const metadata: Metadata = {
  title: "Dompet & Brankas",
  description: "Kelola maksimal 5 dompet dan transfer saldo antar kantong.",
};

export const dynamic = "force-dynamic";

export default async function DompetPage() {
  const today = todayWIB();
  const snapshot = await fetchSnapshot({ wallets: true, transactions: true });

  const totalBalance = sum(snapshot.wallets.map((w) => w.balance));
  const totalTarget = sum(snapshot.wallets.map((w) => w.target_amount ?? 0));

  const transfers = snapshot.transactions
    .filter((tx) => tx.tx_type === "transfer")
    .slice(0, 15);

  const walletName = new Map(snapshot.wallets.map((w) => [w.id, w.name]));

  return (
    <>
      <PageHeader
        eyebrow="Modul 05 · Vaults"
        title="Dompet & Brankas"
        description="Maksimal 5 dompet, dipaksakan di level database oleh trigger enforce_max_5_wallets(). Saldo selalu merupakan hasil penjumlahan buku besar, bukan angka yang diketik manual."
        meta={[
          { label: "Slot Terpakai", value: `${snapshot.wallets.length}/${MAX_WALLETS}` },
          { label: "Total Saldo", value: formatRupiah(totalBalance) },
          { label: "Total Target", value: formatRupiah(totalTarget) },
          {
            label: "Progres Agregat",
            value:
              totalTarget > 0
                ? `${Math.round((totalBalance / totalTarget) * 100)}%`
                : "—",
          },
        ]}
      />

      <PageBody>
        {snapshot.error !== null && <LoadError message={snapshot.error} />}

        <WalletManager wallets={snapshot.wallets} today={today} />

        <RevealOnScroll>
          <Panel id="transfer">
            <PanelHeader
              code="02"
              eyebrow="Riwayat Mutasi"
              title="15 Transfer Terakhir"
              description="Setiap transfer adalah satu baris: keluar dari sumber, masuk ke tujuan, nominal identik."
            />
            {transfers.length === 0 ? (
              <EmptyState
                title="Belum ada transfer"
                description="Gunakan tombol Transfer di atas untuk memindahkan saldo antar dompet."
              />
            ) : (
              <div className="table-scroll">
                <table className="brutal-table">
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Dari</th>
                      <th>Ke</th>
                      <th>Keterangan</th>
                      <th className="text-right">Nominal</th>
                      <th>Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transfers.map((tx) => (
                      <tr key={tx.id}>
                        <td className="font-mono text-[12px] tabular">
                          {formatDateShort(tx.tanggal)}
                        </td>
                        <td className="text-[12px] text-danger">
                          {tx.wallet_id === null
                            ? "—"
                            : (walletName.get(tx.wallet_id) ?? "—")}
                        </td>
                        <td className="text-[12px] text-accent">
                          {tx.target_wallet_id === null
                            ? "—"
                            : (walletName.get(tx.target_wallet_id) ?? "—")}
                        </td>
                        <td className="max-w-[18rem] truncate text-[12px] text-foreground">
                          {tx.barang_keperluan}
                        </td>
                        <td className="text-right font-mono text-[12px] font-semibold text-foreground tabular">
                          {formatRupiah(tx.nominal)}
                        </td>
                        <td className="max-w-[16rem] truncate text-[11px] text-muted-foreground">
                          {tx.catatan ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </RevealOnScroll>
      </PageBody>
    </>
  );
}

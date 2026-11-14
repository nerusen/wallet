import Link from "next/link";

import { Badge, Panel, PanelHeader, ProgressRail } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { StaggerGrid, StaggerItem } from "@/components/ui/motion";
import { MAX_WALLETS } from "@/lib/constants";
import { formatPercent, formatRupiah } from "@/lib/format";
import { walletProgress } from "@/lib/finance";
import type { Wallet } from "@/lib/types/database";

const CATEGORY_LABEL: Record<Wallet["category"], string> = {
  darurat: "Darurat",
  operasional: "Operasional",
  produktif: "Produktif",
  investasi: "Investasi",
  freelance: "Freelance",
};

/**
 * Wallet snapshot strip.
 *
 * Shows up to 5 live balances. Only wallets explicitly tagged `accent_tag:
 * 'green'` use the #51CD85 progress fill; everything else stays monochrome,
 * which keeps the accent selective rather than decorative.
 */
export function WalletsStrip({ wallets }: { wallets: readonly Wallet[] }) {
  return (
    <Panel>
      <PanelHeader
        code="05"
        eyebrow="Dompet Aktif"
        title="Snapshot Saldo Realtime"
        description={`${wallets.length}/${MAX_WALLETS} slot terpakai. Saldo diperbarui langsung oleh trigger database.`}
        actions={
          <>
            {/* Adjacent-button rule: only one accent fill in this pair. */}
            <Button asChild variant="accent" size="sm">
              <Link href="/dompet">Kelola Dompet</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dompet#transfer">Transfer</Link>
            </Button>
          </>
        }
      />

      {wallets.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            Belum ada dompet
          </p>
          <p className="mt-2 text-[12px] text-muted-foreground">
            Jalankan migrasi Supabase untuk membuat 5 dompet bawaan.
          </p>
        </div>
      ) : (
        <StaggerGrid
          scroll
          className="outline-grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
        >
          {wallets.map((wallet) => {
            const progress = walletProgress(wallet);
            const isAccent = wallet.accent_tag === "green";
            const target = wallet.target_amount ?? 0;

            return (
              <StaggerItem key={wallet.id} className="flex flex-col gap-3 bg-background p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="eyebrow min-w-0 truncate">
                    {CATEGORY_LABEL[wallet.category]}
                  </span>
                  {isAccent && <Badge tone="accent">Fokus</Badge>}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-foreground">
                    {wallet.name}
                  </p>
                  <p className="mt-1.5 font-mono text-[16px] font-semibold text-foreground tabular">
                    {formatRupiah(wallet.balance)}
                  </p>
                </div>

                {target > 0 && (
                  <div className="mt-auto">
                    <ProgressRail
                      value={progress}
                      tone={isAccent ? "accent" : "mono"}
                    />
                    <div className="mt-2 flex items-baseline justify-between gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground tabular">
                        {formatPercent(progress, 0)}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground tabular">
                        / {formatRupiah(target)}
                      </span>
                    </div>
                  </div>
                )}
              </StaggerItem>
            );
          })}
        </StaggerGrid>
      )}
    </Panel>
  );
}

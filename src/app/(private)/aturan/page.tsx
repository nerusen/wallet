import type { Metadata } from "next";

import { AuditWidget } from "@/components/rules/audit-widget";
import { LoadError, PageBody, PageHeader } from "@/components/shell/page-header";
import { Badge, Panel, PanelHeader } from "@/components/ui/panel";
import { RevealOnScroll, StaggerGrid, StaggerItem } from "@/components/ui/motion";
import {
  CORE_RULES,
  EVENING_AUDIT_HOUR,
  MONDAY_SPLIT_HOUR,
  SALARY_SPLIT_RULES,
  WEEKLY_BUDGET_CAP,
} from "@/lib/constants";
import { formatDateShort, formatRupiah, todayWIB } from "@/lib/format";
import { computeStreak, evaluateCigaretteGuard, summarizeWeek } from "@/lib/finance";
import { fetchSnapshot } from "@/lib/supabase/queries";

export const metadata: Metadata = {
  title: "SOP & Audit",
  description: "Audit harian 21:00 WIB, pecah gaji Senin, dan streak disiplin.",
};

export const dynamic = "force-dynamic";

export default async function AturanPage() {
  const today = todayWIB();
  const snapshot = await fetchSnapshot({
    wallets: false,
    transactions: true,
    audits: true,
  });

  const streak = computeStreak(snapshot.audits, today);
  const todayAudit = snapshot.audits.find((a) => a.audit_date === today);
  const week = summarizeWeek(snapshot.transactions, today);
  const guard = evaluateCigaretteGuard(snapshot.transactions, today);

  return (
    <>
      <PageHeader
        eyebrow="Modul 07 · SOP Engine"
        title="SOP & Audit Harian"
        description={`Disiplin dicatat, bukan diingat. Dua ritual wajib: audit malam pukul ${String(EVENING_AUDIT_HOUR).padStart(2, "0")}:00 WIB setiap hari, dan pecah gaji pukul ${String(MONDAY_SPLIT_HOUR).padStart(2, "0")}:00 WIB setiap Senin.`}
        meta={[
          { label: "Streak Saat Ini", value: `${streak.current} hari` },
          { label: "Streak Terpanjang", value: `${streak.longest} hari` },
          { label: "Audit Hari Ini", value: streak.todayDone ? "Selesai" : "Belum" },
          {
            label: "Audit Terakhir",
            value:
              streak.lastAuditDate === null
                ? "—"
                : formatDateShort(streak.lastAuditDate),
          },
        ]}
      />

      <PageBody>
        {snapshot.error !== null && <LoadError message={snapshot.error} />}

        <AuditWidget
          todayAudit={todayAudit}
          streak={streak}
          today={today}
          recent={snapshot.audits}
        />

        {/* ── Live rule status ── */}
        <RevealOnScroll>
          <Panel>
            <PanelHeader
              code="03"
              eyebrow="Status Pagar Disiplin"
              title="Kondisi Aturan Saat Ini"
              description="Dihitung langsung dari buku besar, bukan diisi manual."
            />
            <div className="outline-grid grid-cols-1 border-t-0 sm:grid-cols-2 xl:grid-cols-3">
              <div className="bg-background p-4">
                <span className="eyebrow">Batas Mingguan</span>
                <p className="mt-2.5 font-mono text-[18px] font-semibold text-foreground tabular">
                  {formatRupiah(week.expense)}
                </p>
                <p className="mt-1.5 font-mono text-[11px] text-muted-foreground tabular">
                  dari {formatRupiah(WEEKLY_BUDGET_CAP)}
                </p>
                <div className="mt-3">
                  <Badge
                    tone={
                      week.status === "lewat"
                        ? "danger"
                        : week.status === "waspada"
                          ? "warning"
                          : "success"
                    }
                  >
                    {week.status === "lewat"
                      ? `Lewat ${formatRupiah(Math.abs(week.remaining))}`
                      : `Sisa ${formatRupiah(week.remaining)}`}
                  </Badge>
                </div>
              </div>

              <div className="bg-background p-4">
                <span className="eyebrow">Kuota Rokok</span>
                <p className="mt-2.5 font-mono text-[18px] font-semibold text-foreground tabular">
                  {week.cigarettePacks} bungkus
                </p>
                <p className="mt-1.5 font-mono text-[11px] text-muted-foreground tabular">
                  minggu ini · {formatRupiah(week.cigaretteSpend)}
                </p>
                <div className="mt-3">
                  <Badge tone={guard.blocked ? "warning" : "success"}>
                    {guard.blocked
                      ? `Tunggu ${guard.daysRemaining} hari`
                      : "Kuota terpenuhi"}
                  </Badge>
                </div>
              </div>

              <div className="bg-background p-4">
                <span className="eyebrow">Pecah Gaji Senin</span>
                <p className="mt-2.5 font-mono text-[18px] font-semibold text-foreground tabular">
                  {todayAudit?.monday_split_done === true ? "Selesai" : "Belum"}
                </p>
                <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
                  35 / 25 / 20 / 15 / 5
                </p>
                <div className="mt-3">
                  <Badge
                    tone={todayAudit?.monday_split_done === true ? "success" : "neutral"}
                  >
                    {String(MONDAY_SPLIT_HOUR).padStart(2, "0")}:00 WIB
                  </Badge>
                </div>
              </div>
            </div>
          </Panel>
        </RevealOnScroll>

        {/* ── Split reference ── */}
        <RevealOnScroll>
          <Panel>
            <PanelHeader
              code="04"
              eyebrow="Referensi Alokasi"
              title="Formula Pecah Gaji"
              description="Rasio tetap. Pos terakhir menyerap sisa pembulatan agar total selalu presisi."
            />
            <div className="table-scroll">
              <table className="brutal-table">
                <thead>
                  <tr>
                    <th>Pos</th>
                    <th className="text-right">Rasio</th>
                    <th>Dompet Tujuan</th>
                    <th>Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {SALARY_SPLIT_RULES.map((rule) => (
                    <tr key={rule.key}>
                      <td className="text-[12px] font-medium text-foreground">
                        {rule.label}
                      </td>
                      <td className="text-right font-mono text-[12px] font-semibold text-accent tabular">
                        {Math.round(rule.ratio * 100)}%
                      </td>
                      <td className="font-mono text-[11px] text-muted-foreground">
                        {rule.walletCategory ?? "operasional (titipan)"}
                      </td>
                      <td className="max-w-[22rem] !whitespace-normal text-[11px] leading-relaxed text-muted-foreground">
                        {rule.note}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="font-mono text-[11px] uppercase tracking-[0.08em]">
                      Total
                    </td>
                    <td className="text-right font-mono text-[12px] tabular">100%</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Panel>
        </RevealOnScroll>

        {/* ── Core rules ── */}
        <RevealOnScroll>
          <Panel>
            <PanelHeader
              code="05"
              eyebrow="Aturan Inti"
              title="Standard Operating Procedure"
              description="Delapan aturan yang tidak dinegosiasikan. Beberapa dipaksakan langsung di level database."
            />
            <StaggerGrid
              scroll
              className="outline-grid grid-cols-1 border-t-0 sm:grid-cols-2"
            >
              {CORE_RULES.map((rule) => (
                <StaggerItem key={rule.code} className="bg-background p-4">
                  <div className="flex items-start gap-3">
                    <span className="eyebrow eyebrow-accent mt-0.5 shrink-0 border border-border px-1.5 py-1">
                      {rule.code}
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-[13px] font-semibold leading-snug text-foreground">
                        {rule.title}
                      </h4>
                      <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                        {rule.detail}
                      </p>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </StaggerGrid>
          </Panel>
        </RevealOnScroll>
      </PageBody>
    </>
  );
}

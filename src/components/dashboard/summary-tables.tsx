
import { Badge, Panel, PanelHeader, ProgressRail } from "@/components/ui/panel";
import { RevealOnScroll } from "@/components/ui/motion";
import { CIGARETTE_MAX_PRICE, DAILY_ALLOWANCE, WEEKLY_BUDGET_CAP } from "@/lib/constants";
import {
  formatDateLong,
  formatDateShort,
  formatPercent,
  formatRupiah,
} from "@/lib/format";
import {
  BUDGET_STATUS_LABEL,
  type DailySummary,
  type WeeklySummary,
} from "@/lib/finance";

/**
 * Side-by-side daily + weekly summary tables.
 *
 * Server Component: these are pure projections of the already-fetched ledger,
 * so there is no reason to ship the arithmetic to the browser.
 */
export function SummaryTables({
  today,
  week,
  todayISO,
}: {
  today: DailySummary;
  week: WeeklySummary;
  todayISO: string;
}) {
  const statusTone =
    week.status === "lewat" ? "danger" : week.status === "waspada" ? "warning" : "success";

  return (
    <div className="outline-grid grid-cols-1 lg:grid-cols-2">
      {/* ── Today ── */}
      <RevealOnScroll className="bg-background">
        <Panel className="h-full border-0">
          <PanelHeader
            code="03"
            eyebrow="Rangkuman Hari Ini"
            title={formatDateLong(todayISO)}
            actions={
              <Badge tone={today.remainingAllowance >= 0 ? "success" : "danger"}>
                {today.remainingAllowance >= 0 ? "Dalam Jatah" : "Lewat Jatah"}
              </Badge>
            }
          />
          <div className="table-scroll">
            <table className="brutal-table">
              <tbody>
                <Row label="Pemasukan Masuk" value={formatRupiah(today.income)} />
                <Row
                  label="Gaji / Part-Time"
                  value={formatRupiah(today.incomeSalary)}
                  muted
                />
                <Row
                  label="Freelance"
                  value={formatRupiah(today.incomeFreelance)}
                  muted
                />
                <Row
                  label="Pengeluaran Keluar"
                  value={formatRupiah(today.expense)}
                  tone={today.expense > 0 ? "danger" : "neutral"}
                />
                <Row
                  label="Net Hari Ini"
                  value={formatRupiah(today.net)}
                  tone={today.net >= 0 ? "success" : "danger"}
                  strong
                />
                <Row
                  label="Jatah Harian Tersisa"
                  value={formatRupiah(today.remainingAllowance)}
                  hint={`dari ${formatRupiah(DAILY_ALLOWANCE)}`}
                  tone={today.remainingAllowance >= 0 ? "success" : "danger"}
                  strong
                />
                <Row label="Jumlah Transaksi" value={`${today.txCount}`} muted />
              </tbody>
            </table>
          </div>
        </Panel>
      </RevealOnScroll>

      {/* ── Running week ── */}
      <RevealOnScroll delay={0.06} className="bg-background">
        <Panel className="h-full border-0">
          <PanelHeader
            code="04"
            eyebrow="Rangkuman Minggu Berjalan"
            title={`${formatDateShort(week.startDate)} – ${formatDateShort(week.endDate)}`}
            actions={<Badge tone={statusTone}>{BUDGET_STATUS_LABEL[week.status]}</Badge>}
          />

          <div className="border-b border-border px-4 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="eyebrow">Pemakaian Batas Mingguan</span>
              <span className="font-mono text-[11px] text-foreground tabular">
                {formatPercent(week.usageRatio, 0)}
              </span>
            </div>
            <ProgressRail
              value={week.usageRatio}
              tone={
                week.status === "lewat"
                  ? "danger"
                  : week.status === "waspada"
                    ? "warning"
                    : "accent"
              }
              className="mt-2.5"
            />
            <p className="mt-2 font-mono text-[10px] text-muted-foreground tabular">
              {formatRupiah(week.expense)} / {formatRupiah(WEEKLY_BUDGET_CAP)}
            </p>
          </div>

          <div className="table-scroll">
            <table className="brutal-table">
              <tbody>
                <Row label="Realisasi Belanja" value={formatRupiah(week.expense)} />
                <Row
                  label="Batas Mingguan"
                  value={formatRupiah(week.cap)}
                  muted
                />
                <Row
                  label={week.remaining >= 0 ? "Sisa Batas" : "Kelebihan"}
                  value={formatRupiah(Math.abs(week.remaining))}
                  tone={week.remaining >= 0 ? "success" : "danger"}
                  strong
                />
                <Row label="Pemasukan Minggu Ini" value={formatRupiah(week.income)} />
                <Row
                  label="Net Minggu Ini"
                  value={formatRupiah(week.net)}
                  tone={week.net >= 0 ? "success" : "danger"}
                  strong
                />
                <Row
                  label="Bungkus Rokok"
                  value={`${week.cigarettePacks} bungkus`}
                  hint={`${formatRupiah(week.cigaretteSpend)} · maks ${formatRupiah(CIGARETTE_MAX_PRICE)}/bungkus`}
                  tone={week.cigarettePacks > 3 ? "warning" : "neutral"}
                />
                <Row label="Jumlah Transaksi" value={`${week.txCount}`} muted />
              </tbody>
            </table>
          </div>
        </Panel>
      </RevealOnScroll>
    </div>
  );
}

function Row({
  label,
  value,
  hint,
  tone = "neutral",
  strong = false,
  muted = false,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "success" | "warning" | "danger";
  strong?: boolean;
  muted?: boolean;
}) {
  const toneClass = {
    neutral: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
  }[tone];

  return (
    <tr>
      <th
        scope="row"
        className={`!normal-case !tracking-normal ${
          muted ? "!text-[11px] !text-muted-foreground" : "!text-[12px] !text-foreground"
        } !bg-transparent !font-sans !font-normal`}
      >
        {label}
        {hint !== undefined && (
          <span className="ml-2 font-mono text-[10px] text-muted-foreground/70">
            {hint}
          </span>
        )}
      </th>
      <td
        className={`text-right font-mono tabular ${
          strong ? "text-[13px] font-semibold" : "text-[12px]"
        } ${toneClass}`}
      >
        {value}
      </td>
    </tr>
  );
}

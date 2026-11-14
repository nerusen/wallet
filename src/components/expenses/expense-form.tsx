"use client";

import { AlertTriangle, Cigarette, Loader2 } from "lucide-react";
import * as React from "react";

import { createExpenseAction } from "@/app/actions/transactions";
import { Button, MotionButton } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import {
  Badge,
  Panel,
  PanelBody,
  PanelFooter,
  PanelHeader,
  ProgressRail,
} from "@/components/ui/panel";
import {
  CIGARETTE_CATEGORY,
  CIGARETTE_MAX_PRICE,
  EXPENSE_CATEGORIES,
  WEEKLY_BUDGET_CAP,
} from "@/lib/constants";
import { formatDateShort, formatPercent, formatRupiah, parseRupiahInput } from "@/lib/format";
import type { CigaretteGuard, WeeklySummary } from "@/lib/finance";
import type { Wallet } from "@/lib/types/database";

/**
 * Expense entry form.
 *
 * Two guards are surfaced inline rather than after submission:
 *  • Cigarette quota (rule R04): a flat #EAB308 banner when < 3 days have
 *    passed since the last pack, plus a price warning above Rp12.000.
 *  • Weekly cap (rule R03): a live projection of what this entry does to the
 *    Rp67.500 weekly budget.
 *
 * Both are advisory. Nothing is blocked — the user owns the decision; the
 * system's job is to make the consequence impossible to miss.
 */
export function ExpenseForm({
  wallets,
  today,
  guard,
  week,
}: {
  wallets: readonly Wallet[];
  today: string;
  guard: CigaretteGuard;
  week: WeeklySummary;
}) {
  const [kategori, setKategori] = React.useState<string>(EXPENSE_CATEGORIES[1]);
  const [nominal, setNominal] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [feedback, setFeedback] = React.useState<
    { tone: "ok" | "error"; message: string } | null
  >(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  const amount = parseRupiahInput(nominal);
  const isCigarette = kategori === CIGARETTE_CATEGORY;
  const overPackPrice = isCigarette && amount > CIGARETTE_MAX_PRICE;

  const projectedExpense = week.expense + amount;
  const projectedRatio =
    WEEKLY_BUDGET_CAP > 0 ? projectedExpense / WEEKLY_BUDGET_CAP : 0;
  const projectedOver = projectedExpense > WEEKLY_BUDGET_CAP;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFeedback(null);

    const result = await createExpenseAction(new FormData(event.currentTarget));
    setPending(false);

    if (result.ok) {
      setFeedback({ tone: "ok", message: result.message ?? "Tersimpan." });
      formRef.current?.reset();
      setNominal("");
    } else {
      setFeedback({ tone: "error", message: result.error });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Cigarette quota guard banner ── */}
      {guard.blocked && (
        <div
          role="alert"
          className="flex items-start gap-3 border border-warning bg-surface px-4 py-3"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <div className="min-w-0">
            <p className="eyebrow text-warning">
              Peringatan Kuota Rokok · 1 Bungkus / 3 Hari
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-foreground">
              {guard.message}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Badge tone="warning">
                Sisa {guard.daysRemaining} hari
              </Badge>
              <Badge tone="neutral">
                {guard.packsThisWeek} bungkus minggu ini
              </Badge>
              <Badge tone="neutral">
                {formatRupiah(guard.spendThisWeek)} terpakai
              </Badge>
            </div>
          </div>
        </div>
      )}

      <div className="outline-grid grid-cols-1 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {/* ── Form ── */}
        <div className="bg-background">
          <Panel className="h-full border-0">
            <PanelHeader
              code="01"
              eyebrow="Entri Pengeluaran"
              title="Catat Belanja Harian"
              description="Saldo dompet sumber langsung dikurangi oleh trigger database setelah baris tersimpan."
            />

            <form ref={formRef} onSubmit={onSubmit}>
              <PanelBody className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Tanggal" htmlFor="ex-tanggal">
                    <Input
                      id="ex-tanggal"
                      name="tanggal"
                      type="date"
                      defaultValue={today}
                      required
                    />
                  </Field>

                  <Field
                    label="Nominal (Rp)"
                    htmlFor="ex-nominal"
                    hint={isCigarette ? `maks ${formatRupiah(CIGARETTE_MAX_PRICE)}` : undefined}
                    error={
                      overPackPrice
                        ? `Melebihi batas harga ${formatRupiah(CIGARETTE_MAX_PRICE)} per bungkus.`
                        : undefined
                    }
                  >
                    <Input
                      id="ex-nominal"
                      name="nominal"
                      type="text"
                      inputMode="numeric"
                      value={nominal}
                      onChange={(event) => setNominal(event.target.value)}
                      placeholder="0"
                      required
                      className={overPackPrice ? "border-warning" : undefined}
                    />
                  </Field>
                </div>

                <Field label="Kategori" htmlFor="ex-kategori">
                  <Select
                    id="ex-kategori"
                    name="kategori"
                    value={kategori}
                    onChange={(event) => setKategori(event.target.value)}
                    className={isCigarette && guard.blocked ? "border-warning" : undefined}
                  >
                    {EXPENSE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </Select>
                </Field>

                {isCigarette && (
                  <div className="flex items-start gap-2.5 border border-border bg-surface px-3 py-2.5">
                    <Cigarette className="mt-0.5 size-3.5 shrink-0 text-warning" />
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      Pembelian terakhir:{" "}
                      <span className="font-mono text-foreground">
                        {guard.lastPurchaseDate === null
                          ? "belum ada"
                          : formatDateShort(guard.lastPurchaseDate)}
                      </span>
                      {guard.daysSince !== null && (
                        <>
                          {" "}
                          ·{" "}
                          <span className="font-mono text-foreground tabular">
                            {guard.daysSince} hari lalu
                          </span>
                        </>
                      )}
                      {guard.nextAllowedDate !== null && (
                        <>
                          {" "}
                          · boleh beli lagi{" "}
                          <span className="font-mono text-foreground">
                            {formatDateShort(guard.nextAllowedDate)}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                )}

                <Field label="Barang / Keperluan Dibeli" htmlFor="ex-barang">
                  <Input
                    id="ex-barang"
                    name="barang_keperluan"
                    type="text"
                    placeholder="Contoh: Bensin motor 1 liter"
                    required
                  />
                </Field>

                <Field label="Dompet Sumber" htmlFor="ex-wallet">
                  <Select id="ex-wallet" name="wallet_id" required>
                    <option value="">— Pilih dompet —</option>
                    {wallets.map((wallet) => (
                      <option key={wallet.id} value={wallet.id}>
                        {wallet.name} — {formatRupiah(wallet.balance)}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Catatan" htmlFor="ex-catatan">
                  <Textarea
                    id="ex-catatan"
                    name="catatan"
                    rows={2}
                    placeholder="Opsional"
                  />
                </Field>

                {feedback !== null && (
                  <p
                    role={feedback.tone === "error" ? "alert" : "status"}
                    className={`border bg-surface px-3 py-2 font-mono text-[11px] leading-relaxed ${
                      feedback.tone === "error"
                        ? "border-danger text-danger"
                        : "border-accent text-accent"
                    }`}
                  >
                    {feedback.message}
                  </p>
                )}
              </PanelBody>

              <PanelFooter>
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  {amount > 0 ? `Keluar ${formatRupiah(amount)}` : "Nominal belum diisi"}
                </span>
                <span className="flex gap-2">
                  {/* Adjacent-button rule: Batal monochrome, Simpan accent. */}
                  <Button
                    type="reset"
                    variant="outline"
                    size="sm"
                    onClick={() => setNominal("")}
                  >
                    Batal
                  </Button>
                  <MotionButton type="submit" variant="accent" size="sm" disabled={pending}>
                    {pending ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Menyimpan
                      </>
                    ) : (
                      "Simpan"
                    )}
                  </MotionButton>
                </span>
              </PanelFooter>
            </form>
          </Panel>
        </div>

        {/* ── Live weekly budget projection ── */}
        <div className="bg-background">
          <Panel className="h-full border-0">
            <PanelHeader
              code="02"
              eyebrow="Proyeksi Batas Mingguan"
              title={`Batas ${formatRupiah(WEEKLY_BUDGET_CAP)} per Minggu`}
              description={`Periode ${formatDateShort(week.startDate)} – ${formatDateShort(week.endDate)}.`}
            />
            <PanelBody className="flex flex-col gap-5">
              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="eyebrow">Realisasi Saat Ini</span>
                  <span className="font-mono text-[13px] text-foreground tabular">
                    {formatRupiah(week.expense)}
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
                  {formatPercent(week.usageRatio, 0)} terpakai
                </p>
              </div>

              {amount > 0 && (
                <div className="border-t border-border pt-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="eyebrow">Setelah Entri Ini</span>
                    <span
                      className={`font-mono text-[13px] tabular ${
                        projectedOver ? "text-danger" : "text-foreground"
                      }`}
                    >
                      {formatRupiah(projectedExpense)}
                    </span>
                  </div>
                  <ProgressRail
                    value={projectedRatio}
                    tone={projectedOver ? "danger" : projectedRatio >= 0.8 ? "warning" : "accent"}
                    className="mt-2.5"
                  />
                  <p
                    className={`mt-2 font-mono text-[10px] tabular ${
                      projectedOver ? "text-danger" : "text-muted-foreground"
                    }`}
                  >
                    {projectedOver
                      ? `Lewat batas ${formatRupiah(projectedExpense - WEEKLY_BUDGET_CAP)}`
                      : `Sisa ${formatRupiah(WEEKLY_BUDGET_CAP - projectedExpense)}`}
                  </p>
                </div>
              )}

              <div className="mt-auto border-t border-border pt-4">
                <span className="eyebrow">Kuota Rokok</span>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge tone={guard.blocked ? "warning" : "success"}>
                    {guard.blocked ? "Belum Boleh" : "Boleh Beli"}
                  </Badge>
                  <span className="font-mono text-[10px] text-muted-foreground tabular">
                    {guard.packsThisWeek} bungkus · {formatRupiah(guard.spendThisWeek)}
                  </span>
                </div>
                <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
                  {guard.message}
                </p>
              </div>
            </PanelBody>
          </Panel>
        </div>
      </div>
    </div>
  );
}

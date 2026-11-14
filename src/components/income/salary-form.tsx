"use client";

import { Loader2, Split, Zap } from "lucide-react";
import * as React from "react";

import { createSalaryIncomeAction } from "@/app/actions/transactions";
import { Button, MotionButton } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Badge, Panel, PanelBody, PanelFooter, PanelHeader } from "@/components/ui/panel";
import {
  DEFAULT_SALARY_PRESET,
  INCOME_SALARY_CATEGORIES,
  MONDAY_SPLIT_HOUR,
} from "@/lib/constants";
import { formatRupiah, hariIndonesia, parseRupiahInput } from "@/lib/format";
import { splitSalary } from "@/lib/finance";
import type { Wallet } from "@/lib/types/database";

/**
 * Salary logger with the 1-click Monday 08:00 splitter.
 *
 * The live preview recomputes with the same `splitSalary()` used by the Server
 * Action, so what the user sees is exactly what gets written — including the
 * rounding remainder absorbed by the final slice.
 */
export function SalaryForm({
  wallets,
  today,
}: {
  wallets: readonly Wallet[];
  today: string;
}) {
  const [nominal, setNominal] = React.useState(String(DEFAULT_SALARY_PRESET));
  const [autoSplit, setAutoSplit] = React.useState(true);
  const [pending, setPending] = React.useState(false);
  const [feedback, setFeedback] = React.useState<
    { tone: "ok" | "error"; message: string } | null
  >(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  const amount = parseRupiahInput(nominal);
  const slices = React.useMemo(() => splitSalary(amount), [amount]);
  const isMonday = hariIndonesia(today) === "Senin";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFeedback(null);

    const formData = new FormData(event.currentTarget);
    if (autoSplit) formData.set("auto_split", "on");
    else formData.delete("auto_split");

    const result = await createSalaryIncomeAction(formData);
    setPending(false);

    if (result.ok) {
      setFeedback({ tone: "ok", message: result.message ?? "Tersimpan." });
      formRef.current?.reset();
      setNominal(String(DEFAULT_SALARY_PRESET));
    } else {
      setFeedback({ tone: "error", message: result.error });
    }
  }

  return (
    <div className="outline-grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* ── Entry form ── */}
      <div className="bg-background">
        <Panel className="h-full border-0">
          <PanelHeader
            code="01"
            eyebrow="Gaji Utama / Part-Time"
            title="Catat Pemasukan Gaji"
            description={`Preset ${formatRupiah(DEFAULT_SALARY_PRESET)}. Pecah otomatis mengikuti SOP pukul ${String(MONDAY_SPLIT_HOUR).padStart(2, "0")}:00 WIB setiap Senin.`}
            actions={
              isMonday ? (
                <Badge tone="accent">Hari Senin — Waktunya Pecah Gaji</Badge>
              ) : (
                <Badge tone="neutral">{hariIndonesia(today)}</Badge>
              )
            }
          />

          <form ref={formRef} onSubmit={onSubmit}>
            <PanelBody className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Tanggal" htmlFor="sal-tanggal">
                  <Input
                    id="sal-tanggal"
                    name="tanggal"
                    type="date"
                    defaultValue={today}
                    required
                  />
                </Field>

                <Field label="Nominal (Rp)" htmlFor="sal-nominal">
                  <Input
                    id="sal-nominal"
                    name="nominal"
                    type="text"
                    inputMode="numeric"
                    value={nominal}
                    onChange={(event) => setNominal(event.target.value)}
                    required
                  />
                </Field>
              </div>

              <div className="flex flex-wrap gap-2">
                {[450_000, 900_000, 1_800_000].map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => setNominal(String(preset))}
                  >
                    {formatRupiah(preset)}
                  </Button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Kategori" htmlFor="sal-kategori">
                  <Select
                    id="sal-kategori"
                    name="kategori"
                    defaultValue={INCOME_SALARY_CATEGORIES[0]}
                  >
                    {INCOME_SALARY_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field
                  label="Dompet Tujuan"
                  htmlFor="sal-wallet"
                  hint={autoSplit ? "diabaikan saat pecah otomatis" : undefined}
                >
                  <Select
                    id="sal-wallet"
                    name="wallet_id"
                    disabled={autoSplit}
                    required={!autoSplit}
                  >
                    <option value="">— Pilih dompet —</option>
                    {wallets.map((wallet) => (
                      <option key={wallet.id} value={wallet.id}>
                        {wallet.name} — {formatRupiah(wallet.balance)}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <Field label="Keterangan" htmlFor="sal-barang">
                <Input
                  id="sal-barang"
                  name="barang_keperluan"
                  type="text"
                  placeholder="Gaji minggu ke-2 November"
                />
              </Field>

              <Field label="Catatan" htmlFor="sal-catatan">
                <Textarea id="sal-catatan" name="catatan" rows={2} placeholder="Opsional" />
              </Field>

              {/* 1-click splitter toggle */}
              <label
                htmlFor="sal-auto-split"
                className={`flex cursor-pointer items-start gap-3 border px-3 py-3 transition-colors ${
                  autoSplit ? "border-accent bg-surface" : "border-border bg-transparent"
                }`}
              >
                <input
                  id="sal-auto-split"
                  type="checkbox"
                  checked={autoSplit}
                  onChange={(event) => setAutoSplit(event.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 appearance-none border border-border-strong bg-background checked:border-accent checked:bg-accent"
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <Split className="size-3.5 shrink-0 text-accent" />
                    <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-foreground">
                      Pecah Otomatis 1 Klik
                    </span>
                  </span>
                  <span className="mt-1.5 block text-[12px] leading-relaxed text-muted-foreground">
                    Distribusikan ke 5 pos: 35% Darurat, 25% Produktif, 20% Investasi,
                    15% Operasional, 5% Pengembangan Diri. Setiap pos dicatat sebagai
                    baris tersendiri agar jejak audit tetap jelas.
                  </span>
                </span>
              </label>

              {feedback !== null && (
                <p
                  role={feedback.tone === "error" ? "alert" : "status"}
                  className={`border px-3 py-2 font-mono text-[11px] leading-relaxed ${
                    feedback.tone === "error"
                      ? "border-danger text-danger"
                      : "border-accent text-accent"
                  } bg-surface`}
                >
                  {feedback.message}
                </p>
              )}
            </PanelBody>

            <PanelFooter>
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                {autoSplit ? `${slices.length} baris akan dibuat` : "1 baris akan dibuat"}
              </span>
              <span className="flex gap-2">
                {/* Adjacent-button rule: Reset monochrome, Simpan accent. */}
                <Button
                  type="reset"
                  variant="outline"
                  size="sm"
                  onClick={() => setNominal(String(DEFAULT_SALARY_PRESET))}
                >
                  Reset
                </Button>
                <MotionButton type="submit" variant="accent" size="sm" disabled={pending}>
                  {pending ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Menyimpan
                    </>
                  ) : (
                    <>
                      <Zap className="size-3.5" />
                      Simpan
                    </>
                  )}
                </MotionButton>
              </span>
            </PanelFooter>
          </form>
        </Panel>
      </div>

      {/* ── Live split preview ── */}
      <div className="bg-background">
        <Panel className="h-full border-0">
          <PanelHeader
            code="02"
            eyebrow="Simulasi Pecah Gaji"
            title="Distribusi 35 / 25 / 20 / 15 / 5"
            description="Sisa pembulatan diserap oleh pos terakhir, sehingga total potongan selalu sama persis dengan nominal gaji."
          />
          <div className="table-scroll">
            <table className="brutal-table">
              <thead>
                <tr>
                  <th>Pos Alokasi</th>
                  <th className="text-right">%</th>
                  <th className="text-right">Nominal</th>
                </tr>
              </thead>
              <tbody>
                {slices.map((slice) => (
                  <tr key={slice.key}>
                    <td className="!whitespace-normal">
                      <span className="block text-[12px] font-medium text-foreground">
                        {slice.label}
                      </span>
                      <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">
                        {slice.note}
                      </span>
                    </td>
                    <td className="text-right font-mono text-[12px] text-muted-foreground tabular">
                      {Math.round(slice.ratio * 100)}%
                    </td>
                    <td className="text-right font-mono text-[12px] font-semibold text-foreground tabular">
                      {formatRupiah(slice.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="font-mono text-[11px] uppercase tracking-[0.08em]">
                    Total
                  </td>
                  <td className="text-right font-mono text-[11px] tabular">100%</td>
                  <td className="text-right font-mono text-[13px] tabular">
                    {formatRupiah(slices.reduce((acc, s) => acc + s.amount, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <PanelFooter>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Pos <span className="text-foreground">Pengembangan Diri</span> (5%) tidak
              memiliki dompet khusus dalam model 5-slot, sehingga dititipkan di{" "}
              <span className="text-foreground">Operasional Harian</span> dengan
              keterangan alokasi pada catatan transaksi.
            </p>
          </PanelFooter>
        </Panel>
      </div>
    </div>
  );
}

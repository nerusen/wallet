"use client";

import { Loader2, Lock, Snowflake, Unlock } from "lucide-react";
import * as React from "react";

import {
  createFreelanceIncomeAction,
  setFreelanceFreezeAction,
  unlockFreelanceAction,
} from "@/app/actions/transactions";
import { Button, MotionButton } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import {
  Badge,
  EmptyState,
  Panel,
  PanelBody,
  PanelFooter,
  PanelHeader,
  ProgressRail,
} from "@/components/ui/panel";
import {
  FREELANCE_FREEZE_DAYS,
  INCOME_FREELANCE_CATEGORIES,
} from "@/lib/constants";
import {
  daysBetween,
  firstOfNextMonth,
  formatDateShort,
  formatRupiah,
  parseRupiahInput,
} from "@/lib/format";
import { splitFreelance } from "@/lib/finance";
import type { Transaction, Wallet } from "@/lib/types/database";

/**
 * Freelance tracker: log a project, freeze it until the 1st of next month,
 * then release it with the exact 70:30 split.
 *
 * The unlock split is modelled as two ledger transfers out of Kantong
 * Freelance (35% + 35%), leaving the remaining 30% in place as Self-Reward —
 * so the wallet triggers stay the single source of balance truth.
 */
export function FreelanceForm({
  wallets,
  transactions,
  today,
}: {
  wallets: readonly Wallet[];
  transactions: readonly Transaction[];
  today: string;
}) {
  const [nominal, setNominal] = React.useState("");
  // Controlled freeze flag. Defaults to true (the SOP default) but is now
  // genuinely toggleable — see the hidden input in the form below.
  const [freeze, setFreeze] = React.useState(true);
  const [pending, setPending] = React.useState(false);
  const [feedback, setFeedback] = React.useState<
    { tone: "ok" | "error"; message: string } | null
  >(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  const amount = parseRupiahInput(nominal);
  const preview = React.useMemo(() => splitFreelance(amount), [amount]);

  const freelanceRows = React.useMemo(
    () =>
      transactions
        .filter((tx) => tx.tx_type === "income_freelance")
        .sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1)),
    [transactions],
  );

  const frozen = freelanceRows.filter((tx) => tx.is_frozen_freelance);
  const frozenTotal = frozen.reduce((acc, tx) => acc + tx.nominal, 0);
  const freelanceWallet = wallets.find((w) => w.category === "freelance");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFeedback(null);

    const result = await createFreelanceIncomeAction(new FormData(event.currentTarget));
    setPending(false);

    if (result.ok) {
      setFeedback({ tone: "ok", message: result.message ?? "Tersimpan." });
      formRef.current?.reset();
      setNominal("");
      setFreeze(true);
    } else {
      setFeedback({ tone: "error", message: result.error });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="outline-grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* ── Project entry ── */}
        <div className="bg-background">
          <Panel className="h-full border-0">
            <PanelHeader
              code="01"
              eyebrow="Nelsen Creative"
              title="Catat Proyek Freelance"
              description={`Pemasukan dibekukan ±${FREELANCE_FREEZE_DAYS} hari sampai tanggal 1 bulan berikutnya, lalu dipecah 70% Tabungan/Investasi : 30% Self-Reward.`}
              actions={<Badge tone="warning">Freeze Aktif</Badge>}
            />

            <form ref={formRef} onSubmit={onSubmit}>
              <PanelBody className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Tanggal" htmlFor="fl-tanggal">
                    <Input
                      id="fl-tanggal"
                      name="tanggal"
                      type="date"
                      defaultValue={today}
                      required
                    />
                  </Field>
                  <Field
                    label="Nilai Proyek (Rp)"
                    htmlFor="fl-nominal"
                    hint={`unlock ${formatDateShort(firstOfNextMonth(today))}`}
                  >
                    <Input
                      id="fl-nominal"
                      name="nominal"
                      type="text"
                      inputMode="numeric"
                      value={nominal}
                      onChange={(event) => setNominal(event.target.value)}
                      placeholder="0"
                      required
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Jenis Proyek" htmlFor="fl-kategori">
                    <Select
                      id="fl-kategori"
                      name="kategori"
                      defaultValue={INCOME_FREELANCE_CATEGORIES[0]}
                    >
                      {INCOME_FREELANCE_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Klien" htmlFor="fl-client">
                    <Input
                      id="fl-client"
                      name="client"
                      type="text"
                      placeholder="Nama klien"
                    />
                  </Field>
                </div>

                <Field label="Nama Proyek" htmlFor="fl-barang">
                  <Input
                    id="fl-barang"
                    name="barang_keperluan"
                    type="text"
                    placeholder="Contoh: Desain logo & brand kit UMKM"
                    required
                  />
                </Field>

                <Field label="Catatan" htmlFor="fl-catatan">
                  <Textarea
                    id="fl-catatan"
                    name="catatan"
                    rows={2}
                    placeholder="Opsional"
                  />
                </Field>

                {/*
                  Controlled freeze toggle.

                  An unchecked checkbox is omitted from FormData entirely, so a
                  bare checkbox can never submit `false`. The hidden input below
                  always sends an explicit "true"/"false" string, and the visible
                  checkbox carries no `name` — it only drives React state.
                */}
                <input type="hidden" name="freeze" value={freeze ? "true" : "false"} />

                <label
                  htmlFor="fl-freeze"
                  className={`flex cursor-pointer items-start gap-3 border bg-surface px-3 py-3 transition-colors ${
                    freeze ? "border-warning" : "border-border"
                  }`}
                >
                  <input
                    id="fl-freeze"
                    type="checkbox"
                    checked={freeze}
                    onChange={(event) => setFreeze(event.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 appearance-none border border-border-strong bg-background checked:border-warning checked:bg-warning"
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <Snowflake
                        className={`size-3.5 shrink-0 ${
                          freeze ? "text-warning" : "text-muted-foreground"
                        }`}
                      />
                      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-foreground">
                        Bekukan Sampai Tanggal 1
                      </span>
                    </span>
                    <span className="mt-1.5 block text-[12px] leading-relaxed text-muted-foreground">
                      {freeze ? (
                        <>
                          Dana masuk ke Kantong Freelance tetapi ditandai beku. Tidak
                          boleh dipakai sebelum{" "}
                          {formatDateShort(firstOfNextMonth(today))}.
                        </>
                      ) : (
                        <>
                          Pembekuan nonaktif. Dana langsung dihitung sebagai pemasukan
                          freelance aktif/likuid dan tidak masuk total{" "}
                          <span className="font-mono text-foreground">Freelance Beku</span>.
                        </>
                      )}
                    </span>
                  </span>
                </label>

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
                  {freelanceWallet === undefined
                    ? "Kantong Freelance tidak ditemukan"
                    : `Masuk ke ${freelanceWallet.name}`}
                </span>
                <span className="flex gap-2">
                  <Button
                    type="reset"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setNominal("");
                      setFreeze(true);
                    }}
                  >
                    Batal
                  </Button>
                  <MotionButton
                    type="submit"
                    variant="accent"
                    size="sm"
                    disabled={pending || freelanceWallet === undefined}
                  >
                    {pending ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Menyimpan
                      </>
                    ) : (
                      "Simpan Proyek"
                    )}
                  </MotionButton>
                </span>
              </PanelFooter>
            </form>
          </Panel>
        </div>

        {/* ── 70:30 calculator ── */}
        <div className="bg-background">
          <Panel className="h-full border-0">
            <PanelHeader
              code="02"
              eyebrow="Kalkulator Unlock"
              title="Pecah 70% Tabungan/Investasi : 30% Self-Reward"
              description="Perhitungan presisi ke Rupiah. Sisa pembulatan diserap oleh porsi Self-Reward."
            />

            <PanelBody className="flex flex-col gap-4">
              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="eyebrow">Nilai Proyek</span>
                  <span className="font-mono text-[16px] font-semibold text-foreground tabular">
                    {formatRupiah(preview.total)}
                  </span>
                </div>
                <div className="mt-3 flex h-2.5 w-full border border-border">
                  <span
                    className="block bg-accent"
                    style={{ width: "70%" }}
                    aria-hidden
                  />
                  <span
                    className="block border-l border-border bg-foreground"
                    style={{ width: "30%" }}
                    aria-hidden
                  />
                </div>
              </div>

              <div className="table-scroll">
                <table className="brutal-table">
                  <thead>
                    <tr>
                      <th>Pos</th>
                      <th className="text-right">%</th>
                      <th className="text-right">Nominal</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Tabungan & Investasi</td>
                      <td className="text-right font-mono text-[12px] tabular">70%</td>
                      <td className="text-right font-mono text-[12px] font-semibold text-accent tabular">
                        {formatRupiah(preview.tabunganInvestasi)}
                      </td>
                    </tr>
                    <tr>
                      <td className="pl-6 text-[11px] text-muted-foreground">
                        ↳ Tabungan Produktif
                      </td>
                      <td className="text-right font-mono text-[11px] text-muted-foreground tabular">
                        35%
                      </td>
                      <td className="text-right font-mono text-[11px] text-muted-foreground tabular">
                        {formatRupiah(preview.tabunganProduktif)}
                      </td>
                    </tr>
                    <tr>
                      <td className="pl-6 text-[11px] text-muted-foreground">
                        ↳ Investasi Pemula
                      </td>
                      <td className="text-right font-mono text-[11px] text-muted-foreground tabular">
                        35%
                      </td>
                      <td className="text-right font-mono text-[11px] text-muted-foreground tabular">
                        {formatRupiah(preview.investasiPemula)}
                      </td>
                    </tr>
                    <tr>
                      <td>Self-Reward</td>
                      <td className="text-right font-mono text-[12px] tabular">30%</td>
                      <td className="text-right font-mono text-[12px] font-semibold text-foreground tabular">
                        {formatRupiah(preview.selfReward)}
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="font-mono text-[11px] uppercase tracking-[0.08em]">
                        Total
                      </td>
                      <td className="text-right font-mono text-[11px] tabular">100%</td>
                      <td className="text-right font-mono text-[13px] tabular">
                        {formatRupiah(
                          preview.tabunganInvestasi + preview.selfReward,
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </PanelBody>
          </Panel>
        </div>
      </div>

      {/* ── Freeze tracker ── */}
      <Panel>
        <PanelHeader
          code="03"
          eyebrow="Pelacak Pembekuan 30 Hari"
          title="Dana Freelance Dibekukan"
          description="Dana hanya bisa dipecah setelah tanggal 1 bulan berikutnya terlewati."
          actions={
            <span className="flex items-center gap-2">
              <Badge tone={frozenTotal > 0 ? "warning" : "neutral"}>
                {formatRupiah(frozenTotal)} beku
              </Badge>
              <Badge tone="neutral">{frozen.length} proyek</Badge>
            </span>
          }
        />

        {freelanceRows.length === 0 ? (
          <EmptyState
            title="Belum ada proyek freelance"
            description="Catat proyek pertama dari Nelsen Creative untuk mulai melacak pembekuan 30 hari."
          />
        ) : (
          <ul className="divide-grid-y">
            {freelanceRows.map((tx) => (
              <FreelanceRow key={tx.id} tx={tx} today={today} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function FreelanceRow({ tx, today }: { tx: Transaction; today: string }) {
  const [pending, setPending] = React.useState<"split" | "toggle" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const unlockDate = firstOfNextMonth(tx.tanggal);
  const totalDays = Math.max(daysBetween(tx.tanggal, unlockDate), 1);
  const elapsed = Math.min(Math.max(daysBetween(tx.tanggal, today), 0), totalDays);
  const daysLeft = Math.max(daysBetween(today, unlockDate), 0);
  const unlockable = tx.is_frozen_freelance && today >= unlockDate;
  const split = splitFreelance(tx.nominal);

  /** Book the 70:30 split as real ledger transfers. */
  async function onUnlock() {
    setPending("split");
    setError(null);
    const result = await unlockFreelanceAction(tx.id);
    setPending(null);
    if (!result.ok) setError(result.error);
  }

  /**
   * Flip the freeze flag only — no money moves. Lets the user release funds on
   * the 1st (or any time) so the amount stops counting as FREELANCE BEKU.
   */
  async function onToggleFreeze() {
    setPending("toggle");
    setError(null);
    const result = await setFreelanceFreezeAction(tx.id, !tx.is_frozen_freelance);
    setPending(null);
    if (!result.ok) setError(result.error);
  }

  return (
    <li className="px-4 py-3.5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {tx.is_frozen_freelance ? (
              <Badge tone="warning">
                <Lock className="size-2.5" />
                Beku
              </Badge>
            ) : (
              <Badge tone="success">
                <Unlock className="size-2.5" />
                Cair
              </Badge>
            )}
            <span className="font-mono text-[10px] text-muted-foreground tabular">
              {formatDateShort(tx.tanggal)}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground/70">
              {tx.kategori}
            </span>
          </div>

          <p className="mt-2 truncate text-[13px] font-medium text-foreground">
            {tx.barang_keperluan}
          </p>

          {tx.is_frozen_freelance && (
            <div className="mt-2.5 max-w-md">
              <ProgressRail value={elapsed / totalDays} tone="warning" />
              <p className="mt-1.5 font-mono text-[10px] text-muted-foreground tabular">
                {daysLeft === 0
                  ? `Siap dipecah — unlock ${formatDateShort(unlockDate)}`
                  : `${daysLeft} hari lagi · unlock ${formatDateShort(unlockDate)}`}
              </p>
            </div>
          )}

          {error !== null && (
            <p role="alert" className="mt-2 font-mono text-[10px] text-danger">
              {error}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-4">
          <div className="text-right">
            <p className="font-mono text-[15px] font-semibold text-foreground tabular">
              {formatRupiah(tx.nominal)}
            </p>
            <p className="mt-1 font-mono text-[10px] text-muted-foreground tabular">
              70% {formatRupiah(split.tabunganInvestasi)} · 30%{" "}
              {formatRupiah(split.selfReward)}
            </p>
          </div>

          {/*
            Adjacent-button rule: at most one accent fill. "Pecah 70:30" takes
            the accent when actionable; the freeze toggle stays monochrome.
          */}
          <div className="flex flex-wrap items-center gap-2">
            {tx.is_frozen_freelance && (
              <MotionButton
                type="button"
                variant={unlockable ? "accent" : "outline"}
                size="sm"
                disabled={!unlockable || pending !== null}
                onClick={onUnlock}
                title={
                  unlockable
                    ? "Lepas dana dan pecah 70:30 ke Tabungan & Investasi"
                    : `Masih dibekukan sampai ${formatDateShort(unlockDate)}`
                }
              >
                {pending === "split" ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Memproses
                  </>
                ) : (
                  <>
                    <Unlock className="size-3.5" />
                    Pecah 70:30
                  </>
                )}
              </MotionButton>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending !== null}
              onClick={onToggleFreeze}
              title={
                tx.is_frozen_freelance
                  ? "Tandai cair tanpa memindahkan dana — keluar dari total Freelance Beku"
                  : "Bekukan kembali dana ini"
              }
            >
              {pending === "toggle" ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Memproses
                </>
              ) : tx.is_frozen_freelance ? (
                <>
                  <Unlock className="size-3.5" />
                  Lepas Beku
                </>
              ) : (
                <>
                  <Snowflake className="size-3.5" />
                  Bekukan
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}

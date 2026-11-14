"use client";

import { Loader2, Zap } from "lucide-react";
import * as React from "react";

import { quickLogAction } from "@/app/actions/transactions";
import { MotionButton, Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/panel";
import { SegmentedControl } from "@/components/ui/tabs";
import {
  DEFAULT_SALARY_PRESET,
  EXPENSE_CATEGORIES,
  INCOME_FREELANCE_CATEGORIES,
  INCOME_SALARY_CATEGORIES,
} from "@/lib/constants";
import { formatRupiah } from "@/lib/format";
import type { TxType, Wallet } from "@/lib/types/database";

type QuickType = "expense" | "income_salary" | "income_freelance" | "transfer";

const TYPE_OPTIONS = [
  { value: "expense" as const, label: "Keluar" },
  { value: "income_salary" as const, label: "Gaji" },
  { value: "income_freelance" as const, label: "Freelance" },
  { value: "transfer" as const, label: "Transfer" },
];

/**
 * Ctrl+K quick-log palette.
 *
 * One compact form that routes to the right transaction type without leaving
 * the page. Fields shown adapt to the selected type so the form never asks
 * for something the chosen type does not use.
 */
export function QuickLogDialog({
  open,
  onOpenChange,
  wallets,
  today,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallets: readonly Wallet[];
  today: string;
}) {
  const [type, setType] = React.useState<QuickType>("expense");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  // Reset transient state whenever the palette is reopened.
  React.useEffect(() => {
    if (open) {
      setError(null);
      setSuccess(null);
    }
  }, [open]);

  const categories =
    type === "expense"
      ? EXPENSE_CATEGORIES
      : type === "income_salary"
        ? INCOME_SALARY_CATEGORIES
        : type === "income_freelance"
          ? INCOME_FREELANCE_CATEGORIES
          : (["Transfer Antar Dompet"] as const);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData(event.currentTarget);
    formData.set("tx_type", type satisfies TxType);
    // The quick palette never auto-splits salary; that is an explicit,
    // deliberate action on /pemasukan.
    formData.delete("auto_split");

    const result = await quickLogAction(formData);
    setPending(false);

    if (result.ok) {
      setSuccess(result.message ?? "Tercatat.");
      formRef.current?.reset();
      // Let the confirmation land before dismissing.
      setTimeout(() => onOpenChange(false), 900);
    } else {
      setError(result.error);
    }
  }

  const walletOptions = wallets.map((w) => (
    <option key={w.id} value={w.id}>
      {w.name} — {formatRupiah(w.balance)}
    </option>
  ));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader eyebrow="Catat Cepat · Ctrl + K">
          <DialogTitle>Entri Transaksi Kilat</DialogTitle>
          <DialogDescription>
            Satu formulir untuk semua jenis transaksi. Saldo dompet dihitung
            otomatis oleh trigger database.
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} onSubmit={onSubmit}>
          <DialogBody className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <SegmentedControl
                items={TYPE_OPTIONS}
                value={type}
                onChange={(next) => setType(next)}
                ariaLabel="Jenis transaksi"
              />
              {type === "income_freelance" && (
                <Badge tone="warning">Dibekukan sampai tgl 1</Badge>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Tanggal" htmlFor="ql-tanggal">
                <Input
                  id="ql-tanggal"
                  name="tanggal"
                  type="date"
                  defaultValue={today}
                  required
                />
              </Field>

              <Field
                label="Nominal (Rp)"
                htmlFor="ql-nominal"
                hint={type === "income_salary" ? `preset ${formatRupiah(DEFAULT_SALARY_PRESET)}` : undefined}
              >
                <Input
                  id="ql-nominal"
                  name="nominal"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  defaultValue={type === "income_salary" ? String(DEFAULT_SALARY_PRESET) : ""}
                  required
                />
              </Field>
            </div>

            <Field label="Kategori" htmlFor="ql-kategori">
              <Select id="ql-kategori" name="kategori" defaultValue={categories[0]}>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label={type === "income_freelance" ? "Nama Proyek" : "Barang / Keperluan"}
              htmlFor="ql-barang"
            >
              <Input
                id="ql-barang"
                name="barang_keperluan"
                type="text"
                placeholder={
                  type === "expense"
                    ? "Contoh: Bensin motor 1 liter"
                    : type === "income_freelance"
                      ? "Contoh: Desain logo UMKM"
                      : "Keterangan singkat"
                }
                required={type !== "transfer"}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label={type === "transfer" ? "Dompet Sumber" : "Dompet"}
                htmlFor="ql-wallet"
              >
                <Select id="ql-wallet" name="wallet_id" required>
                  <option value="">— Pilih dompet —</option>
                  {walletOptions}
                </Select>
              </Field>

              {type === "transfer" && (
                <Field label="Dompet Tujuan" htmlFor="ql-target">
                  <Select id="ql-target" name="target_wallet_id" required>
                    <option value="">— Pilih tujuan —</option>
                    {walletOptions}
                  </Select>
                </Field>
              )}

              {type === "income_freelance" && (
                <Field label="Klien" htmlFor="ql-client">
                  <Input
                    id="ql-client"
                    name="client"
                    type="text"
                    placeholder="Nelsen Creative"
                  />
                </Field>
              )}
            </div>

            <Field label="Catatan" htmlFor="ql-catatan">
              <Textarea
                id="ql-catatan"
                name="catatan"
                rows={2}
                placeholder="Opsional"
              />
            </Field>

            {error !== null && (
              <p
                role="alert"
                className="border border-danger bg-surface px-3 py-2 font-mono text-[11px] leading-relaxed text-danger"
              >
                {error}
              </p>
            )}
            {success !== null && (
              <p
                role="status"
                className="border border-accent bg-surface px-3 py-2 font-mono text-[11px] leading-relaxed text-accent"
              >
                {success}
              </p>
            )}
          </DialogBody>

          <DialogFooter>
            {/* Adjacent-button rule: Batal is monochrome, Simpan is accent. */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
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
                <>
                  <Zap className="size-3.5" />
                  Simpan
                </>
              )}
            </MotionButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

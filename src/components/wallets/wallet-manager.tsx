"use client";

import {
  ArrowRightLeft,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import * as React from "react";

import {
  createWalletAction,
  deleteWalletAction,
  recalculateBalancesAction,
  updateWalletAction,
} from "@/app/actions/wallets";
import { createTransferAction } from "@/app/actions/transactions";
import { Button, MotionButton } from "@/components/ui/button";
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
import {
  Badge,
  EmptyState,
  Panel,
  PanelHeader,
  ProgressRail,
} from "@/components/ui/panel";
import { StaggerGrid, StaggerItem } from "@/components/ui/motion";
import { MAX_WALLETS } from "@/lib/constants";
import { formatPercent, formatRupiah, parseRupiahInput } from "@/lib/format";
import { walletProgress } from "@/lib/finance";
import { cn } from "@/lib/utils";
import type { AccentTag, Wallet, WalletCategory } from "@/lib/types/database";

const CATEGORY_LABEL: Record<WalletCategory, string> = {
  darurat: "Dana Darurat",
  operasional: "Operasional",
  produktif: "Produktif",
  investasi: "Investasi",
  freelance: "Freelance",
};

type DialogMode =
  | { kind: "none" }
  | { kind: "create" }
  | { kind: "edit"; wallet: Wallet }
  | { kind: "delete"; wallet: Wallet }
  | { kind: "transfer"; fromId?: string };

/**
 * Wallet grid with the hard 5-slot cap.
 *
 * `balance` is never editable here: it is derived state owned by the
 * `sync_wallet_balances()` trigger. The only way to change a balance is to
 * record a transaction, which is exactly the property that makes the ledger
 * trustworthy.
 */
export function WalletManager({
  wallets,
  today,
}: {
  wallets: readonly Wallet[];
  today: string;
}) {
  const [dialog, setDialog] = React.useState<DialogMode>({ kind: "none" });
  const [recalcPending, setRecalcPending] = React.useState(false);
  const [notice, setNotice] = React.useState<
    { tone: "ok" | "error"; message: string } | null
  >(null);

  const slotsFull = wallets.length >= MAX_WALLETS;
  const totalBalance = wallets.reduce((acc, w) => acc + w.balance, 0);

  async function onRecalculate() {
    setRecalcPending(true);
    setNotice(null);
    const result = await recalculateBalancesAction();
    setRecalcPending(false);
    setNotice(
      result.ok
        ? { tone: "ok", message: result.message ?? "Saldo dihitung ulang." }
        : { tone: "error", message: result.error },
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {notice !== null && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={cn(
            "border bg-surface px-4 py-2.5 font-mono text-[11px] leading-relaxed",
            notice.tone === "error"
              ? "border-danger text-danger"
              : "border-accent text-accent",
          )}
        >
          {notice.message}
        </p>
      )}

      <Panel>
        <PanelHeader
          code="01"
          eyebrow="Dompet & Brankas"
          title={`${wallets.length}/${MAX_WALLETS} Slot Terpakai`}
          description={
            slotsFull
              ? "Semua slot terpakai. Batas 5 dompet dipaksakan oleh trigger database, bukan hanya antarmuka."
              : `Sisa ${MAX_WALLETS - wallets.length} slot. Struktur dijaga tetap sederhana dan terbaca.`
          }
          actions={
            <>
              {/* Adjacent-button rule: only "Tambah Dompet" is accent. */}
              <MotionButton
                type="button"
                variant="accent"
                size="sm"
                disabled={slotsFull}
                onClick={() => setDialog({ kind: "create" })}
                title={
                  slotsFull
                    ? `${MAX_WALLETS}/${MAX_WALLETS} slot terpakai`
                    : "Tambah dompet baru"
                }
              >
                <Plus className="size-3.5" />
                {slotsFull ? `${MAX_WALLETS}/${MAX_WALLETS} Slot Terpakai` : "Tambah Dompet"}
              </MotionButton>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={wallets.length < 2}
                onClick={() => setDialog({ kind: "transfer" })}
              >
                <ArrowRightLeft className="size-3.5" />
                Transfer
              </Button>
            </>
          }
        />

        {wallets.length === 0 ? (
          <EmptyState
            title="Belum ada dompet"
            description="Jalankan migrasi Supabase untuk membuat 5 dompet bawaan, atau tambahkan satu secara manual."
          />
        ) : (
          <StaggerGrid className="outline-grid grid-cols-1 border-t-0 sm:grid-cols-2 xl:grid-cols-3">
            {wallets.map((wallet) => {
              const progress = walletProgress(wallet);
              const isAccent = wallet.accent_tag === "green";
              const target = wallet.target_amount ?? 0;
              const remaining = Math.max(target - wallet.balance, 0);

              return (
                <StaggerItem
                  key={wallet.id}
                  className="flex flex-col gap-4 bg-background p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="eyebrow min-w-0 truncate">
                      {CATEGORY_LABEL[wallet.category]}
                    </span>
                    {isAccent ? (
                      <Badge tone="accent">Fokus</Badge>
                    ) : (
                      <Badge tone="neutral">Standar</Badge>
                    )}
                  </div>

                  <div className="min-w-0">
                    <h3 className="truncate text-[14px] font-semibold text-foreground">
                      {wallet.name}
                    </h3>
                    <p className="mt-2 font-mono text-[20px] font-semibold text-foreground tabular">
                      {formatRupiah(wallet.balance)}
                    </p>
                  </div>

                  {target > 0 && (
                    <div>
                      <ProgressRail value={progress} tone={isAccent ? "accent" : "mono"} />
                      <div className="mt-2 flex items-baseline justify-between gap-2">
                        <span className="font-mono text-[10px] text-muted-foreground tabular">
                          {formatPercent(progress, 1)} tercapai
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground tabular">
                          / {formatRupiah(target)}
                        </span>
                      </div>
                      {remaining > 0 && (
                        <p className="mt-1.5 font-mono text-[10px] text-muted-foreground tabular">
                          Sisa {formatRupiah(remaining)} menuju target
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-auto flex items-stretch border border-border">
                    <button
                      type="button"
                      onClick={() => setDialog({ kind: "edit", wallet })}
                      className="flex flex-1 items-center justify-center gap-1.5 border-r border-border py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
                    >
                      <Pencil className="size-3" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setDialog({ kind: "transfer", fromId: wallet.id })}
                      className="flex flex-1 items-center justify-center gap-1.5 border-r border-border py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
                    >
                      <ArrowRightLeft className="size-3" />
                      Kirim
                    </button>
                    <button
                      type="button"
                      onClick={() => setDialog({ kind: "delete", wallet })}
                      title="Hapus dompet"
                      className="flex w-10 items-center justify-center py-1.5 text-muted-foreground transition-colors hover:bg-danger hover:text-white"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerGrid>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface px-4 py-3">
          <span className="font-mono text-[11px] text-muted-foreground tabular">
            Total saldo seluruh dompet:{" "}
            <span className="text-foreground">{formatRupiah(totalBalance)}</span>
          </span>
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={recalcPending}
            onClick={onRecalculate}
            title="Hitung ulang saldo dari seluruh buku besar"
          >
            {recalcPending ? (
              <>
                <Loader2 className="size-3 animate-spin" />
                Menghitung
              </>
            ) : (
              "Hitung Ulang Saldo"
            )}
          </Button>
        </div>
      </Panel>

      <WalletFormDialog
        open={dialog.kind === "create" || dialog.kind === "edit"}
        wallet={dialog.kind === "edit" ? dialog.wallet : undefined}
        onClose={() => setDialog({ kind: "none" })}
      />

      <DeleteWalletDialog
        wallet={dialog.kind === "delete" ? dialog.wallet : undefined}
        onClose={() => setDialog({ kind: "none" })}
      />

      <TransferDialog
        open={dialog.kind === "transfer"}
        wallets={wallets}
        today={today}
        defaultFromId={dialog.kind === "transfer" ? dialog.fromId : undefined}
        onClose={() => setDialog({ kind: "none" })}
      />
    </div>
  );
}

/* ── Create / edit ───────────────────────────────────────────────────────── */

function WalletFormDialog({
  open,
  wallet,
  onClose,
}: {
  open: boolean;
  wallet?: Wallet;
  onClose: () => void;
}) {
  const isEdit = wallet !== undefined;
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [accent, setAccent] = React.useState<AccentTag>(
    wallet?.accent_tag ?? "monochrome",
  );

  React.useEffect(() => {
    if (open) {
      setError(null);
      setAccent(wallet?.accent_tag ?? "monochrome");
    }
  }, [open, wallet]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const result = isEdit
      ? await updateWalletAction(formData)
      : await createWalletAction(formData);

    setPending(false);
    if (result.ok) onClose();
    else setError(result.error);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent size="sm">
        <DialogHeader eyebrow={isEdit ? "Ubah Dompet" : "Dompet Baru"}>
          <DialogTitle>{isEdit ? wallet.name : "Tambah Dompet"}</DialogTitle>
          <DialogDescription>
            Saldo tidak bisa diubah manual — nilainya diturunkan dari buku besar
            oleh trigger database. Ubah saldo dengan mencatat transaksi.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit}>
          {isEdit && <input type="hidden" name="id" value={wallet.id} />}

          <DialogBody className="flex flex-col gap-4">
            <Field label="Nama Dompet" htmlFor="w-name">
              <Input
                id="w-name"
                name="name"
                type="text"
                defaultValue={wallet?.name ?? ""}
                placeholder="Contoh: Dana Darurat"
                required
              />
            </Field>

            {!isEdit && (
              <Field label="Kategori" htmlFor="w-category">
                <Select id="w-category" name="category" defaultValue="produktif">
                  {(Object.keys(CATEGORY_LABEL) as WalletCategory[]).map((key) => (
                    <option key={key} value={key}>
                      {CATEGORY_LABEL[key]}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            <Field label="Target (Rp)" htmlFor="w-target">
              <Input
                id="w-target"
                name="target_amount"
                type="text"
                inputMode="numeric"
                defaultValue={
                  wallet?.target_amount === null || wallet?.target_amount === undefined
                    ? ""
                    : String(wallet.target_amount)
                }
                placeholder="0"
              />
            </Field>

            <Field label="Penanda Aksen" htmlFor="w-accent">
              <div className="flex border border-border">
                {(["monochrome", "green"] as const).map((value, index) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAccent(value)}
                    className={cn(
                      "flex-1 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors",
                      index > 0 && "border-l border-border",
                      accent === value
                        ? value === "green"
                          ? "bg-accent text-accent-foreground"
                          : "bg-foreground text-background"
                        : "bg-transparent text-muted-foreground hover:bg-surface",
                    )}
                  >
                    {value === "green" ? "Aksen #51CD85" : "Monokrom"}
                  </button>
                ))}
              </div>
              <input type="hidden" name="accent_tag" value={accent} />
            </Field>

            {error !== null && (
              <p
                role="alert"
                className="border border-danger bg-surface px-3 py-2 font-mono text-[11px] leading-relaxed text-danger"
              >
                {error}
              </p>
            )}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── Delete ──────────────────────────────────────────────────────────────── */

function DeleteWalletDialog({
  wallet,
  onClose,
}: {
  wallet?: Wallet;
  onClose: () => void;
}) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onConfirm() {
    if (wallet === undefined) return;
    setPending(true);
    setError(null);
    const result = await deleteWalletAction(wallet.id);
    setPending(false);
    if (result.ok) onClose();
    else setError(result.error);
  }

  return (
    <Dialog open={wallet !== undefined} onOpenChange={(next) => !next && onClose()}>
      <DialogContent size="sm">
        <DialogHeader eyebrow="Konfirmasi Hapus">
          <DialogTitle>Hapus {wallet?.name ?? "dompet"}?</DialogTitle>
          <DialogDescription>
            Transaksi lama <span className="text-foreground">tidak dihapus</span>.
            Referensi dompetnya dilepas menjadi kosong, sehingga riwayat keuangan
            tetap utuh di laporan.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <dl className="border border-border">
            <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
              <dt className="eyebrow">Saldo Saat Ini</dt>
              <dd className="font-mono text-[12px] text-foreground tabular">
                {formatRupiah(wallet?.balance ?? 0)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-3 py-2">
              <dt className="eyebrow">Slot Dibebaskan</dt>
              <dd className="font-mono text-[12px] text-foreground tabular">1</dd>
            </div>
          </dl>

          {(wallet?.balance ?? 0) > 0 && (
            <p className="mt-3 border border-warning bg-surface px-3 py-2 font-mono text-[11px] leading-relaxed text-warning">
              Dompet ini masih punya saldo. Pertimbangkan transfer saldonya terlebih
              dahulu agar tidak hilang dari perhitungan total.
            </p>
          )}

          {error !== null && (
            <p
              role="alert"
              className="mt-3 border border-danger bg-surface px-3 py-2 font-mono text-[11px] text-danger"
            >
              {error}
            </p>
          )}
        </DialogBody>

        <DialogFooter>
          {/* Destructive pair: Batal stays monochrome; the danger fill is not
              the brand accent, so the adjacent-button rule holds. */}
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Batal
          </Button>
          <MotionButton
            type="button"
            variant="danger-solid"
            size="sm"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Menghapus
              </>
            ) : (
              "Hapus Dompet"
            )}
          </MotionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Transfer ────────────────────────────────────────────────────────────── */

function TransferDialog({
  open,
  wallets,
  today,
  defaultFromId,
  onClose,
}: {
  open: boolean;
  wallets: readonly Wallet[];
  today: string;
  defaultFromId?: string;
  onClose: () => void;
}) {
  const [fromId, setFromId] = React.useState(defaultFromId ?? "");
  const [toId, setToId] = React.useState("");
  const [nominal, setNominal] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setFromId(defaultFromId ?? "");
      setToId("");
      setNominal("");
      setError(null);
    }
  }, [open, defaultFromId]);

  const source = wallets.find((w) => w.id === fromId);
  const target = wallets.find((w) => w.id === toId);
  const amount = parseRupiahInput(nominal);
  const insufficient = source !== undefined && amount > source.balance;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = await createTransferAction(new FormData(event.currentTarget));
    setPending(false);
    if (result.ok) onClose();
    else setError(result.error);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent size="sm">
        <DialogHeader eyebrow="Transfer Antar Dompet">
          <DialogTitle>Pindahkan Saldo</DialogTitle>
          <DialogDescription>
            Transfer dicatat sebagai satu baris buku besar: saldo sumber berkurang
            dan saldo tujuan bertambah dengan nominal yang sama persis.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit}>
          <DialogBody className="flex flex-col gap-4">
            <Field label="Tanggal" htmlFor="tr-tanggal">
              <Input
                id="tr-tanggal"
                name="tanggal"
                type="date"
                defaultValue={today}
                required
              />
            </Field>

            <Field label="Dompet Sumber" htmlFor="tr-from">
              <Select
                id="tr-from"
                name="wallet_id"
                value={fromId}
                onChange={(event) => setFromId(event.target.value)}
                required
              >
                <option value="">— Pilih sumber —</option>
                {wallets.map((wallet) => (
                  <option key={wallet.id} value={wallet.id}>
                    {wallet.name} — {formatRupiah(wallet.balance)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Dompet Tujuan" htmlFor="tr-to">
              <Select
                id="tr-to"
                name="target_wallet_id"
                value={toId}
                onChange={(event) => setToId(event.target.value)}
                required
              >
                <option value="">— Pilih tujuan —</option>
                {wallets
                  .filter((wallet) => wallet.id !== fromId)
                  .map((wallet) => (
                    <option key={wallet.id} value={wallet.id}>
                      {wallet.name} — {formatRupiah(wallet.balance)}
                    </option>
                  ))}
              </Select>
            </Field>

            <Field
              label="Nominal (Rp)"
              htmlFor="tr-nominal"
              hint={source === undefined ? undefined : `tersedia ${formatRupiah(source.balance)}`}
              error={insufficient ? "Saldo sumber tidak cukup." : undefined}
            >
              <Input
                id="tr-nominal"
                name="nominal"
                type="text"
                inputMode="numeric"
                value={nominal}
                onChange={(event) => setNominal(event.target.value)}
                placeholder="0"
                required
                className={insufficient ? "border-danger" : undefined}
              />
            </Field>

            <Field label="Keterangan" htmlFor="tr-barang">
              <Input
                id="tr-barang"
                name="barang_keperluan"
                type="text"
                placeholder="Transfer antar dompet"
              />
            </Field>

            <Field label="Catatan" htmlFor="tr-catatan">
              <Textarea id="tr-catatan" name="catatan" rows={2} placeholder="Opsional" />
            </Field>

            {/* Live preview of the resulting balances */}
            {source !== undefined && target !== undefined && amount > 0 && (
              <dl className="border border-border">
                <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
                  <dt className="eyebrow min-w-0 truncate">{source.name}</dt>
                  <dd className="shrink-0 font-mono text-[11px] tabular">
                    <span className="text-muted-foreground">
                      {formatRupiah(source.balance)}
                    </span>
                    <span className="mx-1.5 text-muted-foreground/50">→</span>
                    <span className={insufficient ? "text-danger" : "text-foreground"}>
                      {formatRupiah(source.balance - amount)}
                    </span>
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <dt className="eyebrow min-w-0 truncate">{target.name}</dt>
                  <dd className="shrink-0 font-mono text-[11px] tabular">
                    <span className="text-muted-foreground">
                      {formatRupiah(target.balance)}
                    </span>
                    <span className="mx-1.5 text-muted-foreground/50">→</span>
                    <span className="text-accent">
                      {formatRupiah(target.balance + amount)}
                    </span>
                  </dd>
                </div>
              </dl>
            )}

            {error !== null && (
              <p
                role="alert"
                className="border border-danger bg-surface px-3 py-2 font-mono text-[11px] leading-relaxed text-danger"
              >
                {error}
              </p>
            )}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Batal
            </Button>
            <MotionButton
              type="submit"
              variant="accent"
              size="sm"
              disabled={pending || insufficient}
            >
              {pending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Memproses
                </>
              ) : (
                <>
                  <ArrowRightLeft className="size-3.5" />
                  Transfer
                </>
              )}
            </MotionButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

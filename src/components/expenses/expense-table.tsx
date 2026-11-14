"use client";

import { Loader2, Search, Trash2 } from "lucide-react";
import * as React from "react";

import { deleteTransactionAction } from "@/app/actions/transactions";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import {
  Badge,
  EmptyState,
  Panel,
  PanelHeader,
} from "@/components/ui/panel";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import {
  formatDateShort,
  formatRupiah,
  monthKeyOf,
  startOfWeek,
  endOfWeek,
} from "@/lib/format";
import { sum } from "@/lib/finance";
import type { Transaction, Wallet } from "@/lib/types/database";

/**
 * Searchable, filterable expense ledger with live daily / weekly / monthly
 * subtotals.
 *
 * Filtering is client-side on an already-fetched window: the dataset for a
 * single person's ledger is small, and keeping it local makes the subtotals
 * update instantly as the filters change.
 */
export function ExpenseTable({
  transactions,
  wallets,
  today,
}: {
  transactions: readonly Transaction[];
  wallets: readonly Wallet[];
  today: string;
}) {
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState("all");
  const [walletId, setWalletId] = React.useState("all");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const walletName = React.useMemo(
    () => new Map(wallets.map((w) => [w.id, w.name])),
    [wallets],
  );

  const expenses = React.useMemo(
    () =>
      transactions
        .filter((tx) => tx.tx_type === "expense")
        .sort((a, b) =>
          a.tanggal < b.tanggal
            ? 1
            : a.tanggal > b.tanggal
              ? -1
              : a.created_at < b.created_at
                ? 1
                : -1,
        ),
    [transactions],
  );

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();

    return expenses.filter((tx) => {
      if (category !== "all" && tx.kategori !== category) return false;
      if (walletId !== "all" && tx.wallet_id !== walletId) return false;
      if (from.length > 0 && tx.tanggal < from) return false;
      if (to.length > 0 && tx.tanggal > to) return false;

      if (needle.length > 0) {
        const haystack = [
          tx.barang_keperluan,
          tx.kategori,
          tx.catatan ?? "",
          tx.hari,
          tx.bulan,
          tx.wallet_id === null ? "" : (walletName.get(tx.wallet_id) ?? ""),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }

      return true;
    });
  }, [expenses, query, category, walletId, from, to, walletName]);

  /* Subtotals are computed over the FILTERED set, intersected with each
     period, so they always describe what the user is actually looking at. */
  const weekStart = startOfWeek(today);
  const weekEnd = endOfWeek(today);
  const thisMonth = monthKeyOf(today);

  const subtotals = React.useMemo(
    () => ({
      filtered: sum(filtered.map((tx) => tx.nominal)),
      today: sum(filtered.filter((tx) => tx.tanggal === today).map((tx) => tx.nominal)),
      week: sum(
        filtered
          .filter((tx) => tx.tanggal >= weekStart && tx.tanggal <= weekEnd)
          .map((tx) => tx.nominal),
      ),
      month: sum(
        filtered
          .filter((tx) => monthKeyOf(tx.tanggal) === thisMonth)
          .map((tx) => tx.nominal),
      ),
    }),
    [filtered, today, weekStart, weekEnd, thisMonth],
  );

  const hasFilters =
    query.length > 0 ||
    category !== "all" ||
    walletId !== "all" ||
    from.length > 0 ||
    to.length > 0;

  function resetFilters() {
    setQuery("");
    setCategory("all");
    setWalletId("all");
    setFrom("");
    setTo("");
  }

  async function onDelete(id: string) {
    setDeletingId(id);
    setError(null);
    const result = await deleteTransactionAction(id);
    setDeletingId(null);
    if (!result.ok) setError(result.error);
  }

  return (
    <Panel>
      <PanelHeader
        code="03"
        eyebrow="Buku Besar Pengeluaran"
        title="Riwayat & Subtotal"
        description="Cari, filter, dan lihat subtotal harian, mingguan, serta bulanan secara langsung."
        actions={
          <Badge tone="neutral">
            {filtered.length} / {expenses.length} baris
          </Badge>
        }
      />

      {/* Filter rail */}
      <div className="outline-grid grid-cols-1 border-t-0 sm:grid-cols-2 xl:grid-cols-5">
        <div className="bg-background p-3">
          <label htmlFor="ex-search" className="eyebrow">
            Cari
          </label>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="ex-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Barang, catatan…"
              className="pl-7"
            />
          </div>
        </div>

        <div className="bg-background p-3">
          <label htmlFor="ex-f-kategori" className="eyebrow">
            Kategori
          </label>
          <Select
            id="ex-f-kategori"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="mt-2"
          >
            <option value="all">Semua kategori</option>
            {EXPENSE_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </div>

        <div className="bg-background p-3">
          <label htmlFor="ex-f-wallet" className="eyebrow">
            Dompet
          </label>
          <Select
            id="ex-f-wallet"
            value={walletId}
            onChange={(event) => setWalletId(event.target.value)}
            className="mt-2"
          >
            <option value="all">Semua dompet</option>
            {wallets.map((wallet) => (
              <option key={wallet.id} value={wallet.id}>
                {wallet.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="bg-background p-3">
          <label htmlFor="ex-f-from" className="eyebrow">
            Dari Tanggal
          </label>
          <Input
            id="ex-f-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="mt-2"
          />
        </div>

        <div className="bg-background p-3">
          <label htmlFor="ex-f-to" className="eyebrow">
            Sampai Tanggal
          </label>
          <Input
            id="ex-f-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="mt-2"
          />
        </div>
      </div>

      {/* Subtotal rail */}
      <dl className="flex flex-wrap border-b border-border">
        {[
          { label: "Subtotal Terfilter", value: subtotals.filtered, strong: true },
          { label: "Hari Ini", value: subtotals.today, strong: false },
          { label: "Minggu Berjalan", value: subtotals.week, strong: false },
          { label: "Bulan Berjalan", value: subtotals.month, strong: false },
        ].map((item, index) => (
          <div
            key={item.label}
            className={`flex min-w-[10rem] flex-1 flex-col gap-1.5 px-4 py-3 ${
              index > 0 ? "border-l border-border" : ""
            }`}
          >
            <dt className="eyebrow">{item.label}</dt>
            <dd
              className={`font-mono tabular ${
                item.strong
                  ? "text-[15px] font-semibold text-foreground"
                  : "text-[13px] text-muted-foreground"
              }`}
            >
              {formatRupiah(item.value)}
            </dd>
          </div>
        ))}
      </dl>

      {error !== null && (
        <p
          role="alert"
          className="border-b border-danger bg-surface px-4 py-2.5 font-mono text-[11px] text-danger"
        >
          {error}
        </p>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          title={hasFilters ? "Tidak ada hasil" : "Belum ada pengeluaran"}
          description={
            hasFilters
              ? "Longgarkan filter atau kosongkan kata kunci pencarian."
              : "Catat pengeluaran pertama menggunakan formulir di atas."
          }
          action={
            hasFilters ? (
              <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
                Reset Filter
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="table-scroll">
          <table className="brutal-table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Hari</th>
                <th>Mg</th>
                <th>Kategori</th>
                <th>Barang / Keperluan</th>
                <th>Dompet</th>
                <th className="text-right">Nominal</th>
                <th>Catatan</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tx) => (
                <tr key={tx.id}>
                  <td className="font-mono text-[12px] tabular">
                    {formatDateShort(tx.tanggal)}
                  </td>
                  <td className="font-mono text-[11px] text-muted-foreground">
                    {tx.hari}
                  </td>
                  <td className="font-mono text-[11px] text-muted-foreground tabular">
                    {tx.minggu_ke}
                  </td>
                  <td className="max-w-[12rem] truncate text-[12px] text-muted-foreground">
                    {tx.kategori}
                  </td>
                  <td className="max-w-[16rem] truncate text-[12px] text-foreground">
                    {tx.barang_keperluan}
                  </td>
                  <td className="text-[12px] text-muted-foreground">
                    {tx.wallet_id === null ? "—" : (walletName.get(tx.wallet_id) ?? "—")}
                  </td>
                  <td className="text-right font-mono text-[12px] font-semibold text-danger tabular">
                    {formatRupiah(tx.nominal)}
                  </td>
                  <td className="max-w-[14rem] truncate text-[11px] text-muted-foreground">
                    {tx.catatan ?? "—"}
                  </td>
                  <td className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      title="Hapus transaksi"
                      disabled={deletingId === tx.id}
                      onClick={() => onDelete(tx.id)}
                    >
                      {deletingId === tx.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Trash2 className="size-3" />
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={6} className="font-mono text-[11px] uppercase tracking-[0.08em]">
                  Total {filtered.length} baris terfilter
                </td>
                <td className="text-right font-mono text-[13px] text-danger tabular">
                  {formatRupiah(subtotals.filtered)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Panel>
  );
}

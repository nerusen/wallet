"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/guard";
import { CSV_HEADERS, type ImportReport } from "@/lib/constants";
import { parseCsv, pickColumn, toCsv } from "@/lib/csv";
import {
  bulanIndonesia,
  hariIndonesia,
  mingguKe,
  parseRupiahInput,
  todayWIB,
} from "@/lib/format";
import { toRupiah } from "@/lib/finance";
import { fetchTransactions, fetchWallets } from "@/lib/supabase/queries";
import { createServiceClient } from "@/lib/supabase/server";
import type {
  ActionResult,
  TransactionInsert,
  TxType,
} from "@/lib/types/database";
import { translateDbError } from "@/lib/utils";

const VALID_TYPES: readonly TxType[] = [
  "income_salary",
  "income_freelance",
  "expense",
  "transfer",
];

/** Map loose Indonesian labels onto the canonical tx_type. */
function normalizeTxType(raw: string | undefined): TxType | null {
  if (raw === undefined) return null;
  const value = raw.toLowerCase().trim().replace(/[\s-]+/g, "_");

  if (VALID_TYPES.includes(value as TxType)) return value as TxType;

  if (/(gaji|salary|part_?time|upah|saldo_?awal)/.test(value)) return "income_salary";
  if (/(freelance|proyek|project|klien|client)/.test(value)) return "income_freelance";
  if (/(transfer|pindah|mutasi)/.test(value)) return "transfer";
  if (/(expense|pengeluaran|keluar|belanja|bayar)/.test(value)) return "expense";
  if (/(income|pemasukan|masuk)/.test(value)) return "income_salary";

  return null;
}

function normalizeDate(raw: string | undefined): string | null {
  if (raw === undefined || raw.length === 0) return null;
  const value = raw.trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy !== null) {
    const [, d, m, y] = dmy;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  // YYYY/MM/DD
  const ymd = value.match(/^(\d{4})[/](\d{1,2})[/](\d{1,2})$/);
  if (ymd !== null) {
    const [, y, m, d] = ymd;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  return null;
}

function isTruthy(raw: string | undefined): boolean {
  if (raw === undefined) return false;
  return /^(true|1|ya|yes|y|beku|frozen)$/i.test(raw.trim());
}

/**
 * Batch-import a CSV into `transactions`.
 *
 * Wallet references may be given as a UUID or as a wallet NAME — the export
 * writes names, so a round-trip export→import works without manual editing.
 *
 * Rows are inserted in chunks so one malformed row cannot abort the entire
 * file, and the report names every skipped row with its reason.
 */
export async function importTransactionsCsvAction(
  formData: FormData,
): Promise<ActionResult<ImportReport>> {
  await requireSession();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Pilih berkas CSV terlebih dahulu.", field: "file" };
  }
  if (file.size > 4 * 1024 * 1024) {
    return { ok: false, error: "Berkas melebihi 4 MB. Pecah menjadi beberapa file.", field: "file" };
  }

  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, error: "Berkas tidak dapat dibaca." };
  }

  const { headers, rows } = parseCsv(text);
  if (headers.length === 0 || rows.length === 0) {
    return { ok: false, error: "CSV kosong atau tidak memiliki baris data." };
  }

  const wallets = await fetchWallets();
  const byId = new Map(wallets.map((w) => [w.id, w]));
  const byName = new Map(wallets.map((w) => [w.name.toLowerCase(), w]));

  const resolveWallet = (raw: string | undefined): string | null => {
    if (raw === undefined || raw.length === 0) return null;
    const value = raw.trim();
    if (byId.has(value)) return value;
    return byName.get(value.toLowerCase())?.id ?? null;
  };

  const payload: TransactionInsert[] = [];
  const issues: string[] = [];
  let skipped = 0;

  rows.forEach((row, index) => {
    const lineNo = index + 2; // +1 for header, +1 for 1-based numbering

    const tanggal = normalizeDate(
      pickColumn(row, ["tanggal", "date", "tgl"]),
    );
    if (tanggal === null) {
      skipped += 1;
      if (issues.length < 25) issues.push(`Baris ${lineNo}: tanggal tidak valid.`);
      return;
    }

    const txType = normalizeTxType(
      pickColumn(row, ["tx_type", "jenis", "tipe", "type", "transaksi"]),
    );
    if (txType === null) {
      skipped += 1;
      if (issues.length < 25) issues.push(`Baris ${lineNo}: jenis transaksi tidak dikenal.`);
      return;
    }

    const nominal = toRupiah(
      parseRupiahInput(
        pickColumn(row, ["nominal", "jumlah", "amount", "nilai"]) ?? "0",
      ),
    );
    if (nominal <= 0) {
      skipped += 1;
      if (issues.length < 25) issues.push(`Baris ${lineNo}: nominal harus lebih besar dari nol.`);
      return;
    }

    const barang =
      pickColumn(row, [
        "barang_keperluan",
        "barang",
        "keperluan",
        "keterangan",
        "deskripsi",
        "description",
      ]) ?? "Impor CSV";

    const walletId = resolveWallet(
      pickColumn(row, ["dompet", "wallet_id", "wallet", "sumber", "dompet_sumber"]),
    );
    const targetWalletId = resolveWallet(
      pickColumn(row, ["dompet_tujuan", "target_wallet_id", "tujuan", "target"]),
    );

    if (txType === "transfer" && (walletId === null || targetWalletId === null)) {
      skipped += 1;
      if (issues.length < 25) {
        issues.push(`Baris ${lineNo}: transfer butuh dompet sumber dan tujuan yang dikenal.`);
      }
      return;
    }
    if (txType === "transfer" && walletId === targetWalletId) {
      skipped += 1;
      if (issues.length < 25) {
        issues.push(`Baris ${lineNo}: dompet sumber dan tujuan tidak boleh sama.`);
      }
      return;
    }

    payload.push({
      tanggal,
      hari: pickColumn(row, ["hari", "day"]) ?? hariIndonesia(tanggal),
      minggu_ke: Number.parseInt(
        pickColumn(row, ["minggu_ke", "minggu", "week"]) ?? "",
        10,
      ) || mingguKe(tanggal),
      bulan: pickColumn(row, ["bulan", "month"]) ?? bulanIndonesia(tanggal),
      tx_type: txType,
      kategori:
        pickColumn(row, ["kategori", "category", "pos"]) ??
        (txType === "expense" ? "Biaya Kerja / Lain-Lain" : "Lain-Lain"),
      barang_keperluan: barang,
      nominal,
      wallet_id: walletId,
      target_wallet_id: txType === "transfer" ? targetWalletId : null,
      is_frozen_freelance:
        txType === "income_freelance" &&
        isTruthy(pickColumn(row, ["is_frozen_freelance", "beku", "frozen"])),
      catatan: pickColumn(row, ["catatan", "notes", "note", "memo"]) ?? null,
    });
  });

  if (payload.length === 0) {
    return {
      ok: false,
      error: `Tidak ada baris yang bisa diimpor dari ${rows.length} baris. ${issues.slice(0, 3).join(" ")}`,
    };
  }

  try {
    const supabase = createServiceClient();
    const CHUNK = 250;
    let inserted = 0;

    for (let i = 0; i < payload.length; i += CHUNK) {
      const chunk = payload.slice(i, i + CHUNK);
      const { error } = await supabase.from("transactions").insert(chunk);

      if (error) {
        issues.push(
          `Blok baris ${i + 2}–${i + chunk.length + 1} gagal: ${error.message}`,
        );
        skipped += chunk.length;
        continue;
      }
      inserted += chunk.length;
    }

    // Balances are trigger-maintained per row, but a full rebuild after a bulk
    // import is cheap insurance against a partially-failed chunk.
    await supabase.rpc("recalculate_wallet_balances");

    for (const path of ["/laporan", "/dashboard", "/dompet", "/pengeluaran", "/pemasukan"]) {
      revalidatePath(path);
    }

    return {
      ok: true,
      data: { total: rows.length, inserted, skipped, issues: issues.slice(0, 25) },
      message: `${inserted} dari ${rows.length} baris diimpor. ${skipped} baris dilewati.`,
    };
  } catch (error) {
    return { ok: false, error: translateDbError(error) };
  }
}

/**
 * Export transactions as a CSV string.
 *
 * Returns the payload to the client, which turns it into a Blob download —
 * keeps the Server Action a pure function with no filesystem involvement.
 */
export async function exportTransactionsCsvAction(options: {
  from?: string;
  to?: string;
  txType?: TxType | "all";
}): Promise<ActionResult<{ filename: string; csv: string; rows: number }>> {
  await requireSession();

  try {
    const [transactions, wallets] = await Promise.all([
      fetchTransactions({
        ...(options.from !== undefined ? { from: options.from } : {}),
        ...(options.to !== undefined ? { to: options.to } : {}),
      }),
      fetchWallets(),
    ]);

    const walletName = new Map(wallets.map((w) => [w.id, w.name]));

    const filtered =
      options.txType === undefined || options.txType === "all"
        ? transactions
        : transactions.filter((tx) => tx.tx_type === options.txType);

    const sorted = [...filtered].sort((a, b) =>
      a.tanggal < b.tanggal ? -1 : a.tanggal > b.tanggal ? 1 : 0,
    );

    const csv = toCsv(
      CSV_HEADERS,
      sorted.map((tx) => [
        tx.tanggal,
        tx.hari,
        tx.minggu_ke,
        tx.bulan,
        tx.tx_type,
        tx.kategori,
        tx.barang_keperluan,
        tx.nominal,
        tx.wallet_id === null ? "" : (walletName.get(tx.wallet_id) ?? ""),
        tx.target_wallet_id === null ? "" : (walletName.get(tx.target_wallet_id) ?? ""),
        tx.is_frozen_freelance,
        tx.catatan ?? "",
      ]),
    );

    const scope =
      options.from !== undefined && options.to !== undefined
        ? `${options.from}_sd_${options.to}`
        : "lengkap";

    return {
      ok: true,
      data: {
        filename: `transaksi_${scope}_${todayWIB()}.csv`,
        csv,
        rows: sorted.length,
      },
      message: `${sorted.length} transaksi siap diunduh.`,
    };
  } catch (error) {
    return { ok: false, error: translateDbError(error) };
  }
}

"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/guard";
import {
  CIGARETTE_CATEGORY,
  DEFAULT_SALARY_PRESET,
  EXPENSE_CATEGORIES,
} from "@/lib/constants";
import {
  bulanIndonesia,
  firstOfNextMonth,
  hariIndonesia,
  mingguKe,
  parseRupiahInput,
  todayWIB,
} from "@/lib/format";
import { splitFreelance, splitSalary, toRupiah } from "@/lib/finance";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchWallets } from "@/lib/supabase/queries";
import type {
  ActionResult,
  TransactionInsert,
  TxType,
  WalletCategory,
} from "@/lib/types/database";
import { translateDbError } from "@/lib/utils";

const PRIVATE_PATHS = [
  "/dashboard",
  "/pemasukan",
  "/pengeluaran",
  "/dompet",
  "/laporan",
  "/aturan",
] as const;

function revalidateAll(): void {
  for (const path of PRIVATE_PATHS) revalidatePath(path);
}

/** Build the calendar columns for a date. Mirrors the SQL trigger exactly. */
function calendarFor(dateISO: string): {
  hari: string;
  minggu_ke: number;
  bulan: string;
} {
  return {
    hari: hariIndonesia(dateISO),
    minggu_ke: mingguKe(dateISO),
    bulan: bulanIndonesia(dateISO),
  };
}

function readDate(formData: FormData, key = "tanggal"): string {
  const raw = String(formData.get(key) ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : todayWIB();
}

function readNominal(formData: FormData, key = "nominal"): number {
  return toRupiah(parseRupiahInput(String(formData.get(key) ?? "0")));
}

function readOptionalUuid(formData: FormData, key: string): string | null {
  const raw = String(formData.get(key) ?? "").trim();
  return raw.length > 0 && raw !== "none" ? raw : null;
}

function readText(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function readOptionalText(formData: FormData, key: string): string | null {
  const value = readText(formData, key);
  return value.length > 0 ? value : null;
}

/**
 * Parse a boolean from FormData.
 *
 * An unchecked HTML checkbox is OMITTED from the submission entirely, so
 * `formData.get()` returns `null`. Defaulting that `null` to a truthy value
 * (the old `?? "on"` bug) made it impossible to ever submit `false`.
 *
 * The freelance form now also sends an explicit hidden `"true"`/`"false"`
 * string, so every accepted truthy spelling is listed and anything else —
 * including `null`, `""`, and the string `"false"` — reads as `false`.
 */
function readBoolean(formData: FormData, key: string): boolean {
  const raw = formData.get(key);
  if (typeof raw !== "string") return false;
  const value = raw.trim().toLowerCase();
  return value === "true" || value === "on" || value === "1" || value === "yes";
}

/* ─────────────────────────────────────────────────────────────────────────────
   EXPENSE
   ───────────────────────────────────────────────────────────────────────────── */

export async function createExpenseAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  await requireSession();

  const tanggal = readDate(formData);
  const kategori = readText(formData, "kategori");
  const barang = readText(formData, "barang_keperluan");
  const nominal = readNominal(formData);
  const walletId = readOptionalUuid(formData, "wallet_id");

  if (barang.length === 0) {
    return { ok: false, error: "Barang / keperluan wajib diisi.", field: "barang_keperluan" };
  }
  if (nominal <= 0) {
    return { ok: false, error: "Nominal harus lebih besar dari nol.", field: "nominal" };
  }
  if (!EXPENSE_CATEGORIES.includes(kategori as (typeof EXPENSE_CATEGORIES)[number])) {
    return { ok: false, error: "Kategori pengeluaran tidak dikenal.", field: "kategori" };
  }
  if (walletId === null) {
    return { ok: false, error: "Pilih dompet sumber terlebih dahulu.", field: "wallet_id" };
  }

  const payload: TransactionInsert = {
    tanggal,
    ...calendarFor(tanggal),
    tx_type: "expense",
    kategori,
    barang_keperluan: barang,
    nominal,
    wallet_id: walletId,
    target_wallet_id: null,
    is_frozen_freelance: false,
    catatan: readOptionalText(formData, "catatan"),
  };

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("transactions")
      .insert(payload)
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    revalidateAll();
    return {
      ok: true,
      data: { id: data.id },
      message:
        kategori === CIGARETTE_CATEGORY
          ? "Pembelian rokok dicatat. Kuota 3 hari dimulai dari hari ini."
          : "Pengeluaran berhasil dicatat.",
    };
  } catch (error) {
    return { ok: false, error: translateDbError(error) };
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   SALARY INCOME (+ optional 35/25/20/15/5 split)
   ───────────────────────────────────────────────────────────────────────────── */

export async function createSalaryIncomeAction(
  formData: FormData,
): Promise<ActionResult<{ inserted: number; split: boolean }>> {
  await requireSession();

  const tanggal = readDate(formData);
  const kategori = readText(formData, "kategori") || "Gaji Utama";
  const barang = readText(formData, "barang_keperluan") || "Pemasukan gaji";
  const nominal = readNominal(formData) || DEFAULT_SALARY_PRESET;
  const autoSplit = String(formData.get("auto_split") ?? "") === "on";
  const walletId = readOptionalUuid(formData, "wallet_id");
  const catatan = readOptionalText(formData, "catatan");

  if (nominal <= 0) {
    return { ok: false, error: "Nominal gaji harus lebih besar dari nol.", field: "nominal" };
  }

  const calendar = calendarFor(tanggal);

  try {
    const wallets = await fetchWallets();
    const supabase = createServiceClient();

    if (!autoSplit) {
      if (walletId === null) {
        return {
          ok: false,
          error: "Pilih dompet tujuan, atau aktifkan pecah otomatis.",
          field: "wallet_id",
        };
      }

      const { error } = await supabase.from("transactions").insert({
        tanggal,
        ...calendar,
        tx_type: "income_salary",
        kategori,
        barang_keperluan: barang,
        nominal,
        wallet_id: walletId,
        target_wallet_id: null,
        is_frozen_freelance: false,
        catatan,
      });

      if (error) throw new Error(error.message);

      revalidateAll();
      return {
        ok: true,
        data: { inserted: 1, split: false },
        message: "Pemasukan gaji berhasil dicatat.",
      };
    }

    /* ── 1-click Monday 08:00 splitter ────────────────────────────────────
       Each slice becomes its own ledger row so the wallet triggers do the
       arithmetic and the audit trail stays explicit. The "Pengembangan Diri"
       slice has no dedicated wallet in the 5-slot model, so it is booked to
       Operasional Harian with the allocation stated in `catatan`.            */
    const byCategory = (category: WalletCategory): string | null =>
      wallets.find((w) => w.category === category)?.id ?? null;

    const operasionalId = byCategory("operasional");
    const slices = splitSalary(nominal);

    const rows: TransactionInsert[] = slices.map((slice) => {
      const targetId =
        slice.walletCategory === null
          ? operasionalId
          : byCategory(slice.walletCategory);

      return {
        tanggal,
        ...calendar,
        tx_type: "income_salary" satisfies TxType,
        kategori,
        barang_keperluan: `Pecah gaji — ${slice.label} (${Math.round(slice.ratio * 100)}%)`,
        nominal: slice.amount,
        wallet_id: targetId,
        target_wallet_id: null,
        is_frozen_freelance: false,
        catatan:
          slice.walletCategory === null
            ? `Alokasi ${Math.round(slice.ratio * 100)}% Pengembangan Diri, dititipkan di Operasional Harian. ${slice.note}`
            : `${slice.note}${catatan === null ? "" : ` · ${catatan}`}`,
      };
    });

    const unmapped = rows.filter((row) => row.wallet_id === null);
    if (unmapped.length > 0) {
      return {
        ok: false,
        error:
          "Beberapa dompet tujuan tidak ditemukan. Pastikan 5 dompet bawaan (darurat, operasional, produktif, investasi, freelance) masih ada.",
      };
    }

    const { error } = await supabase.from("transactions").insert(rows);
    if (error) throw new Error(error.message);

    revalidateAll();
    return {
      ok: true,
      data: { inserted: rows.length, split: true },
      message: `Gaji dipecah otomatis ke ${rows.length} alokasi: 35% Darurat, 25% Produktif, 20% Investasi, 15% Operasional, 5% Pengembangan Diri.`,
    };
  } catch (error) {
    return { ok: false, error: translateDbError(error) };
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   FREELANCE INCOME (30-day freeze)
   ───────────────────────────────────────────────────────────────────────────── */

export async function createFreelanceIncomeAction(
  formData: FormData,
): Promise<ActionResult<{ id: string; unlockDate: string }>> {
  await requireSession();

  const tanggal = readDate(formData);
  const kategori = readText(formData, "kategori") || "Proyek Desain";
  const barang = readText(formData, "barang_keperluan");
  const nominal = readNominal(formData);
  const client = readOptionalText(formData, "client");
  // Strictly the submitted boolean. No implicit default — unchecking the box
  // must persist `is_frozen_freelance = false`.
  const freeze = readBoolean(formData, "freeze");

  if (barang.length === 0) {
    return { ok: false, error: "Nama proyek wajib diisi.", field: "barang_keperluan" };
  }
  if (nominal <= 0) {
    return { ok: false, error: "Nominal proyek harus lebih besar dari nol.", field: "nominal" };
  }

  try {
    const wallets = await fetchWallets();
    const freelanceWallet = wallets.find((w) => w.category === "freelance");

    if (freelanceWallet === undefined) {
      return {
        ok: false,
        error: "Dompet kategori 'freelance' tidak ditemukan. Buat Kantong Freelance terlebih dahulu.",
      };
    }

    const unlockDate = firstOfNextMonth(tanggal);
    const split = splitFreelance(nominal);
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("transactions")
      .insert({
        tanggal,
        ...calendarFor(tanggal),
        tx_type: "income_freelance",
        kategori,
        barang_keperluan: barang,
        nominal,
        wallet_id: freelanceWallet.id,
        target_wallet_id: null,
        is_frozen_freelance: freeze,
        catatan: [
          client === null ? null : `Klien: ${client}`,
          freeze ? `Dibekukan sampai ${unlockDate}.` : "Tidak dibekukan.",
          `Rencana pecah saat unlock — 70% Tabungan/Investasi Rp${split.tabunganInvestasi.toLocaleString("id-ID")} : 30% Self-Reward Rp${split.selfReward.toLocaleString("id-ID")}.`,
          readOptionalText(formData, "catatan"),
        ]
          .filter((part): part is string => part !== null)
          .join(" · "),
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    revalidateAll();
    return {
      ok: true,
      data: { id: data.id, unlockDate },
      message: freeze
        ? `Proyek dicatat dan dibekukan sampai ${unlockDate}.`
        : "Proyek freelance dicatat tanpa pembekuan — dana langsung aktif/likuid.",
    };
  } catch (error) {
    return { ok: false, error: translateDbError(error) };
  }
}

/**
 * Toggle the freeze flag on an existing freelance row ("Lepas Beku" / "Bekukan").
 *
 * This only flips `is_frozen_freelance`; it does NOT move money. Unfreezing
 * makes the amount count as active/liquid freelance income immediately and
 * removes it from the FREELANCE BEKU total.
 *
 * Use `unlockFreelanceAction` instead when the 70:30 split should actually be
 * booked as ledger transfers.
 */
export async function setFreelanceFreezeAction(
  transactionId: string,
  frozen: boolean,
): Promise<ActionResult<{ frozen: boolean }>> {
  await requireSession();

  if (transactionId.length === 0) {
    return { ok: false, error: "ID transaksi tidak valid." };
  }

  try {
    const supabase = createServiceClient();

    const { data: tx, error: readError } = await supabase
      .from("transactions")
      .select("tx_type, barang_keperluan")
      .eq("id", transactionId)
      .single();

    if (readError) throw new Error(readError.message);
    if (tx.tx_type !== "income_freelance") {
      return {
        ok: false,
        error: "Hanya transaksi pemasukan freelance yang bisa dibekukan.",
      };
    }

    const { error } = await supabase
      .from("transactions")
      .update({ is_frozen_freelance: frozen })
      .eq("id", transactionId);

    if (error) throw new Error(error.message);

    revalidateAll();
    return {
      ok: true,
      data: { frozen },
      message: frozen
        ? `"${tx.barang_keperluan}" dibekukan kembali.`
        : `"${tx.barang_keperluan}" dilepas dari pembekuan — dana kini aktif/likuid.`,
    };
  } catch (error) {
    return { ok: false, error: translateDbError(error) };
  }
}

/**
 * Release frozen freelance income and book the 70:30 split.
 *
 * Unfreezing is modelled as two transfers out of Kantong Freelance so the
 * ledger keeps a verifiable trail and the wallet triggers stay authoritative.
 */
export async function unlockFreelanceAction(
  transactionId: string,
): Promise<ActionResult<{ tabunganInvestasi: number; selfReward: number }>> {
  await requireSession();

  if (transactionId.length === 0) {
    return { ok: false, error: "ID transaksi tidak valid." };
  }

  try {
    const supabase = createServiceClient();
    const wallets = await fetchWallets();

    const { data: tx, error: readError } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (readError) throw new Error(readError.message);
    if (tx.tx_type !== "income_freelance") {
      return { ok: false, error: "Transaksi ini bukan pemasukan freelance." };
    }
    if (!tx.is_frozen_freelance) {
      return { ok: false, error: "Transaksi ini sudah tidak dibekukan." };
    }

    const today = todayWIB();
    if (today < firstOfNextMonth(tx.tanggal)) {
      return {
        ok: false,
        error: `Masih dibekukan. Dana baru boleh dipecah pada ${firstOfNextMonth(tx.tanggal)}.`,
      };
    }

    const freelanceWallet = wallets.find((w) => w.category === "freelance");
    const produktifWallet = wallets.find((w) => w.category === "produktif");
    const investasiWallet = wallets.find((w) => w.category === "investasi");

    if (
      freelanceWallet === undefined ||
      produktifWallet === undefined ||
      investasiWallet === undefined
    ) {
      return {
        ok: false,
        error: "Dompet freelance, produktif, atau investasi tidak ditemukan.",
      };
    }

    const split = splitFreelance(tx.nominal);
    const calendar = calendarFor(today);

    const transfers: TransactionInsert[] = [
      {
        tanggal: today,
        ...calendar,
        tx_type: "transfer",
        kategori: "Pecah Freelance 70:30",
        barang_keperluan: `Unlock "${tx.barang_keperluan}" — 35% Tabungan Produktif`,
        nominal: split.tabunganProduktif,
        wallet_id: freelanceWallet.id,
        target_wallet_id: produktifWallet.id,
        is_frozen_freelance: false,
        catatan: `Bagian dari 70% Tabungan & Investasi (Rp${split.tabunganInvestasi.toLocaleString("id-ID")}).`,
      },
      {
        tanggal: today,
        ...calendar,
        tx_type: "transfer",
        kategori: "Pecah Freelance 70:30",
        barang_keperluan: `Unlock "${tx.barang_keperluan}" — 35% Investasi Pemula`,
        nominal: split.investasiPemula,
        wallet_id: freelanceWallet.id,
        target_wallet_id: investasiWallet.id,
        is_frozen_freelance: false,
        catatan: `Bagian dari 70% Tabungan & Investasi (Rp${split.tabunganInvestasi.toLocaleString("id-ID")}). Sisa Rp${split.selfReward.toLocaleString("id-ID")} (30%) tetap di Kantong Freelance sebagai Self-Reward.`,
      },
    ];

    const { error: insertError } = await supabase.from("transactions").insert(transfers);
    if (insertError) throw new Error(insertError.message);

    const { error: updateError } = await supabase
      .from("transactions")
      .update({ is_frozen_freelance: false })
      .eq("id", transactionId);

    if (updateError) throw new Error(updateError.message);

    revalidateAll();
    return {
      ok: true,
      data: {
        tabunganInvestasi: split.tabunganInvestasi,
        selfReward: split.selfReward,
      },
      message: `Dana dilepas. 70% (Rp${split.tabunganInvestasi.toLocaleString("id-ID")}) dipindah ke Tabungan & Investasi, 30% (Rp${split.selfReward.toLocaleString("id-ID")}) tersisa sebagai Self-Reward.`,
    };
  } catch (error) {
    return { ok: false, error: translateDbError(error) };
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   TRANSFER / DELETE / QUICK LOG
   ───────────────────────────────────────────────────────────────────────────── */

export async function createTransferAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  await requireSession();

  const tanggal = readDate(formData);
  const from = readOptionalUuid(formData, "wallet_id");
  const to = readOptionalUuid(formData, "target_wallet_id");
  const nominal = readNominal(formData);

  if (from === null) {
    return { ok: false, error: "Pilih dompet sumber.", field: "wallet_id" };
  }
  if (to === null) {
    return { ok: false, error: "Pilih dompet tujuan.", field: "target_wallet_id" };
  }
  if (from === to) {
    return {
      ok: false,
      error: "Dompet sumber dan tujuan tidak boleh sama.",
      field: "target_wallet_id",
    };
  }
  if (nominal <= 0) {
    return { ok: false, error: "Nominal transfer harus lebih besar dari nol.", field: "nominal" };
  }

  try {
    const wallets = await fetchWallets();
    const source = wallets.find((w) => w.id === from);

    if (source !== undefined && source.balance < nominal) {
      return {
        ok: false,
        error: `Saldo ${source.name} hanya Rp${source.balance.toLocaleString("id-ID")}. Tidak cukup untuk transfer Rp${nominal.toLocaleString("id-ID")}.`,
        field: "nominal",
      };
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("transactions")
      .insert({
        tanggal,
        ...calendarFor(tanggal),
        tx_type: "transfer",
        kategori: "Transfer Antar Dompet",
        barang_keperluan:
          readOptionalText(formData, "barang_keperluan") ?? "Transfer antar dompet",
        nominal,
        wallet_id: from,
        target_wallet_id: to,
        is_frozen_freelance: false,
        catatan: readOptionalText(formData, "catatan"),
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    revalidateAll();
    return { ok: true, data: { id: data.id }, message: "Transfer berhasil dicatat." };
  } catch (error) {
    return { ok: false, error: translateDbError(error) };
  }
}

export async function deleteTransactionAction(
  id: string,
): Promise<ActionResult<undefined>> {
  await requireSession();

  if (id.length === 0) return { ok: false, error: "ID transaksi tidak valid." };

  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) throw new Error(error.message);

    revalidateAll();
    return {
      ok: true,
      data: undefined,
      message: "Transaksi dihapus. Saldo dompet dikoreksi otomatis.",
    };
  } catch (error) {
    return { ok: false, error: translateDbError(error) };
  }
}

/**
 * Quick-log (Ctrl+K). A single compact entry point that routes to the right
 * transaction type without leaving the current page.
 */
export async function quickLogAction(
  formData: FormData,
): Promise<ActionResult<{ type: TxType }>> {
  await requireSession();

  const type = String(formData.get("tx_type") ?? "expense") as TxType;

  switch (type) {
    case "expense": {
      const result = await createExpenseAction(formData);
      return result.ok
        ? { ok: true, data: { type }, message: result.message }
        : { ok: false, error: result.error, field: result.field };
    }
    case "income_salary": {
      const result = await createSalaryIncomeAction(formData);
      return result.ok
        ? { ok: true, data: { type }, message: result.message }
        : { ok: false, error: result.error, field: result.field };
    }
    case "income_freelance": {
      const result = await createFreelanceIncomeAction(formData);
      return result.ok
        ? { ok: true, data: { type }, message: result.message }
        : { ok: false, error: result.error, field: result.field };
    }
    case "transfer": {
      const result = await createTransferAction(formData);
      return result.ok
        ? { ok: true, data: { type }, message: result.message }
        : { ok: false, error: result.error, field: result.field };
    }
    default:
      return { ok: false, error: "Jenis transaksi tidak dikenal." };
  }
}

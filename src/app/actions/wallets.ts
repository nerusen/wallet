"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/guard";
import { MAX_WALLETS } from "@/lib/constants";
import { parseRupiahInput } from "@/lib/format";
import { toRupiah } from "@/lib/finance";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchWallets } from "@/lib/supabase/queries";
import type {
  AccentTag,
  ActionResult,
  Wallet,
  WalletCategory,
} from "@/lib/types/database";
import { translateDbError } from "@/lib/utils";

const WALLET_CATEGORIES: readonly WalletCategory[] = [
  "darurat",
  "operasional",
  "produktif",
  "investasi",
  "freelance",
];

const ACCENT_TAGS: readonly AccentTag[] = ["green", "monochrome"];

function revalidateWalletViews(): void {
  for (const path of ["/dompet", "/dashboard", "/pemasukan", "/pengeluaran", "/laporan"]) {
    revalidatePath(path);
  }
}

/**
 * Create a wallet.
 *
 * The 5-slot cap is enforced by the `enforce_max_5_wallets()` database
 * trigger. The pre-check here exists only to produce a friendlier message and
 * is NOT the security boundary — a concurrent insert is still correctly
 * rejected by the trigger.
 */
export async function createWalletAction(
  formData: FormData,
): Promise<ActionResult<{ id: string; slotsUsed: number }>> {
  await requireSession();

  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() as WalletCategory;
  const target = toRupiah(parseRupiahInput(String(formData.get("target_amount") ?? "0")));
  const accent = String(formData.get("accent_tag") ?? "monochrome") as AccentTag;

  if (name.length === 0) {
    return { ok: false, error: "Nama dompet wajib diisi.", field: "name" };
  }
  if (!WALLET_CATEGORIES.includes(category)) {
    return { ok: false, error: "Kategori dompet tidak dikenal.", field: "category" };
  }
  if (!ACCENT_TAGS.includes(accent)) {
    return { ok: false, error: "Accent tag tidak dikenal.", field: "accent_tag" };
  }
  if (target < 0) {
    return { ok: false, error: "Target tidak boleh negatif.", field: "target_amount" };
  }

  try {
    const existing = await fetchWallets();
    if (existing.length >= MAX_WALLETS) {
      return {
        ok: false,
        error: `Maksimal ${MAX_WALLETS} dompet (${existing.length}/${MAX_WALLETS} slot terpakai). Hapus salah satu dompet sebelum menambah yang baru.`,
      };
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("wallets")
      .insert({
        name,
        category,
        balance: 0,
        target_amount: target,
        accent_tag: accent,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    revalidateWalletViews();
    return {
      ok: true,
      data: { id: data.id, slotsUsed: existing.length + 1 },
      message: `Dompet "${name}" dibuat. ${existing.length + 1}/${MAX_WALLETS} slot terpakai.`,
    };
  } catch (error) {
    return { ok: false, error: translateDbError(error) };
  }
}

export async function updateWalletAction(
  formData: FormData,
): Promise<ActionResult<undefined>> {
  await requireSession();

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const target = toRupiah(parseRupiahInput(String(formData.get("target_amount") ?? "0")));
  const accent = String(formData.get("accent_tag") ?? "monochrome") as AccentTag;

  if (id.length === 0) return { ok: false, error: "ID dompet tidak valid." };
  if (name.length === 0) {
    return { ok: false, error: "Nama dompet wajib diisi.", field: "name" };
  }
  if (!ACCENT_TAGS.includes(accent)) {
    return { ok: false, error: "Accent tag tidak dikenal.", field: "accent_tag" };
  }
  if (target < 0) {
    return { ok: false, error: "Target tidak boleh negatif.", field: "target_amount" };
  }

  try {
    const supabase = createServiceClient();
    // `balance` is intentionally NOT writable here: it is derived state owned
    // by the sync_wallet_balances() trigger.
    const { error } = await supabase
      .from("wallets")
      .update({ name, target_amount: target, accent_tag: accent })
      .eq("id", id);

    if (error) throw new Error(error.message);

    revalidateWalletViews();
    return { ok: true, data: undefined, message: "Dompet diperbarui." };
  } catch (error) {
    return { ok: false, error: translateDbError(error) };
  }
}

/**
 * Delete a wallet.
 *
 * `transactions.wallet_id` is `ON DELETE SET NULL`, so historical rows survive
 * as orphaned ledger entries rather than vanishing. That is deliberate: a
 * financial record should never be silently erased.
 */
export async function deleteWalletAction(
  id: string,
): Promise<ActionResult<{ orphanedTransactions: number }>> {
  await requireSession();

  if (id.length === 0) return { ok: false, error: "ID dompet tidak valid." };

  try {
    const supabase = createServiceClient();

    const { count, error: countError } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .or(`wallet_id.eq.${id},target_wallet_id.eq.${id}`);

    if (countError) throw new Error(countError.message);

    const { error } = await supabase.from("wallets").delete().eq("id", id);
    if (error) throw new Error(error.message);

    revalidateWalletViews();
    return {
      ok: true,
      data: { orphanedTransactions: count ?? 0 },
      message:
        (count ?? 0) > 0
          ? `Dompet dihapus. ${count} transaksi lama tetap tersimpan di laporan tanpa dompet.`
          : "Dompet dihapus.",
    };
  } catch (error) {
    return { ok: false, error: translateDbError(error) };
  }
}

/** Rebuild every balance from the ledger. Used after a CSV import. */
export async function recalculateBalancesAction(): Promise<
  ActionResult<{ wallets: Wallet[] }>
> {
  await requireSession();

  try {
    const supabase = createServiceClient();
    const { error } = await supabase.rpc("recalculate_wallet_balances");
    if (error) throw new Error(error.message);

    const wallets = await fetchWallets();
    revalidateWalletViews();
    return {
      ok: true,
      data: { wallets },
      message: "Saldo seluruh dompet dihitung ulang dari buku besar.",
    };
  } catch (error) {
    return { ok: false, error: translateDbError(error) };
  }
}

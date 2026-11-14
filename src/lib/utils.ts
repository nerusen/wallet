import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Clamp a number into [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Narrow `unknown` thrown values into a readable message. */
export function errorMessage(error: unknown, fallback = "Terjadi kesalahan tak terduga."): string {
  if (error instanceof Error && error.message.length > 0) return error.message;
  if (typeof error === "string" && error.length > 0) return error;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
}

/**
 * Translate a raised Postgres exception into the Indonesian message the UI
 * should show. The database is the authority on these rules, so we surface
 * its own wording rather than re-deriving it client-side.
 */
export function translateDbError(error: unknown): string {
  const raw = errorMessage(error, "Gagal menyimpan ke database.");

  if (raw.includes("BATAS_DOMPET")) {
    return "Maksimal 5 dompet. Hapus salah satu dompet sebelum menambah yang baru.";
  }
  if (raw.includes("KARANTINA_48_JAM")) {
    return "Wishlist ini masih dikarantina. Tunggu sampai 48 jam penuh terlewati.";
  }
  if (raw.includes("wallets_name_unique")) {
    return "Nama dompet sudah dipakai. Gunakan nama lain.";
  }
  if (raw.includes("transactions_transfer_shape_check")) {
    return "Transfer butuh dompet tujuan yang berbeda dari dompet sumber.";
  }
  if (raw.includes("transactions_nominal_check")) {
    return "Nominal tidak boleh negatif.";
  }

  return raw;
}

/** Stable, dependency-free id for optimistic client rows. */
export function tempId(prefix = "tmp"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

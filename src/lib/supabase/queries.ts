import "server-only";

import { unstable_noStore as noStore } from "next/cache";

import { SYSTEM_START_DATE } from "@/lib/constants";
import { createServiceClient } from "@/lib/supabase/server";
import type {
  DailyAudit,
  KanbanTask,
  Transaction,
  Wallet,
} from "@/lib/types/database";

/**
 * Read-side data access.
 *
 * Every query opts out of the Data Cache (`noStore`) because this is a live
 * financial ledger: a stale balance is a wrong balance. Freshness beyond that
 * is handled by Realtime on the client and `revalidatePath` after mutations.
 */

export interface LedgerSnapshot {
  wallets: Wallet[];
  transactions: Transaction[];
  tasks: KanbanTask[];
  audits: DailyAudit[];
  /** Non-fatal load errors, surfaced in the UI rather than thrown. */
  error: string | null;
}

export async function fetchWallets(): Promise<Wallet[]> {
  noStore();
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("wallets")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchTransactions(options: {
  from?: string;
  to?: string;
  limit?: number;
} = {}): Promise<Transaction[]> {
  noStore();
  const supabase = createServiceClient();

  let query = supabase
    .from("transactions")
    .select("*")
    .order("tanggal", { ascending: false })
    .order("created_at", { ascending: false });

  if (options.from !== undefined) query = query.gte("tanggal", options.from);
  if (options.to !== undefined) query = query.lte("tanggal", options.to);
  query = query.limit(options.limit ?? 5000);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchKanbanTasks(): Promise<KanbanTask[]> {
  noStore();
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("kanban_tasks")
    .select("*")
    .order("status", { ascending: true })
    .order("position", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchDailyAudits(limit = 400): Promise<DailyAudit[]> {
  noStore();
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("daily_audits")
    .select("*")
    .gte("audit_date", SYSTEM_START_DATE)
    .order("audit_date", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * One parallel fetch of everything a page needs.
 *
 * Load failures are returned, not thrown, so an unconfigured or unreachable
 * Supabase instance renders an actionable empty state instead of a 500.
 */
export async function fetchSnapshot(
  parts: {
    wallets?: boolean;
    transactions?: boolean;
    tasks?: boolean;
    audits?: boolean;
    transactionRange?: { from?: string; to?: string; limit?: number };
  } = {},
): Promise<LedgerSnapshot> {
  const want = {
    wallets: parts.wallets ?? true,
    transactions: parts.transactions ?? true,
    tasks: parts.tasks ?? false,
    audits: parts.audits ?? false,
  };

  try {
    const [wallets, transactions, tasks, audits] = await Promise.all([
      want.wallets ? fetchWallets() : Promise.resolve<Wallet[]>([]),
      want.transactions
        ? fetchTransactions(parts.transactionRange ?? {})
        : Promise.resolve<Transaction[]>([]),
      want.tasks ? fetchKanbanTasks() : Promise.resolve<KanbanTask[]>([]),
      want.audits ? fetchDailyAudits() : Promise.resolve<DailyAudit[]>([]),
    ]);

    return { wallets, transactions, tasks, audits, error: null };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Gagal memuat data dari Supabase.";
    return {
      wallets: [],
      transactions: [],
      tasks: [],
      audits: [],
      error: message,
    };
  }
}

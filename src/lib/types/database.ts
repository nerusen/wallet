/**
 * Database row shapes.
 *
 * Hand-authored to mirror `supabase/migrations/*_init_personal_finance_os.sql`
 * exactly. Regenerate with `npm run db:types` once the migration is pushed.
 *
 * `numeric(15,2)` columns arrive from supabase-js as JS `number`. Every
 * monetary value in this app is an integer count of Rupiah (no sub-unit is
 * used in practice), so float drift is not a concern at these magnitudes;
 * all arithmetic additionally rounds through `toRupiah()` in lib/finance.
 */

export type WalletCategory =
  | "darurat"
  | "operasional"
  | "produktif"
  | "investasi"
  | "freelance";

export type AccentTag = "green" | "monochrome";

export type TxType =
  | "income_salary"
  | "income_freelance"
  | "expense"
  | "transfer";

export type TaskType = "freelance_project" | "wishlist_48h" | "career_task";

export type TaskStatus = "backlog" | "in_progress" | "review" | "done";

export interface Wallet {
  id: string;
  name: string;
  category: WalletCategory;
  balance: number;
  target_amount: number | null;
  accent_tag: AccentTag | null;
  created_at: string;
}

export interface Transaction {
  id: string;
  tanggal: string; // ISO date, 'YYYY-MM-DD'
  hari: string;
  minggu_ke: number;
  bulan: string;
  tx_type: TxType;
  kategori: string;
  barang_keperluan: string;
  nominal: number;
  wallet_id: string | null;
  target_wallet_id: string | null;
  is_frozen_freelance: boolean;
  catatan: string | null;
  created_at: string;
}

export interface KanbanTask {
  id: string;
  title: string;
  task_type: TaskType;
  status: TaskStatus;
  amount: number;
  client_or_store: string | null;
  unlock_at: string | null;
  notes: string | null;
  position: number;
  created_at: string;
}

export interface DailyAudit {
  id: string;
  audit_date: string;
  evening_audit_done: boolean;
  monday_split_done: boolean;
  notes: string | null;
  created_at: string;
}

export type WalletInsert = Omit<Wallet, "id" | "created_at" | "balance"> & {
  balance?: number;
};

export type TransactionInsert = Omit<Transaction, "id" | "created_at">;

export type KanbanTaskInsert = Omit<
  KanbanTask,
  "id" | "created_at" | "position"
> & { position?: number };

/** Tables exposed on the `supabase_realtime` publication. */
export const REALTIME_TABLES = [
  "wallets",
  "transactions",
  "kanban_tasks",
  "daily_audits",
] as const;

export type RealtimeTable = (typeof REALTIME_TABLES)[number];

export interface Database {
  public: {
    Tables: {
      wallets: {
        Row: Wallet;
        Insert: WalletInsert;
        Update: Partial<WalletInsert>;
      };
      transactions: {
        Row: Transaction;
        Insert: TransactionInsert;
        Update: Partial<TransactionInsert>;
      };
      kanban_tasks: {
        Row: KanbanTask;
        Insert: KanbanTaskInsert;
        Update: Partial<KanbanTaskInsert>;
      };
      daily_audits: {
        Row: DailyAudit;
        Insert: Omit<DailyAudit, "id" | "created_at">;
        Update: Partial<Omit<DailyAudit, "id" | "created_at">>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      recalculate_wallet_balances: {
        Args: Record<string, never>;
        Returns: void;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

/** Result envelope returned by every Server Action in this app. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; field?: string };

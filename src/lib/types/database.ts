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

export type Wallet = {
  id: string;
  name: string;
  category: WalletCategory;
  balance: number;
  target_amount: number | null;
  accent_tag: AccentTag | null;
  created_at: string;
};

export type Transaction = {
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
};

export type KanbanTask = {
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
};

export type DailyAudit = {
  id: string;
  audit_date: string;
  evening_audit_done: boolean;
  monday_split_done: boolean;
  notes: string | null;
  created_at: string;
};

/*
 * Insert types.
 *
 * Columns that the database fills itself are optional here, mirroring the
 * migration's DEFAULTs and BEFORE-INSERT triggers:
 *   • wallets.balance            → DEFAULT 0, then owned by sync_wallet_balances()
 *   • transactions.hari/minggu_ke/bulan → derive_transaction_calendar()
 *   • kanban_tasks.position/unlock_at   → prepare_kanban_task()
 *   • daily_audits.*_done        → DEFAULT false
 */

export type WalletInsert = Omit<Wallet, "id" | "created_at" | "balance"> & {
  balance?: number;
};

export type TransactionInsert = Omit<
  Transaction,
  "id" | "created_at" | "hari" | "minggu_ke" | "bulan" | "is_frozen_freelance"
> & {
  hari?: string;
  minggu_ke?: number;
  bulan?: string;
  is_frozen_freelance?: boolean;
};

export type KanbanTaskInsert = Omit<
  KanbanTask,
  "id" | "created_at" | "position"
> & { position?: number };

export type DailyAuditInsert = Omit<
  DailyAudit,
  "id" | "created_at" | "evening_audit_done" | "monday_split_done" | "notes"
> & {
  evening_audit_done?: boolean;
  monday_split_done?: boolean;
  notes?: string | null;
};

/** Tables exposed on the `supabase_realtime` publication. */
export const REALTIME_TABLES = [
  "wallets",
  "transactions",
  "kanban_tasks",
  "daily_audits",
] as const;

export type RealtimeTable = (typeof REALTIME_TABLES)[number];

/**
 * Schema type consumed by `createClient<Database>()`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * READ BEFORE EDITING — three non-obvious requirements, each verified against
 * supabase-js 2.45.4 and 2.119.0.
 *
 * 1. The `Row` types above MUST be `type` aliases, NOT `interface`.
 *    supabase-js checks every table against its internal `GenericTable`, whose
 *    `Row` is `Record<string, unknown>`. An `interface` has no implicit index
 *    signature and therefore does NOT satisfy `Record<string, unknown>`; a
 *    `type` alias for an object literal does. When the check fails, the schema
 *    silently collapses and every row resolves to `never`, which surfaces as
 *    "Property 'x' does not exist on type 'never'" at an unrelated call site
 *    rather than here. This is the single easiest way to break this file.
 *
 * 2. Every table needs `Relationships`. It is required by `GenericTable`.
 *    `[]` is accurate here: this app never uses embedded-resource selects
 *    (`select('*, other(*)')`).
 *
 * 3. Empty sections use `{ [_ in never]: never }` — a mapped type over an empty
 *    key union — which is what `supabase gen types typescript` emits.
 *
 * Regenerate with `npm run db:types` after changing the migration; the
 * generated output already follows all three rules.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export interface Database {
  public: {
    Tables: {
      wallets: {
        Row: Wallet;
        Insert: WalletInsert;
        Update: Partial<WalletInsert>;
        Relationships: [];
      };
      transactions: {
        Row: Transaction;
        Insert: TransactionInsert;
        Update: Partial<TransactionInsert>;
        Relationships: [];
      };
      kanban_tasks: {
        Row: KanbanTask;
        Insert: KanbanTaskInsert;
        Update: Partial<KanbanTaskInsert>;
        Relationships: [];
      };
      daily_audits: {
        Row: DailyAudit;
        Insert: DailyAuditInsert;
        Update: Partial<DailyAuditInsert>;
        Relationships: [];
      };
    };
    /* Empty sections — see rule 3 in the block comment above. */
    Views: { [_ in never]: never };
    Functions: {
      recalculate_wallet_balances: {
        Args: { [_ in never]: never };
        Returns: undefined;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}

/** Result envelope returned by every Server Action in this app. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; field?: string };

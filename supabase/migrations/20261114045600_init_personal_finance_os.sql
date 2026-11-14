-- ════════════════════════════════════════════════════════════════════════════
--  PERSONAL FINANCE OS — initial schema
--  Migration: init_personal_finance_os
--
--  Single-user, self-hosted personal finance & career command centre.
--  Timeline baseline: 13 November 2026.
--
--  This migration is fully IDEMPOTENT: it can be re-applied safely.
--
--  Contents
--    1. Extensions
--    2. Enum-ish domain constants (as CHECK constraints) + helper functions
--    3. Table: wallets            (+ max-5 enforcement trigger)
--    4. Table: transactions       (+ Indonesian date derivation, balance sync trigger)
--    5. Table: kanban_tasks       (+ 48h quarantine unlock_at, position autofill)
--    6. Table: daily_audits
--    7. Indexes
--    8. Row Level Security + policies
--    9. Supabase Realtime publication
--   10. Seed data (5 wallets + 2026-11-13 opening baseline)
--   11. Post-seed arithmetic assertion
--
--  DO NOT run `supabase db reset`. Apply with `supabase db push`.
-- ════════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- 1. EXTENSIONS
-- ───────────────────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto" with schema extensions;


-- ───────────────────────────────────────────────────────────────────────────
-- 2. HELPER FUNCTIONS (Indonesian calendar labels)
-- ───────────────────────────────────────────────────────────────────────────

-- Indonesian day name for a date. Monday = 'Senin'.
create or replace function public.id_hari(p_date date)
returns text
language sql
immutable
set search_path = ''
as $$
  select (array[
    'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'
  ])[extract(isodow from p_date)::int];
$$;

comment on function public.id_hari(date) is
  'Indonesian weekday label for a date (Senin..Minggu), driven by ISO day-of-week.';


-- Indonesian month name for a date.
create or replace function public.id_bulan(p_date date)
returns text
language sql
immutable
set search_path = ''
as $$
  select (array[
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ])[extract(month from p_date)::int];
$$;

comment on function public.id_bulan(date) is
  'Indonesian month label for a date (Januari..Desember).';


-- Week-of-month ordinal (1..5). "Minggu ke-N" within the calendar month.
create or replace function public.id_minggu_ke(p_date date)
returns integer
language sql
immutable
set search_path = ''
as $$
  select floor((extract(day from p_date)::numeric - 1) / 7)::int + 1;
$$;

comment on function public.id_minggu_ke(date) is
  'Week-of-month ordinal 1..5. Rolling 7-day weekly budget windows are computed in the app layer from ISO Monday boundaries; this column is the human-readable report label.';


-- ───────────────────────────────────────────────────────────────────────────
-- 3. TABLE: wallets
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.wallets (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  category      text not null,
  balance       numeric(15, 2) not null default 0,
  target_amount numeric(15, 2) default 0,
  accent_tag    text default 'monochrome',
  created_at    timestamptz not null default now()
);

comment on table public.wallets is
  'Vaults / pockets. Hard-capped at 5 rows by the enforce_max_5_wallets trigger.';
comment on column public.wallets.category is
  'darurat | operasional | produktif | investasi | freelance';
comment on column public.wallets.accent_tag is
  'green | monochrome — drives the brutalist accent treatment in the UI.';
comment on column public.wallets.balance is
  'Derived value. Maintained exclusively by sync_wallet_balances(); never write directly.';

-- Constraints are added defensively so re-running the migration never errors.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'wallets_category_check'
  ) then
    alter table public.wallets
      add constraint wallets_category_check
      check (category in ('darurat', 'operasional', 'produktif', 'investasi', 'freelance'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'wallets_accent_tag_check'
  ) then
    alter table public.wallets
      add constraint wallets_accent_tag_check
      check (accent_tag in ('green', 'monochrome'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'wallets_name_not_blank'
  ) then
    alter table public.wallets
      add constraint wallets_name_not_blank
      check (length(btrim(name)) > 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'wallets_target_amount_nonneg'
  ) then
    alter table public.wallets
      add constraint wallets_target_amount_nonneg
      check (target_amount is null or target_amount >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'wallets_name_unique'
  ) then
    alter table public.wallets
      add constraint wallets_name_unique unique (name);
  end if;
end
$$;


-- ── Max-5-wallet rule, enforced in the database, not just the UI ───────────

create or replace function public.enforce_max_5_wallets()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.wallets;

  if v_count >= 5 then
    raise exception
      'BATAS_DOMPET: Maksimal 5 dompet. Saat ini sudah ada % dompet terpakai (5/5 slot). Hapus salah satu dompet sebelum menambah yang baru.',
      v_count
      using errcode = 'check_violation',
            hint = 'Delete an existing wallet first — the 5-slot cap is enforced at the database level.';
  end if;

  return new;
end;
$$;

comment on function public.enforce_max_5_wallets() is
  'BEFORE INSERT guard on wallets. Raises check_violation once 5 wallets exist.';

drop trigger if exists trg_enforce_max_5_wallets on public.wallets;
create trigger trg_enforce_max_5_wallets
  before insert on public.wallets
  for each row
  execute function public.enforce_max_5_wallets();


-- ───────────────────────────────────────────────────────────────────────────
-- 4. TABLE: transactions
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.transactions (
  id                  uuid primary key default gen_random_uuid(),
  tanggal             date not null default current_date,
  hari                text not null,
  minggu_ke           integer not null,
  bulan               text not null,
  tx_type             text not null,
  kategori            text not null,
  barang_keperluan    text not null,
  nominal             numeric(15, 2) not null,
  wallet_id           uuid references public.wallets (id) on delete set null,
  target_wallet_id    uuid references public.wallets (id) on delete set null,
  is_frozen_freelance boolean not null default false,
  catatan             text,
  created_at          timestamptz not null default now()
);

comment on table public.transactions is
  'Immutable-by-convention ledger. Every row mutates wallets.balance via sync_wallet_balances().';
comment on column public.transactions.tx_type is
  'income_salary | income_freelance | expense | transfer';
comment on column public.transactions.target_wallet_id is
  'Destination pocket. Required only when tx_type = ''transfer''.';
comment on column public.transactions.is_frozen_freelance is
  'Freelance income quarantined until the 1st of the following month (30-day freeze rule).';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'transactions_tx_type_check'
  ) then
    alter table public.transactions
      add constraint transactions_tx_type_check
      check (tx_type in ('income_salary', 'income_freelance', 'expense', 'transfer'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'transactions_nominal_check'
  ) then
    alter table public.transactions
      add constraint transactions_nominal_check
      check (nominal >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'transactions_minggu_ke_check'
  ) then
    alter table public.transactions
      add constraint transactions_minggu_ke_check
      check (minggu_ke between 1 and 5);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'transactions_transfer_shape_check'
  ) then
    -- A transfer must name a destination that differs from its source.
    alter table public.transactions
      add constraint transactions_transfer_shape_check
      check (
        (tx_type <> 'transfer')
        or (
          target_wallet_id is not null
          and (wallet_id is null or target_wallet_id <> wallet_id)
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'transactions_barang_not_blank'
  ) then
    alter table public.transactions
      add constraint transactions_barang_not_blank
      check (length(btrim(barang_keperluan)) > 0);
  end if;
end
$$;


-- ── Auto-derive the Indonesian calendar labels from `tanggal` ──────────────
-- Keeps CSV imports and raw SQL inserts correct without duplicating the
-- locale table in every client.

create or replace function public.derive_transaction_calendar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.hari is null or length(btrim(new.hari)) = 0 then
    new.hari := public.id_hari(new.tanggal);
  end if;

  if new.bulan is null or length(btrim(new.bulan)) = 0 then
    new.bulan := public.id_bulan(new.tanggal);
  end if;

  if new.minggu_ke is null then
    new.minggu_ke := public.id_minggu_ke(new.tanggal);
  end if;

  -- Only a transfer may carry a destination pocket.
  if new.tx_type <> 'transfer' then
    new.target_wallet_id := null;
  end if;

  -- Only freelance income may be frozen.
  if new.tx_type <> 'income_freelance' then
    new.is_frozen_freelance := false;
  end if;

  return new;
end;
$$;

comment on function public.derive_transaction_calendar() is
  'BEFORE INSERT/UPDATE normaliser: fills hari/bulan/minggu_ke from tanggal and nulls out fields that do not apply to the tx_type.';

drop trigger if exists trg_derive_transaction_calendar on public.transactions;
create trigger trg_derive_transaction_calendar
  before insert or update on public.transactions
  for each row
  execute function public.derive_transaction_calendar();


-- ── Automatic wallet balance synchronisation ───────────────────────────────
-- Single source of truth for wallet arithmetic:
--     income_salary / income_freelance  →  + nominal on wallet_id
--     expense                           →  - nominal on wallet_id
--     transfer                          →  - nominal on wallet_id
--                                          + nominal on target_wallet_id
--
-- UPDATE is handled as "reverse the OLD row, then apply the NEW row", which
-- makes edits exact even when tx_type, nominal, or either wallet changes.

create or replace function public.apply_transaction_delta(
  p_tx_type          text,
  p_nominal          numeric,
  p_wallet_id        uuid,
  p_target_wallet_id uuid,
  p_direction        integer   -- +1 to apply, -1 to reverse
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_amount numeric(15, 2) := coalesce(p_nominal, 0) * p_direction;
begin
  if v_amount = 0 then
    return;
  end if;

  if p_tx_type in ('income_salary', 'income_freelance') then
    if p_wallet_id is not null then
      update public.wallets
         set balance = balance + v_amount
       where id = p_wallet_id;
    end if;

  elsif p_tx_type = 'expense' then
    if p_wallet_id is not null then
      update public.wallets
         set balance = balance - v_amount
       where id = p_wallet_id;
    end if;

  elsif p_tx_type = 'transfer' then
    if p_wallet_id is not null then
      update public.wallets
         set balance = balance - v_amount
       where id = p_wallet_id;
    end if;
    if p_target_wallet_id is not null then
      update public.wallets
         set balance = balance + v_amount
       where id = p_target_wallet_id;
    end if;
  end if;
end;
$$;

comment on function public.apply_transaction_delta(text, numeric, uuid, uuid, integer) is
  'Applies (+1) or reverses (-1) one transaction''s effect on wallets.balance.';


create or replace function public.sync_wallet_balances()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'UPDATE' or tg_op = 'DELETE') then
    perform public.apply_transaction_delta(
      old.tx_type, old.nominal, old.wallet_id, old.target_wallet_id, -1
    );
  end if;

  if (tg_op = 'INSERT' or tg_op = 'UPDATE') then
    perform public.apply_transaction_delta(
      new.tx_type, new.nominal, new.wallet_id, new.target_wallet_id, 1
    );
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

comment on function public.sync_wallet_balances() is
  'AFTER INSERT/UPDATE/DELETE on transactions. Guarantees wallets.balance is always the exact arithmetic sum of the ledger.';

drop trigger if exists trg_sync_wallet_balances on public.transactions;
create trigger trg_sync_wallet_balances
  after insert or update or delete on public.transactions
  for each row
  execute function public.sync_wallet_balances();


-- Full recomputation escape hatch: rebuild every balance from the ledger.
-- Useful after a bulk CSV import, or to prove the trigger math is sound.
create or replace function public.recalculate_wallet_balances()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.wallets w
     set balance = (
       coalesce((
         select sum(t.nominal) from public.transactions t
          where t.wallet_id = w.id
            and t.tx_type in ('income_salary', 'income_freelance')
       ), 0)
       + coalesce((
         select sum(t.nominal) from public.transactions t
          where t.target_wallet_id = w.id
            and t.tx_type = 'transfer'
       ), 0)
       - coalesce((
         select sum(t.nominal) from public.transactions t
          where t.wallet_id = w.id
            and t.tx_type in ('expense', 'transfer')
       ), 0)
     );
end;
$$;

comment on function public.recalculate_wallet_balances() is
  'Rebuilds every wallets.balance from the full transactions ledger. Idempotent; safe to run after bulk imports.';


-- ───────────────────────────────────────────────────────────────────────────
-- 5. TABLE: kanban_tasks
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.kanban_tasks (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  task_type       text not null,
  status          text not null,
  amount          numeric(15, 2) not null default 0,
  client_or_store text,
  unlock_at       timestamptz,
  notes           text,
  position        integer not null default 0,
  created_at      timestamptz not null default now()
);

comment on table public.kanban_tasks is
  'Freelance pipeline, career tasks, and the 48-hour impulse-purchase quarantine board.';
comment on column public.kanban_tasks.task_type is
  'freelance_project | wishlist_48h | career_task';
comment on column public.kanban_tasks.status is
  'backlog | in_progress | review | done';
comment on column public.kanban_tasks.unlock_at is
  'For wishlist_48h: now() + interval ''48 hours''. Completion is blocked until this moment passes.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'kanban_tasks_task_type_check'
  ) then
    alter table public.kanban_tasks
      add constraint kanban_tasks_task_type_check
      check (task_type in ('freelance_project', 'wishlist_48h', 'career_task'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'kanban_tasks_status_check'
  ) then
    alter table public.kanban_tasks
      add constraint kanban_tasks_status_check
      check (status in ('backlog', 'in_progress', 'review', 'done'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'kanban_tasks_amount_check'
  ) then
    alter table public.kanban_tasks
      add constraint kanban_tasks_amount_check
      check (amount >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'kanban_tasks_title_not_blank'
  ) then
    alter table public.kanban_tasks
      add constraint kanban_tasks_title_not_blank
      check (length(btrim(title)) > 0);
  end if;
end
$$;


-- ── 48-hour quarantine + column ordering ───────────────────────────────────

create or replace function public.prepare_kanban_task()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Arm the 48-hour impulse-buy quarantine clock.
  if new.task_type = 'wishlist_48h' and new.unlock_at is null then
    new.unlock_at := now() + interval '48 hours';
  end if;

  if new.task_type <> 'wishlist_48h' then
    new.unlock_at := null;
  end if;

  -- Append to the bottom of its column when no explicit position is given.
  if tg_op = 'INSERT' and coalesce(new.position, 0) = 0 then
    select coalesce(max(k.position), 0) + 1
      into new.position
      from public.kanban_tasks k
     where k.status = new.status;
  end if;

  return new;
end;
$$;

comment on function public.prepare_kanban_task() is
  'BEFORE INSERT/UPDATE on kanban_tasks: arms the 48h wishlist quarantine and auto-appends position.';

drop trigger if exists trg_prepare_kanban_task on public.kanban_tasks;
create trigger trg_prepare_kanban_task
  before insert or update on public.kanban_tasks
  for each row
  execute function public.prepare_kanban_task();


-- Hard lock: a quarantined wishlist card cannot reach `done` before unlock_at.
create or replace function public.enforce_wishlist_quarantine()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.task_type = 'wishlist_48h'
     and new.status = 'done'
     and new.unlock_at is not null
     and now() < new.unlock_at
  then
    raise exception
      'KARANTINA_48_JAM: Wishlist "%" masih dikarantina sampai %. Tunggu 48 jam penuh sebelum menyelesaikan pembelian.',
      new.title, new.unlock_at
      using errcode = 'check_violation',
            hint = 'The 48-hour impulse-purchase cooling-off period has not elapsed yet.';
  end if;

  return new;
end;
$$;

comment on function public.enforce_wishlist_quarantine() is
  'Blocks a wishlist_48h card from entering the done column before its 48-hour cooling-off period elapses.';

drop trigger if exists trg_enforce_wishlist_quarantine on public.kanban_tasks;
create trigger trg_enforce_wishlist_quarantine
  before insert or update on public.kanban_tasks
  for each row
  execute function public.enforce_wishlist_quarantine();


-- ───────────────────────────────────────────────────────────────────────────
-- 6. TABLE: daily_audits
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.daily_audits (
  id                 uuid primary key default gen_random_uuid(),
  audit_date         date unique not null,
  evening_audit_done boolean not null default false,
  monday_split_done  boolean not null default false,
  notes              text,
  created_at         timestamptz not null default now()
);

comment on table public.daily_audits is
  'One row per day. Backs the 21:00 WIB evening audit, the Monday 08:00 WIB salary split, and the discipline streak counter.';


-- ───────────────────────────────────────────────────────────────────────────
-- 7. INDEXES
-- ───────────────────────────────────────────────────────────────────────────

create index if not exists idx_transactions_tanggal
  on public.transactions (tanggal desc);

create index if not exists idx_transactions_tx_type_tanggal
  on public.transactions (tx_type, tanggal desc);

create index if not exists idx_transactions_wallet_id
  on public.transactions (wallet_id);

create index if not exists idx_transactions_target_wallet_id
  on public.transactions (target_wallet_id);

create index if not exists idx_transactions_kategori
  on public.transactions (kategori);

create index if not exists idx_transactions_frozen
  on public.transactions (is_frozen_freelance)
  where is_frozen_freelance = true;

create index if not exists idx_kanban_tasks_status_position
  on public.kanban_tasks (status, position);

create index if not exists idx_kanban_tasks_task_type
  on public.kanban_tasks (task_type);

create index if not exists idx_daily_audits_audit_date
  on public.daily_audits (audit_date desc);

create index if not exists idx_wallets_category
  on public.wallets (category);


-- ───────────────────────────────────────────────────────────────────────────
-- 8. ROW LEVEL SECURITY
--
--  Threat model: this is a SINGLE-USER, self-hosted deployment. Identity is
--  established by the Next.js middleware (jose JWT cookie signed with
--  AUTH_SECRET), not by Supabase Auth.
--
--  Therefore:
--    • ALL WRITES go through Next.js Server Actions using
--      SUPABASE_SERVICE_ROLE_KEY. That key bypasses RLS, and the explicit
--      service_role policies below document and pin that intent.
--    • READS additionally need to work for `anon`, because Supabase Realtime
--      evaluates postgres_changes against the subscriber's role, and the
--      browser subscribes with NEXT_PUBLIC_SUPABASE_ANON_KEY.
--
--  ⚠ SECURITY NOTE: the anon SELECT policies below make your ledger readable
--  by anyone holding the (publicly shipped) anon key. That is the documented
--  trade-off for zero-reload Realtime on a personal instance. If you would
--  rather keep the data fully private, drop the four `*_anon_select_realtime`
--  policies — the app degrades gracefully to server-rendered revalidation
--  and simply stops live-updating.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.wallets       enable row level security;
alter table public.transactions  enable row level security;
alter table public.kanban_tasks  enable row level security;
alter table public.daily_audits  enable row level security;

-- Force RLS even for the table owner, so nothing slips through unpoliced.
alter table public.wallets       force row level security;
alter table public.transactions  force row level security;
alter table public.kanban_tasks  force row level security;
alter table public.daily_audits  force row level security;

do $$
begin
  -- wallets
  drop policy if exists wallets_service_role_all on public.wallets;
  create policy wallets_service_role_all on public.wallets
    as permissive for all to service_role using (true) with check (true);
  drop policy if exists wallets_anon_select_realtime on public.wallets;
  create policy wallets_anon_select_realtime on public.wallets
    as permissive for select to anon, authenticated using (true);

  -- transactions
  drop policy if exists transactions_service_role_all on public.transactions;
  create policy transactions_service_role_all on public.transactions
    as permissive for all to service_role using (true) with check (true);
  drop policy if exists transactions_anon_select_realtime on public.transactions;
  create policy transactions_anon_select_realtime on public.transactions
    as permissive for select to anon, authenticated using (true);

  -- kanban_tasks
  drop policy if exists kanban_tasks_service_role_all on public.kanban_tasks;
  create policy kanban_tasks_service_role_all on public.kanban_tasks
    as permissive for all to service_role using (true) with check (true);
  drop policy if exists kanban_tasks_anon_select_realtime on public.kanban_tasks;
  create policy kanban_tasks_anon_select_realtime on public.kanban_tasks
    as permissive for select to anon, authenticated using (true);

  -- daily_audits
  drop policy if exists daily_audits_service_role_all on public.daily_audits;
  create policy daily_audits_service_role_all on public.daily_audits
    as permissive for all to service_role using (true) with check (true);
  drop policy if exists daily_audits_anon_select_realtime on public.daily_audits;
  create policy daily_audits_anon_select_realtime on public.daily_audits
    as permissive for select to anon, authenticated using (true);
end
$$;

-- Table-level grants (RLS still applies on top of these).
grant usage on schema public to anon, authenticated, service_role;

grant select on public.wallets, public.transactions, public.kanban_tasks, public.daily_audits
  to anon, authenticated;

grant select, insert, update, delete
  on public.wallets, public.transactions, public.kanban_tasks, public.daily_audits
  to service_role;


-- ───────────────────────────────────────────────────────────────────────────
-- 9. SUPABASE REALTIME
--
--  REPLICA IDENTITY FULL is required so UPDATE/DELETE events carry the old
--  record — the wallet cards and ledger tables need it to patch rows in place.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.wallets      replica identity full;
alter table public.transactions replica identity full;
alter table public.kanban_tasks replica identity full;
alter table public.daily_audits replica identity full;

do $$
declare
  v_table text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  -- ALTER PUBLICATION ... ADD TABLE errors if the table is already a member,
  -- so each table is added only when missing. Net effect is identical to:
  --   alter publication supabase_realtime
  --     add table wallets, transactions, kanban_tasks, daily_audits;
  for v_table in
    select unnest(array['wallets', 'transactions', 'kanban_tasks', 'daily_audits'])
  loop
    if not exists (
      select 1
        from pg_publication_tables
       where pubname    = 'supabase_realtime'
         and schemaname = 'public'
         and tablename  = v_table
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I', v_table
      );
    end if;
  end loop;
end
$$;


-- ───────────────────────────────────────────────────────────────────────────
-- 10. SEED DATA — baseline 13 November 2026
--
--  Design decision, stated explicitly because it matters for correctness:
--
--  Wallet balances are DERIVED, never hand-written. The five wallets are
--  therefore seeded at 0 and the opening baseline ledger entries for
--  2026-11-13 are inserted; sync_wallet_balances() then produces exactly the
--  intended opening balances:
--
--      Saldo awal kas              Rp 550.000  in
--        → Dana Darurat            Rp 450.000
--        → Operasional Harian      Rp 100.000
--      Pelunasan DANA PayLater     Rp 130.000  out (from Dana Darurat)
--      ────────────────────────────────────────────
--      Dana Darurat      450.000 − 130.000  =  Rp 320.000  ✓
--      Operasional Harian                   =  Rp 100.000  ✓
--      Tabungan Produktif                   =  Rp       0  ✓
--      Investasi Pemula                     =  Rp       0  ✓
--      Kantong Freelance                    =  Rp       0  ✓
--      ────────────────────────────────────────────
--      Total kas bersih                     =  Rp 420.000
--
--  Writing 320000/100000 directly AND inserting the baseline rows would
--  double-count. Section 11 asserts the derived figures.
-- ───────────────────────────────────────────────────────────────────────────

insert into public.wallets (name, category, balance, target_amount, accent_tag)
values
  ('Dana Darurat',       'darurat',     0, 3000000, 'green'),
  ('Operasional Harian', 'operasional', 0,  270000, 'monochrome'),
  ('Tabungan Produktif', 'produktif',   0, 5000000, 'monochrome'),
  ('Investasi Pemula',   'investasi',   0, 5000000, 'monochrome'),
  ('Kantong Freelance',  'freelance',   0, 1000000, 'green')
on conflict (name) do nothing;


-- Opening baseline ledger — 13 November 2026 (Jumat, minggu ke-2, November).
insert into public.transactions (
  tanggal, hari, minggu_ke, bulan,
  tx_type, kategori, barang_keperluan, nominal,
  wallet_id, catatan
)
select
  date '2026-11-13',
  public.id_hari(date '2026-11-13'),
  public.id_minggu_ke(date '2026-11-13'),
  public.id_bulan(date '2026-11-13'),
  s.tx_type, s.kategori, s.barang_keperluan, s.nominal,
  w.id, s.catatan
from (
  values
    ('income_salary', 'Saldo Awal',       'Saldo awal kas — alokasi Dana Darurat',       450000::numeric, 'Dana Darurat',       'Baseline sistem 13 November 2026. Bagian dari saldo awal kas Rp550.000.'),
    ('income_salary', 'Saldo Awal',       'Saldo awal kas — alokasi Operasional Harian', 100000::numeric, 'Operasional Harian', 'Baseline sistem 13 November 2026. Bagian dari saldo awal kas Rp550.000.'),
    ('expense',       'Pelunasan Utang',  'Pelunasan DANA PayLater',                     130000::numeric, 'Dana Darurat',       'Utang konsumtif ditutup penuh di hari pertama sistem berjalan.')
) as s(tx_type, kategori, barang_keperluan, nominal, wallet_name, catatan)
join public.wallets w on w.name = s.wallet_name
where not exists (
  select 1
    from public.transactions t
   where t.tanggal = date '2026-11-13'
     and t.barang_keperluan = s.barang_keperluan
);


-- Opening audit row for day one.
insert into public.daily_audits (audit_date, evening_audit_done, monday_split_done, notes)
values (
  date '2026-11-13',
  true,
  false,
  'Hari pertama sistem aktif. Saldo awal kas Rp550.000 dicatat, DANA PayLater Rp130.000 dilunasi. Saldo bersih Rp420.000.'
)
on conflict (audit_date) do nothing;


-- Seed the career board so the Kanban page is not empty on first run.
insert into public.kanban_tasks (title, task_type, status, amount, client_or_store, notes, position)
select * from (
  values
    ('Siapkan portfolio Nelsen Creative',      'career_task',      'in_progress', 0::numeric, null::text, 'Aset utama untuk menaikkan rate freelance.',      1),
    ('Kumpulkan Dana Darurat Rp3.000.000',     'career_task',      'in_progress', 3000000::numeric, null::text, 'Target utama kuartal pertama sistem.',       2),
    ('Audit malam 21:00 WIB setiap hari',      'career_task',      'backlog',     0::numeric, null::text, 'Disiplin harian — streak tidak boleh putus.',     3)
) as s(title, task_type, status, amount, client_or_store, notes, position)
where not exists (
  select 1 from public.kanban_tasks k where k.title = s.title
);


-- ───────────────────────────────────────────────────────────────────────────
-- 11. POST-SEED ARITHMETIC ASSERTION
--     Fails the migration loudly if the trigger math is ever wrong.
-- ───────────────────────────────────────────────────────────────────────────

do $$
declare
  v_darurat     numeric(15, 2);
  v_operasional numeric(15, 2);
  v_total       numeric(15, 2);
  v_wallets     integer;
begin
  select count(*) into v_wallets from public.wallets;

  if v_wallets <> 5 then
    raise exception 'SEED_GAGAL: diharapkan 5 dompet, ditemukan %.', v_wallets;
  end if;

  select balance into v_darurat     from public.wallets where name = 'Dana Darurat';
  select balance into v_operasional from public.wallets where name = 'Operasional Harian';
  select coalesce(sum(balance), 0) into v_total from public.wallets;

  if v_darurat <> 320000.00 then
    raise exception
      'SEED_GAGAL: Dana Darurat seharusnya Rp320.000 setelah baseline, bukan Rp%.', v_darurat;
  end if;

  if v_operasional <> 100000.00 then
    raise exception
      'SEED_GAGAL: Operasional Harian seharusnya Rp100.000 setelah baseline, bukan Rp%.', v_operasional;
  end if;

  if v_total <> 420000.00 then
    raise exception
      'SEED_GAGAL: total saldo bersih seharusnya Rp420.000 (550.000 − 130.000), bukan Rp%.', v_total;
  end if;

  raise notice 'Personal Finance OS: skema siap. Saldo baseline 13-11-2026 terverifikasi — Darurat Rp320.000, Operasional Rp100.000, total Rp420.000.';
end
$$;

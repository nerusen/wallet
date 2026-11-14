-- ════════════════════════════════════════════════════════════════════════════
--  PERSONAL FINANCE OS — assistant chat + daily notes
--  Migration: add_assistant_and_notes
--
--  Adds the two tables backing Module 08 (/assisten) and Module 09 (/catatan).
--  Fully IDEMPOTENT: safe to re-apply.
--
--  Contents
--    1. Table: chat_messages   (AI assistant transcript)
--    2. Table: daily_notes     (multi-canvas daily notes)
--    3. Hardening: is_frozen_freelance default + backfill
--    4. Indexes
--    5. Row Level Security + policies
--    6. Supabase Realtime publication
--
--  DO NOT run `supabase db reset`. Apply with `supabase db push`.
-- ════════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- 1. TABLE: chat_messages
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  role       text not null,
  content    text not null,
  created_at timestamptz not null default now()
);

comment on table public.chat_messages is
  'Transcript for the FINANCE OS AI assistant (Module 08). One row per turn.';
comment on column public.chat_messages.role is
  'user | assistant — mirrors the Gemini content role.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chat_messages_role_check'
  ) then
    alter table public.chat_messages
      add constraint chat_messages_role_check
      check (role in ('user', 'assistant'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'chat_messages_content_not_blank'
  ) then
    alter table public.chat_messages
      add constraint chat_messages_content_not_blank
      check (length(btrim(content)) > 0);
  end if;
end
$$;


-- ───────────────────────────────────────────────────────────────────────────
-- 2. TABLE: daily_notes
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.daily_notes (
  id         uuid primary key default gen_random_uuid(),
  title      text not null default 'Catatan Tanpa Judul',
  content    text not null default '',
  tag        text not null default 'Harian',
  note_date  date not null default current_date,
  is_pinned  boolean not null default false,
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.daily_notes is
  'Independent note canvases (Module 09). Unlimited rows; ordered by is_pinned then position.';
comment on column public.daily_notes.tag is
  'Harian | Evaluasi | Ide Freelance | Target | Lainnya';
comment on column public.daily_notes.position is
  'Manual sort order within the grid. Auto-assigned on insert when left at 0.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'daily_notes_tag_check'
  ) then
    alter table public.daily_notes
      add constraint daily_notes_tag_check
      check (tag in ('Harian', 'Evaluasi', 'Ide Freelance', 'Target', 'Lainnya'));
  end if;
end
$$;


-- ── Keep `updated_at` honest, and auto-append `position` ───────────────────

create or replace function public.touch_daily_notes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;

  -- Append to the end of the board when no explicit position is supplied.
  if tg_op = 'INSERT' and coalesce(new.position, 0) = 0 then
    select coalesce(max(n.position), 0) + 1
      into new.position
      from public.daily_notes n;
  end if;

  return new;
end;
$$;

comment on function public.touch_daily_notes() is
  'BEFORE INSERT/UPDATE on daily_notes: refreshes updated_at and auto-assigns position.';

drop trigger if exists trg_touch_daily_notes on public.daily_notes;
create trigger trg_touch_daily_notes
  before insert or update on public.daily_notes
  for each row
  execute function public.touch_daily_notes();


-- ───────────────────────────────────────────────────────────────────────────
-- 3. HARDENING: is_frozen_freelance
--
--  The freeze checkbox previously could not submit `false` (an unchecked
--  checkbox is omitted from the form body, and the server defaulted the
--  missing value back to `true`). The application fix is in
--  `createFreelanceIncomeAction`; this section guarantees the database side.
--
--  • Re-assert the NOT NULL DEFAULT false so nothing can insert NULL.
--  • Force the flag off for every row that is not freelance income, which
--    cleans up any mis-tagged historical row.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.transactions
  alter column is_frozen_freelance set default false;

update public.transactions
   set is_frozen_freelance = false
 where tx_type <> 'income_freelance'
   and is_frozen_freelance = true;


-- ───────────────────────────────────────────────────────────────────────────
-- 4. INDEXES
-- ───────────────────────────────────────────────────────────────────────────

create index if not exists idx_chat_messages_created_at
  on public.chat_messages (created_at desc);

create index if not exists idx_daily_notes_board_order
  on public.daily_notes (is_pinned desc, position asc);

create index if not exists idx_daily_notes_note_date
  on public.daily_notes (note_date desc);

create index if not exists idx_daily_notes_tag
  on public.daily_notes (tag);

-- Supports the FREELANCE BEKU aggregate: sum(nominal) where freelance AND frozen.
create index if not exists idx_transactions_freelance_frozen
  on public.transactions (tx_type, is_frozen_freelance);


-- ───────────────────────────────────────────────────────────────────────────
-- 5. ROW LEVEL SECURITY
--
--  Same model as the initial migration: writes go through Next.js Server
--  Actions / route handlers using SUPABASE_SERVICE_ROLE_KEY, and reads are
--  additionally granted to `anon` so Supabase Realtime can deliver
--  postgres_changes to the browser (which subscribes with the anon key).
--
--  ⚠ Dropping the `*_anon_select_realtime` policies makes the data fully
--  private at the cost of live updates. See README for the trade-off.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.chat_messages enable row level security;
alter table public.daily_notes   enable row level security;

alter table public.chat_messages force row level security;
alter table public.daily_notes   force row level security;

do $$
begin
  -- chat_messages
  drop policy if exists chat_messages_service_role_all on public.chat_messages;
  create policy chat_messages_service_role_all on public.chat_messages
    as permissive for all to service_role using (true) with check (true);

  drop policy if exists chat_messages_anon_select_realtime on public.chat_messages;
  create policy chat_messages_anon_select_realtime on public.chat_messages
    as permissive for select to anon, authenticated using (true);

  -- daily_notes
  drop policy if exists daily_notes_service_role_all on public.daily_notes;
  create policy daily_notes_service_role_all on public.daily_notes
    as permissive for all to service_role using (true) with check (true);

  drop policy if exists daily_notes_anon_select_realtime on public.daily_notes;
  create policy daily_notes_anon_select_realtime on public.daily_notes
    as permissive for select to anon, authenticated using (true);
end
$$;

grant select on public.chat_messages, public.daily_notes to anon, authenticated;

grant select, insert, update, delete
  on public.chat_messages, public.daily_notes
  to service_role;


-- ───────────────────────────────────────────────────────────────────────────
-- 6. SUPABASE REALTIME
--
--  Equivalent to:
--    alter publication supabase_realtime add table chat_messages, daily_notes;
--  but guarded, because ADD TABLE errors when the table is already a member.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.chat_messages replica identity full;
alter table public.daily_notes   replica identity full;

do $$
declare
  v_table text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  for v_table in
    select unnest(array['chat_messages', 'daily_notes'])
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


do $$
begin
  raise notice 'Personal Finance OS: chat_messages + daily_notes siap. RLS aktif, Realtime terdaftar, default is_frozen_freelance = false dipastikan.';
end
$$;

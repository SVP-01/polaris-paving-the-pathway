begin;

create extension if not exists pgcrypto;

create table if not exists public.daily_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  note_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists daily_notes_user_date_idx
  on public.daily_notes (user_id, date desc);

drop trigger if exists trg_daily_notes_updated_at on public.daily_notes;
create or replace function public.set_daily_notes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_daily_notes_updated_at
before update on public.daily_notes
for each row execute function public.set_daily_notes_updated_at();

alter table public.daily_notes enable row level security;

drop policy if exists "daily_notes_select_own" on public.daily_notes;
create policy "daily_notes_select_own"
on public.daily_notes
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "daily_notes_insert_own" on public.daily_notes;
create policy "daily_notes_insert_own"
on public.daily_notes
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "daily_notes_update_own" on public.daily_notes;
create policy "daily_notes_update_own"
on public.daily_notes
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "daily_notes_delete_own" on public.daily_notes;
create policy "daily_notes_delete_own"
on public.daily_notes
for delete
to authenticated
using (user_id = auth.uid());

alter publication supabase_realtime add table public.daily_notes;

commit;

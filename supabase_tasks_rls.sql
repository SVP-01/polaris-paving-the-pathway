begin;

create extension if not exists pgcrypto;

-- -------------------------------------------------------------------
-- Shared helpers
-- -------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_mentor()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'mentor'
  );
$$;

create or replace function public.is_mentee()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'mentee'
  );
$$;

-- -------------------------------------------------------------------
-- Profiles
-- -------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('mentor', 'mentee')),
  display_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (role)
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_role text;
  claimed_name text;
begin
  claimed_role := coalesce(new.raw_app_meta_data->>'role', new.raw_user_meta_data->>'role');
  claimed_name := coalesce(
    nullif(new.raw_user_meta_data->>'display_name', ''),
    nullif(new.raw_user_meta_data->>'full_name', ''),
    split_part(coalesce(new.email, ''), '@', 1),
    ''
  );

  if claimed_role in ('mentor', 'mentee') then
    insert into public.profiles (id, role, display_name)
    values (new.id, claimed_role, claimed_name)
    on conflict (id) do update
      set role = excluded.role,
          display_name = excluded.display_name;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- -------------------------------------------------------------------
-- Tasks workflow table
-- -------------------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  description text not null default '',
  due_date timestamptz not null,
  resource_link text,
  mentor_id uuid references auth.users(id) on delete cascade,
  mentee_id uuid references auth.users(id) on delete cascade,
  status text not null default 'pending',
  rejection_reason text,
  mentee_rating integer,
  mentee_reflection text,
  mentor_feedback text,
  mentor_emoji text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists resource_link text,
  add column if not exists mentor_id uuid references auth.users(id) on delete cascade,
  add column if not exists mentee_id uuid references auth.users(id) on delete cascade,
  add column if not exists status text,
  add column if not exists rejection_reason text,
  add column if not exists mentee_rating integer,
  add column if not exists mentee_reflection text,
  add column if not exists mentor_feedback text,
  add column if not exists mentor_emoji text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tasks'
      and column_name = 'due_date'
      and data_type <> 'timestamp with time zone'
  ) then
    execute 'alter table public.tasks alter column due_date type timestamptz using due_date::timestamptz';
  elsif not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tasks'
      and column_name = 'due_date'
  ) then
    execute 'alter table public.tasks add column due_date timestamptz not null default now()';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_status_check'
  ) then
    alter table public.tasks
      add constraint tasks_status_check
      check (status in ('pending', 'accepted', 'declined', 'completed'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_rating_check'
  ) then
    alter table public.tasks
      add constraint tasks_rating_check
      check (mentee_rating is null or mentee_rating between 1 and 10);
  end if;
end;
$$;

alter table public.tasks alter column status set default 'pending';
update public.tasks set status = 'pending' where status is null;

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create index if not exists tasks_mentor_idx on public.tasks (mentor_id);
create index if not exists tasks_mentee_idx on public.tasks (mentee_id);
create index if not exists tasks_due_date_idx on public.tasks (due_date);
create index if not exists tasks_status_idx on public.tasks (status);

-- -------------------------------------------------------------------
-- RLS
-- -------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.tasks enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id and role in ('mentor', 'mentee'));

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "tasks_select_mentor_own" on public.tasks;
create policy "tasks_select_mentor_own"
on public.tasks
for select
to authenticated
using (mentor_id = auth.uid());

drop policy if exists "tasks_select_mentee_own" on public.tasks;
create policy "tasks_select_mentee_own"
on public.tasks
for select
to authenticated
using (mentee_id = auth.uid());

drop policy if exists "tasks_insert_mentor_own" on public.tasks;
create policy "tasks_insert_mentor_own"
on public.tasks
for insert
to authenticated
with check (mentor_id = auth.uid() and status in ('pending', 'accepted', 'declined', 'completed'));

drop policy if exists "tasks_update_mentor_own" on public.tasks;
create policy "tasks_update_mentor_own"
on public.tasks
for update
to authenticated
using (mentor_id = auth.uid())
with check (mentor_id = auth.uid());

drop policy if exists "tasks_update_mentee_assigned" on public.tasks;
create policy "tasks_update_mentee_assigned"
on public.tasks
for update
to authenticated
using (mentee_id = auth.uid())
with check (mentee_id = auth.uid());

drop policy if exists "tasks_delete_mentor_own" on public.tasks;
create policy "tasks_delete_mentor_own"
on public.tasks
for delete
to authenticated
using (mentor_id = auth.uid());

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on public.profiles, public.tasks to authenticated, service_role;

-- -------------------------------------------------------------------
-- Realtime publication
-- -------------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.profiles;
  exception
    when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.tasks;
  exception
    when duplicate_object then null;
  end;
end;
$$;

commit;

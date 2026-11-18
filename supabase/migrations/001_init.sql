-- Uncooked companion: one profile per account, one toaster, sessions the streak is calculated from.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  daily_goal_minutes integer not null default 15 check (daily_goal_minutes >= 0 and daily_goal_minutes <= 1440),
  timezone text not null default 'America/New_York',
  created_at timestamptz not null default now()
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  name text not null default 'Toaster',
  secret text not null unique,
  created_at timestamptz not null default now()
);

create table public.device_status (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  tray_down boolean not null default false,
  phone_present boolean not null default false,
  timer_running boolean not null default false,
  remaining_ms bigint not null default 0 check (remaining_ms >= 0),
  updated_at timestamptz not null default now()
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  constraint sessions_end_after_start check (ended_at is null or ended_at >= started_at)
);

create index sessions_user_started_idx on public.sessions (user_id, started_at desc);
create unique index sessions_one_open_idx on public.sessions (user_id) where ended_at is null;

alter table public.profiles enable row level security;
alter table public.devices enable row level security;
alter table public.device_status enable row level security;
alter table public.sessions enable row level security;

create policy "read own profile" on public.profiles
  for select to authenticated using (auth.uid() = id);

create policy "update own goal" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy "read own device" on public.devices
  for select to authenticated using (auth.uid() = user_id);

create policy "read own status" on public.device_status
  for select to authenticated using (auth.uid() = user_id);

create policy "read own sessions" on public.sessions
  for select to authenticated using (auth.uid() = user_id);

grant usage on schema public to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.devices to authenticated;
grant select on public.device_status to authenticated;
grant select on public.sessions to authenticated;

-- The toaster writes through the ingest function (service role), not from the browser.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  device_secret text;
begin
  insert into public.profiles (id) values (new.id);
  device_secret := md5(new.id::text || random()::text || clock_timestamp()::text)
    || md5(random()::text || new.id::text);
  insert into public.devices (user_id, secret) values (new.id, device_secret);
  insert into public.device_status (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter publication supabase_realtime add table public.device_status;
alter publication supabase_realtime add table public.sessions;

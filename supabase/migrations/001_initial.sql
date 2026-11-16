create extension if not exists pgcrypto;

do $$
begin
  create type public.student_status as enum ('active', 'paused', 'expelled');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.studios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  address text,
  contact text,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  full_name text not null,
  parent_name text not null default '',
  parent_phone text not null default '',
  studio_id uuid references public.studios(id) on delete restrict,
  club_id uuid references public.clubs(id) on delete restrict,
  monthly_price numeric(12, 2) not null check (monthly_price >= 0),
  payment_day smallint not null check (payment_day between 1 and 31),
  last_payment_date date,
  next_payment_date date not null,
  paid_through_date date,
  status public.student_status not null default 'active',
  pause_start date,
  pause_end date,
  expelled_at timestamptz,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  payment_date date not null,
  billing_period_start date not null,
  billing_period_end date not null check (billing_period_end >= billing_period_start),
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  payment_day smallint not null check (payment_day between 1 and 31),
  monthly_price numeric(12, 2) not null,
  effective_from date not null,
  effective_until date,
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists public.pause_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  started_at date not null,
  ended_at date,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists students_due_idx
  on public.students (user_id, status, next_payment_date);
create index if not exists payments_student_idx
  on public.payments (student_id, payment_date desc);

alter table public.studios enable row level security;
alter table public.clubs enable row level security;
alter table public.students enable row level security;
alter table public.payments enable row level security;
alter table public.payment_schedules enable row level security;
alter table public.pause_history enable row level security;

drop policy if exists "own data" on public.studios;
create policy "own data" on public.studios for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own data" on public.clubs;
create policy "own data" on public.clubs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own data" on public.students;
create policy "own data" on public.students for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own data" on public.payments;
create policy "own data" on public.payments for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own data" on public.payment_schedules;
create policy "own data" on public.payment_schedules for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own data" on public.pause_history;
create policy "own data" on public.pause_history for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Multiple instalments for the same billing period are valid.
alter table public.payments
  drop constraint if exists payments_student_id_billing_period_start_billing_period_end_key;

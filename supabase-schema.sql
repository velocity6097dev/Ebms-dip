-- =========================================================
-- Water Dip & Appearance Monitoring — Supabase schema (v4)
-- Run this in Supabase Dashboard -> SQL Editor -> New query
--
-- Safe to re-run for anything using IF NOT EXISTS / DROP POLICY
-- IF EXISTS + CREATE POLICY. The one exception: this version
-- retires the old "outlet_members" table (plain names with no
-- login) in favour of real staff logins via "outlet_staff". If
-- you had members typed in there, that list is dropped — re-add
-- your staff as real accounts via Settings → Staff accounts
-- after this runs.
-- =========================================================

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------
-- 1. Outlet settings — one row per OWNER account
-- ---------------------------------------------------------
create table if not exists outlet_settings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) not null unique,
  owner_name text default '',
  outlet_name text default '',
  month text default '',
  year text default '',
  onboarded boolean default false,
  updated_at timestamptz default now()
);

alter table outlet_settings enable row level security;

-- ---------------------------------------------------------
-- 2. Outlet staff — sub-users with their OWN Supabase login,
--    linked to the owner who created them. This replaces the
--    old "outlet_members" (name-only, no login) table.
-- ---------------------------------------------------------
drop table if exists outlet_members cascade;

create table if not exists outlet_staff (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid references auth.users(id) not null,
  staff_user_id uuid references auth.users(id) not null unique,
  staff_name text not null,
  staff_email text,
  created_at timestamptz default now()
);

alter table outlet_staff add column if not exists staff_email text;

alter table outlet_staff enable row level security;

-- Helper: is the current logged-in user a staff member of this owner?
-- security definer so it can be safely used inside OTHER tables' RLS
-- policies without recursive-policy issues.
create or replace function is_outlet_staff(check_owner_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from outlet_staff
    where owner_user_id = check_owner_id
      and staff_user_id = auth.uid()
  );
$$;

-- Owner settings: only the owner themself can read/write their row,
-- but staff need to READ it too (to show outlet name / month / year).
drop policy if exists "Owner manages own settings" on outlet_settings;
create policy "Owner manages own settings"
  on outlet_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Staff can read owner settings" on outlet_settings;
create policy "Staff can read owner settings"
  on outlet_settings for select
  using (is_outlet_staff(user_id));

-- Outlet staff table: owner manages the list; a staff member can
-- read their own single row (to discover their owner + name after login).
drop policy if exists "Owner manages staff list" on outlet_staff;
create policy "Owner manages staff list"
  on outlet_staff for all
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

drop policy if exists "Staff can read own record" on outlet_staff;
create policy "Staff can read own record"
  on outlet_staff for select
  using (auth.uid() = staff_user_id);

-- ---------------------------------------------------------
-- 3. Tanks — however many an outlet actually has.
--    Owner manages them; staff can read (to fill in readings).
-- ---------------------------------------------------------
create table if not exists tanks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) not null,
  name text not null,
  capacity_litres numeric,
  sort_order integer default 0,
  created_at timestamptz default now()
);

alter table tanks enable row level security;

drop policy if exists "Owner manages own tanks" on tanks;
create policy "Owner manages own tanks"
  on tanks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Staff can read tanks" on tanks;
create policy "Staff can read tanks"
  on tanks for select
  using (is_outlet_staff(user_id));

-- ---------------------------------------------------------
-- 4. Monthly / monsoon register — owner AND staff can fully
--    read/write (add days, fill readings, sign).
-- ---------------------------------------------------------
create table if not exists monsoon_entries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) not null,
  entry_date date,
  readings jsonb not null default '{}'::jsonb,
  remarks text,
  checked_by_user_id uuid references auth.users(id),
  checked_by_name text,
  checked_by_signature text,
  checked_by_at timestamptz,
  row_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table monsoon_entries add column if not exists checked_by_user_id uuid references auth.users(id);
alter table monsoon_entries drop column if exists checked_by_member_id;

alter table monsoon_entries enable row level security;
drop policy if exists "Owner and staff share monsoon entries" on monsoon_entries;
create policy "Owner and staff share monsoon entries"
  on monsoon_entries for all
  using (auth.uid() = user_id or is_outlet_staff(user_id))
  with check (auth.uid() = user_id or is_outlet_staff(user_id));

-- ---------------------------------------------------------
-- 5. Hourly / rainy-day register
-- ---------------------------------------------------------
create table if not exists rainy_entries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) not null,
  entry_date date,
  hour_time text,
  readings jsonb not null default '{}'::jsonb,
  remarks text,
  checked_by_user_id uuid references auth.users(id),
  checked_by_name text,
  checked_by_signature text,
  checked_by_at timestamptz,
  row_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table rainy_entries add column if not exists checked_by_user_id uuid references auth.users(id);
alter table rainy_entries drop column if exists checked_by_member_id;

alter table rainy_entries enable row level security;
drop policy if exists "Owner and staff share rainy entries" on rainy_entries;
create policy "Owner and staff share rainy entries"
  on rainy_entries for all
  using (auth.uid() = user_id or is_outlet_staff(user_id))
  with check (auth.uid() = user_id or is_outlet_staff(user_id));

-- ---------------------------------------------------------
-- 6. Contamination log — new register (from your uploaded
--    workbook's "Contamination Log" sheet)
-- ---------------------------------------------------------
create table if not exists contamination_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) not null,
  entry_date date,
  tank_id uuid references tanks(id) on delete set null,
  water_found_mm text,
  appearance text,
  contamination_confirmed text,       -- 'Y' or 'N'
  immediate_action text,
  qty_decanted_litres numeric,
  reported_to text,
  corrective_action text,
  verified_by_user_id uuid references auth.users(id),
  verified_by_name text,
  verified_by_signature text,
  verified_at timestamptz,
  remarks text,
  row_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table contamination_log enable row level security;
drop policy if exists "Owner and staff share contamination log" on contamination_log;
create policy "Owner and staff share contamination log"
  on contamination_log for all
  using (auth.uid() = user_id or is_outlet_staff(user_id))
  with check (auth.uid() = user_id or is_outlet_staff(user_id));

-- ---------------------------------------------------------
-- Helpful indexes
-- ---------------------------------------------------------
create index if not exists monsoon_entries_user_date_idx on monsoon_entries (user_id, entry_date, row_order);
create index if not exists rainy_entries_user_date_idx on rainy_entries (user_id, entry_date, row_order);
create index if not exists contamination_log_user_date_idx on contamination_log (user_id, entry_date, row_order);
create index if not exists tanks_user_idx on tanks (user_id, sort_order);
create index if not exists outlet_staff_owner_idx on outlet_staff (owner_user_id);
create index if not exists outlet_staff_staff_idx on outlet_staff (staff_user_id);

-- =========================================================
-- Water Dip & Appearance Monitoring — Supabase schema (v2)
-- Run this in Supabase Dashboard -> SQL Editor -> New query
--
-- If you already ran the v1 schema and have no real data yet,
-- just run this whole file — the DROP statements below clear
-- the old fixed 2-tank tables so the new dynamic-tank tables
-- can be created. If you DO have real data you want to keep,
-- stop here and migrate manually instead of running this file.
-- =========================================================

drop table if exists monsoon_entries cascade;
drop table if exists rainy_entries cascade;
drop table if exists outlet_members cascade;
drop table if exists tanks cascade;
drop table if exists outlet_settings cascade;

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------
-- 1. Outlet settings — one row per owner account
-- ---------------------------------------------------------
create table outlet_settings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) not null unique,
  owner_name text default '',
  outlet_name text default '',
  month text default '',
  year text default '',
  onboarded boolean default false,   -- flips true once tank setup is complete
  updated_at timestamptz default now()
);

alter table outlet_settings enable row level security;

create policy "Owners manage their own outlet settings"
  on outlet_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------
-- 2. Tanks — however many an outlet actually has
--    Set up once during onboarding, editable anytime in Settings
-- ---------------------------------------------------------
create table tanks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) not null,
  name text not null,                 -- e.g. "Petrol", "Speed", "Diesel"
  capacity_litres numeric,            -- optional, shown for reference only
  sort_order integer default 0,
  created_at timestamptz default now()
);

alter table tanks enable row level security;

create policy "Owners manage their own tanks"
  on tanks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------
-- 3. Outlet members — staff who can be picked as "Checked by"
--    so they never have to type their name, only sign
-- ---------------------------------------------------------
create table outlet_members (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) not null,
  member_name text not null,
  sort_order integer default 0,
  active boolean default true,
  created_at timestamptz default now()
);

alter table outlet_members enable row level security;

create policy "Owners manage their own outlet members"
  on outlet_members for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------
-- 4. Monthly / monsoon register
--    readings is a JSON object keyed by tank id, e.g.
--    { "<tank_id>": { "morning_dip": "0.0", "morning_appearance": "Clear",
--                      "evening_dip": "0.0", "evening_appearance": "Clear" } }
-- ---------------------------------------------------------
create table monsoon_entries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) not null,
  entry_date date,
  readings jsonb not null default '{}'::jsonb,
  remarks text,
  checked_by_member_id uuid references outlet_members(id) on delete set null,
  checked_by_name text,
  checked_by_signature text,   -- base64 PNG data URL from the signature pad
  row_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table monsoon_entries enable row level security;

create policy "Owners manage their own monsoon entries"
  on monsoon_entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------
-- 5. Hourly / rainy-day register
--    readings is a JSON object keyed by tank id, e.g.
--    { "<tank_id>": { "dip": "0.0", "appearance": "Clear" } }
-- ---------------------------------------------------------
create table rainy_entries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) not null,
  entry_date date,
  hour_time text,
  readings jsonb not null default '{}'::jsonb,
  remarks text,
  checked_by_member_id uuid references outlet_members(id) on delete set null,
  checked_by_name text,
  checked_by_signature text,
  row_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table rainy_entries enable row level security;

create policy "Owners manage their own rainy entries"
  on rainy_entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------
-- Helpful indexes
-- ---------------------------------------------------------
create index monsoon_entries_user_date_idx on monsoon_entries (user_id, entry_date, row_order);
create index rainy_entries_user_date_idx on rainy_entries (user_id, entry_date, row_order);
create index tanks_user_idx on tanks (user_id, sort_order);
create index outlet_members_user_idx on outlet_members (user_id, sort_order);

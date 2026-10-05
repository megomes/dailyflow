-- EH: one-time pairing codes for native devices (Android app, Wear OS). A code lives 10 minutes
-- and is deleted when claimed. Only its SHA-256 is stored.
create table if not exists pair_codes (
  code_hash  text        primary key,
  created_by text        not null,          -- device id of the web session that created it
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table devices add column if not exists kind text;   -- 'web' | 'android' | 'wear'

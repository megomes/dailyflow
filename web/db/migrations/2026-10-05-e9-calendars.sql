-- E9: external calendar accounts (OAuth tokens). Calendars, events and per-event overrides are
-- ordinary sync_records (entities calendar, cal_event, cal_override), so they need no table.
-- Apply to the dev branch first, then main:  psql "$DATABASE_URL" -f db/migrations/2026-10-05-e9-calendars.sql
create table if not exists calendar_accounts (
  id            text        primary key,                 -- '<provider>:<account email or oid>'
  provider      text        not null check (provider in ('google', 'microsoft')),
  email         text,
  access_token  text        not null,                    -- AES-GCM encrypted (CALENDAR_TOKEN_KEY)
  refresh_token text,                                    -- AES-GCM encrypted
  expires_at    timestamptz not null,
  scope         text,
  status        text        not null default 'ok' check (status in ('ok', 'error', 'reauth')),
  last_error    text,
  last_sync_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

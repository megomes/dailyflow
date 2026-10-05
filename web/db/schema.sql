-- DailyFlow database schema (Neon Postgres). Applied to the `main` (production) and `dev` branches.

-- Synced app records (areas, templates, days, blocks, check-ins). Last writer wins by updated_at;
-- seq orders changes for incremental pulls.
create sequence if not exists sync_seq;
create table if not exists sync_records (
  entity     text        not null,
  id         text        not null,
  data       jsonb       not null,
  deleted    boolean     not null default false,
  updated_at timestamptz not null,
  seq        bigint      not null default nextval('sync_seq'),
  device_id  text,
  primary key (entity, id)
);
create index if not exists sync_records_seq_idx on sync_records (seq);

-- Product analytics for stage validation (spec §61–63). Append-only, kept apart from domain data.
create table if not exists product_events (
  id          uuid        primary key,
  ts          timestamptz not null,
  day         date,
  stage       text        not null,
  session_id  text,
  device_id   text,
  device      text,
  screen      text,
  event       text        not null,
  props       jsonb       not null default '{}'::jsonb,
  received_at timestamptz not null default now()
);
create index if not exists product_events_ts_idx on product_events (ts);
create index if not exists product_events_event_idx on product_events (event);

-- Trusted devices (one per sign-in).
create table if not exists devices (
  id           text        primary key,
  label        text,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz
);

-- Notes: comments about the app, written by the user, worked on and resolved by Claude.
-- ids are sequential and never reused (deletes are soft).
create table if not exists notes (
  id          serial      primary key,
  body        text        not null,
  kind        text        not null default 'idea' check (kind in ('bug', 'idea', 'ux', 'question')),
  -- archived = the user tested it and confirmed (👍). A 👎 reopens with a comment (note_log action 'rejected').
  status      text        not null default 'open' check (status in ('open', 'discussing', 'in_progress', 'done', 'ignored', 'archived')),
  stage       text,
  app_version text,
  screen      text,
  device_id   text,
  -- Written by Claude: { summary, done[], ignored[], decisions[], commits[], deployed, follow_ups[] }
  resolution  jsonb       not null default '{}'::jsonb,
  -- Environment the note was written in (device, surface, layout, screen, network, app state, server geo/UA).
  context     jsonb       not null default '{}'::jsonb,
  deleted     boolean     not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Exact tracking: every change to a note, by whom, with details (previous text on edits, status, resolution).
create table if not exists note_log (
  id      bigserial   primary key,
  note_id int         not null references notes (id),
  ts      timestamptz not null default now(),
  actor   text        not null check (actor in ('user', 'claude')),
  action  text        not null,
  message text,
  detail  jsonb       not null default '{}'::jsonb
);
create index if not exists note_log_note_idx on note_log (note_id, ts);

-- Claude's entry point: optionally change status, merge into resolution and log it, atomically.
-- select note_claude(4, 'done', 'Implemented and deployed', '{"summary":"…","done":["…"],"commits":["abc123"]}');
create or replace function note_claude(p_id int, p_status text, p_message text, p_resolution jsonb default '{}'::jsonb)
returns notes language plpgsql as $$
declare n notes;
begin
  update notes
     set status = coalesce(p_status, status),
         resolution = resolution || coalesce(p_resolution, '{}'::jsonb),
         updated_at = now()
   where id = p_id and not deleted
  returning * into n;
  if not found then raise exception 'note % not found', p_id; end if;
  insert into note_log (note_id, actor, action, message, detail)
  values (p_id, 'claude', case when p_status is null then 'work' else 'status' end, p_message,
          jsonb_strip_nulls(jsonb_build_object('status', p_status, 'resolution', nullif(p_resolution, '{}'::jsonb))));
  return n;
end $$;

-- EH: one-time pairing codes for native devices (see db/migrations/2026-10-05-eh-pairing.sql).
create table if not exists pair_codes (
  code_hash  text        primary key,
  created_by text        not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table devices add column if not exists kind text;
-- E9: external calendar accounts (OAuth tokens, encrypted). See db/migrations/2026-10-05-e9-calendars.sql.
create table if not exists calendar_accounts (
  id            text        primary key,
  provider      text        not null check (provider in ('google', 'microsoft')),
  email         text,
  access_token  text        not null,
  refresh_token text,
  expires_at    timestamptz not null,
  scope         text,
  status        text        not null default 'ok' check (status in ('ok', 'error', 'reauth')),
  last_error    text,
  last_sync_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

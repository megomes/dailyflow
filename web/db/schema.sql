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

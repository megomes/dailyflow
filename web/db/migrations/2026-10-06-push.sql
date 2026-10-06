-- Live sync: where to push "something changed" (FCM tokens of the Android app and the watch).
create table if not exists push_targets (
  id         text        primary key,             -- sha256 of the token
  device_id  text        not null,
  platform   text        not null check (platform in ('android', 'wear')),
  token      text        not null,
  created_at timestamptz not null default now(),
  last_ok    timestamptz
);
create index if not exists push_targets_device_idx on push_targets (device_id);

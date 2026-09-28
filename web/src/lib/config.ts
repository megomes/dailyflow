/** Development stage currently in validation. Every product event is tagged with it. */
export const STAGE = 'E1';

/** Hour at which the logical day turns over (a record at 01:00 still belongs to yesterday). */
export const DAY_CUTOFF_HOUR = 4;

/** Timeline defaults (minutes since midnight). The visible range grows to fit blocks outside it. */
export const TIMELINE_START_MIN = 6 * 60;
export const TIMELINE_END_MIN = 22 * 60;

/** Snapping used when dragging or creating blocks. */
export const SNAP_MIN = 5;
export const MIN_BLOCK_MIN = 10;
export const NEW_BLOCK_MIN = 60;

/** Session and sync. */
export const SESSION_COOKIE = 'df_session';
export const DEVICE_COOKIE = 'df_device';
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 400;
export const SESSION_IDLE_MS = 30 * 60 * 1000;
export const SYNC_INTERVAL_MS = 30 * 1000;

/** From this hour on, Today shows the daily check-in if it was not answered yet. */
export const CHECKIN_FROM_HOUR = 19;

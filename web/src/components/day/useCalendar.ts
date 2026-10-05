'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useSyncExternalStore } from 'react';
import { effectiveClass } from '@/lib/calendar/normalize';
import { getCalStatus, subscribeCal } from '@/lib/calendar/client';
import { getDB } from '@/lib/db';
import type { CalClass, CalEvent, Calendar } from '@/lib/types';

export interface DayEvent extends CalEvent { cls: CalClass; calendar?: Calendar }

/** Calendar events of a day with their effective classification (hidden and cancelled dropped). */
export function useDayEvents(dayId: string) {
  const db = getDB();
  const rows = useLiveQuery(() => db.calEvents.where('dayId').equals(dayId).toArray(), [dayId]);
  const cals = useLiveQuery(() => db.calendars.toArray(), []);
  const overrides = useLiveQuery(() => db.calOverrides.toArray(), []);
  return useMemo(() => {
    const calMap = new Map((cals ?? []).filter(c => !c.deleted).map(c => [c.id, c]));
    const ov = new Map((overrides ?? []).filter(o => !o.deleted).map(o => [o.id, o.classification]));
    const all: DayEvent[] = (rows ?? [])
      .filter(e => !e.deleted && e.status !== 'cancelled' && calMap.has(e.calendarKey))
      .map(e => ({ ...e, cls: effectiveClass(e, calMap, ov), calendar: calMap.get(e.calendarKey) }))
      .filter(e => e.cls !== 'hidden')
      .sort((a, b) => a.start - b.start);
    return {
      timed: all.filter(e => !e.allDay),
      allDay: all.filter(e => e.allDay),
      commitments: all.filter(e => !e.allDay && e.cls === 'commitment' && !e.free),
    };
  }, [rows, cals, overrides]);
}

export function useCalStatus() {
  return useSyncExternalStore(subscribeCal, getCalStatus, getCalStatus);
}

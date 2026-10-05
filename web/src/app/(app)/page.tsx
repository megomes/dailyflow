'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { QuestionSet } from '@/components/Checkin';
import { YesterdayCard } from '@/components/day/Cards';
import { DayView } from '@/components/day/DayView';
import { m } from '@/i18n/en';
import { track } from '@/lib/analytics';
import { CHECKIN_FROM_HOUR, STAGE } from '@/lib/config';
import { getDB, getMeta, setMeta } from '@/lib/db';
import { useClock } from '@/lib/hooks';
import { ensureDay, liveBlocks } from '@/lib/repo';
import { addDays, dateFromIso } from '@/lib/time';
import { DAILY } from '@/lib/validation';

export default function TodayPage() {
  const { day, minute } = useClock();
  const yId = addDays(day, -1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const created = await ensureDay(day);
      if (cancelled) return;
      if (created) track('day_created', { day, template: (await getDB().days.get(day))?.templateId });
      const last = await getMeta<number>('lastTodayOpen', 0);
      track('today_opened', { hour: new Date().getHours(), since_last_open_min: last ? Math.round((Date.now() - last) / 60000) : null });
      await setMeta('lastTodayOpen', Date.now());
    })();
    return () => { cancelled = true; };
  }, [day]);

  const checkins = useLiveQuery(() => getDB().checkins.bulkGet([day, yId]), [day]);
  const yesterday = useLiveQuery(() => getDB().days.get(yId), [yId]);
  const yBlocks = useLiveQuery(() => getDB().dayBlocks.where('dayId').equals(yId).toArray(), [yId]);
  const yRecs = useLiveQuery(() => getDB().timeRecords.where('dayId').equals(yId).toArray(), [yId]);

  const checkinFor = (() => {
    if (!checkins) return null;
    const [todayC, yestC] = checkins;
    if (minute >= CHECKIN_FROM_HOUR * 60 && !todayC) return day;
    if (minute < 12 * 60 && yesterday && !yesterday.deleted && !yestC) return yId;
    return null;
  })();

  // Yesterday is offered for closing only if it was actually used (started or tracked).
  const yRecords = (yRecs ?? []).filter(r => !r.deleted);
  const showYesterday = yesterday && !yesterday.deleted && yesterday.status !== 'closed' && (yesterday.status === 'active' || yRecords.length > 0);

  const dateLabel = dateFromIso(day).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <DayView
      key={day}
      dayId={day}
      live
      title={m.today.title}
      sub={<span>{dateLabel}</span>}
      sideTop={showYesterday ? <YesterdayCard dayId={yId} blocks={liveBlocks(yBlocks ?? [])} records={yRecords} /> : null}
      sideBottom={checkinFor && (
        <QuestionSet
          key={checkinFor}
          questions={DAILY}
          kind="daily"
          about={checkinFor}
          title={m.checkin.title(STAGE)}
          meta={checkinFor === day ? m.checkin.meta(DAILY.length) : m.checkin.about(dateFromIso(checkinFor).toLocaleDateString('en-US', { weekday: 'long' }))}
        />
      )}
    />
  );
}

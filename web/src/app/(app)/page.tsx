'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef } from 'react';
import { Plus } from 'lucide-react';
import { SyncBadge } from '@/components/AppShell';
import { QuestionSet } from '@/components/Checkin';
import { NowNext } from '@/components/NowNext';
import { PlanEditor, type BlockPatch, type EditKind } from '@/components/PlanEditor';
import { m } from '@/i18n/en';
import { track } from '@/lib/analytics';
import { CHECKIN_FROM_HOUR, NEW_BLOCK_MIN, STAGE } from '@/lib/config';
import { getDB, getMeta, setMeta } from '@/lib/db';
import { useClock } from '@/lib/hooks';
import { ensureDay, liveBlocks, remove, save, uid, update } from '@/lib/repo';
import { addDays, dateFromIso } from '@/lib/time';
import type { DayBlock, TimelineBlock } from '@/lib/types';
import { DAILY } from '@/lib/validation';

const DEFAULT_AREA = 'area-personal';

export default function TodayPage() {
  const { day, minute } = useClock();
  const scrolled = useRef(false);

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

  const dayRec = useLiveQuery(() => getDB().days.get(day), [day]);
  const rows = useLiveQuery(() => getDB().dayBlocks.where('dayId').equals(day).toArray(), [day]);
  const areas = useLiveQuery(() => getDB().areas.toArray(), []);
  const checkins = useLiveQuery(() => getDB().checkins.bulkGet([day, addDays(day, -1)]), [day]);
  const yesterday = useLiveQuery(() => getDB().days.get(addDays(day, -1)), [day]);

  const blocks = useMemo(() => liveBlocks(rows ?? []), [rows]);
  const areaMap = useMemo(() => new Map((areas ?? []).map(a => [a.id, a])), [areas]);

  // Scroll so the NOW line sits in the upper third, once per visit.
  useEffect(() => {
    if (scrolled.current || !rows) return;
    scrolled.current = true;
    requestAnimationFrame(() => {
      const el = document.querySelector('[data-now]');
      if (el && window.matchMedia('(min-width: 821px)').matches) {
        const top = el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.3;
        window.scrollTo({ top: Math.max(0, top) });
      }
    });
  }, [rows]);

  const checkinFor = (() => {
    if (!checkins) return null;
    const [todayC, yestC] = checkins;
    if (minute >= CHECKIN_FROM_HOUR * 60 && !todayC) return day;
    if (minute < 12 * 60 && yesterday && !yesterday.deleted && !yestC) return addDays(day, -1);
    return null;
  })();

  async function onCreate(start: number, end: number, surface: string) {
    const b: DayBlock = { id: uid(), dayId: day, start, end, title: m.inspector.newBlock, areaId: DEFAULT_AREA, updatedAt: '' };
    await save('day_block', b);
    track('block_created', { area: b.areaId, duration_min: end - start, from_template: false, surface });
    return b.id;
  }

  function onUpdate(id: string, patch: BlockPatch, kind: EditKind, before: TimelineBlock) {
    const rec = rows?.find(r => r.id === id);
    if (!rec) return;
    void update<DayBlock>('day_block', id, patch);
    const fromTemplate = !!rec.fromTemplate;
    if (kind === 'move') track('block_moved', { delta_min: (patch.start ?? before.start) - before.start, from_template: fromTemplate, area: rec.areaId });
    else if (kind === 'rename') track('block_renamed', { from_template: fromTemplate, area: rec.areaId });
    else if (kind === 'area') track('block_area_changed', { from: before.areaId, to: patch.areaId, from_template: fromTemplate });
    else {
      const oldLen = before.end - before.start, newLen = (patch.end ?? before.end) - (patch.start ?? before.start);
      track('block_resized', { delta_min: newLen - oldLen, start_delta_min: (patch.start ?? before.start) - before.start, edge: kind, from_template: fromTemplate, area: rec.areaId });
    }
  }

  function onDelete(b: TimelineBlock) {
    const rec = rows?.find(r => r.id === b.id);
    void remove('day_block', b.id);
    track('block_deleted', { area: b.areaId, duration_min: b.end - b.start, from_template: !!rec?.fromTemplate });
  }

  if (!rows || !areas) return <div className="page" />;

  const date = dateFromIso(day);
  const dateLabel = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const templateName = m.templates.names[dayRec?.templateId ?? ''] ?? '';
  const nextSlot = Math.ceil(minute / 30) * 30;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>{m.today.title}</h1>
          <div className="sub"><span>{dateLabel}</span><span>·</span><span>{m.today.template(templateName)}</span></div>
        </div>
        <div className="row">
          <span className="sheet-only"><SyncBadge /></span>
          <button type="button" className="btn sm" onClick={() => void onCreate(nextSlot, nextSlot + NEW_BLOCK_MIN, 'button')}>
            <Plus size={15} />{m.today.addBlock}
          </button>
        </div>
      </header>
      <PlanEditor
        blocks={blocks}
        areas={areas}
        nowMin={minute}
        note={m.today.onlyToday}
        onCreate={onCreate}
        onUpdate={onUpdate}
        onDelete={onDelete}
        side={<NowNext blocks={blocks} areas={areaMap} minute={minute} />}
        sideAfter={
          <>
            {checkinFor && (
              <QuestionSet
                key={checkinFor}
                questions={DAILY}
                kind="daily"
                about={checkinFor}
                title={m.checkin.title(STAGE)}
                meta={checkinFor === day ? m.checkin.meta(DAILY.length) : m.checkin.about(dateFromIso(checkinFor).toLocaleDateString('en-US', { weekday: 'long' }))}
              />
            )}
          </>
        }
      />
    </div>
  );
}

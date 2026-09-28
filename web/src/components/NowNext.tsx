'use client';
import { m } from '@/i18n/en';
import { nowNext } from '@/lib/dayLogic';
import { AreaIcon } from '@/lib/icons';
import { fmtDuration, fmtMin } from '@/lib/time';
import type { Area, TimelineBlock } from '@/lib/types';

export function NowNext({ blocks, areas, minute }: { blocks: TimelineBlock[]; areas: Map<string, Area>; minute: number }) {
  const { now, next, remaining, progress, untilNext } = nowNext(blocks, minute);
  const na = now ? areas.get(now.areaId) : undefined;
  const xa = next ? areas.get(next.areaId) : undefined;
  return (
    <>
      <section className="card nowcard now" data-color={na?.color ?? 'blue'} aria-label={m.today.now}>
        <span className="label">{m.today.now}</span>
        {now ? (
          <>
            <div className="big"><span className="dot" />{na && <AreaIcon name={na.icon} size={16} />}<span>{now.title}</span></div>
            <div className="meta tabular"><span>{fmtMin(now.start)}–{fmtMin(now.end)}</span><span>{m.today.remaining(fmtDuration(remaining))}</span></div>
            <div className="bar"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>
          </>
        ) : <span className="secondary">{m.today.nothingNow}</span>}
      </section>
      <section className="card nowcard next" data-color={xa?.color ?? 'gray'} aria-label={m.today.next}>
        <span className="label">{m.today.next}</span>
        {next ? (
          <>
            <div className="big"><span className="dot" />{xa && <AreaIcon name={xa.icon} size={14} />}<span>{next.title}</span></div>
            <div className="meta tabular"><span>{fmtMin(next.start)}–{fmtMin(next.end)}</span><span>{m.today.startsIn(fmtDuration(untilNext))}</span></div>
          </>
        ) : <span className="secondary">{m.today.nothingNext}</span>}
      </section>
    </>
  );
}

'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { Suspense, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayView } from '@/components/day/DayView';
import { m } from '@/i18n/en';
import { track } from '@/lib/analytics';
import { getDB } from '@/lib/db';
import { useClock } from '@/lib/hooks';
import { addDays, dateFromIso } from '@/lib/time';

/** Any past day, fully editable (historical editing never touches the Baseline). */
function DayPageInner() {
  const day = useSearchParams().get('d') ?? '';
  const { day: today } = useClock();
  const exists = useLiveQuery(async () => !!(await getDB().days.get(day)), [day]);
  useEffect(() => { track('history_day_opened', { days_back: Math.round((dateFromIso(today).getTime() - dateFromIso(day).getTime()) / 864e5) }); }, [day, today]);
  const label = dateFromIso(day).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const nav = (
    <div className="row">
      <Link href={`/day?d=${addDays(day, -1)}`} className="btn icon sm" aria-label={m.history.prevDay}><ChevronLeft size={15} /></Link>
      {addDays(day, 1) <= today && <Link href={addDays(day, 1) === today ? '/' : `/day?d=${addDays(day, 1)}`} className="btn icon sm" aria-label={m.history.nextDay}><ChevronRight size={15} /></Link>}
    </div>
  );
  if (day === today) return <DayView key={day} dayId={day} live title={m.today.title} sub={<span>{label}</span>} />;
  if (exists === false) return (
    <div className="page"><header className="page-head"><div><Link href="/history" className="back-link" style={{ display: 'inline-flex' }}><ChevronLeft size={18} />{m.history.back}</Link><h1>{label}</h1></div>{nav}</header><p className="secondary">{m.history.empty}</p></div>
  );
  return (
    <DayView key={day} dayId={day} live={false}
      title={<><Link href="/history" className="back-link" style={{ display: 'inline-flex' }}><ChevronLeft size={18} />{m.history.back}</Link><span className="day-title">{label}</span></>}
      headExtra={nav} />
  );
}

export default function DayPage() {
  return <Suspense fallback={<div className="page" />}><DayPageInner /></Suspense>;
}

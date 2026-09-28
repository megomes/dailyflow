'use client';
import { useState } from 'react';
import { m } from '@/i18n/en';
import { track } from '@/lib/analytics';
import { STAGE } from '@/lib/config';
import { save } from '@/lib/repo';
import type { Checkin } from '@/lib/types';
import { SCALE_HINT, type Question } from '@/lib/validation';

/** One set of objective questions. Every answer (or skip) becomes a validation_answered event. */
export function QuestionSet({ questions, kind, about, onDone, title, meta }: {
  questions: Question[]; kind: 'daily' | 'retro'; about: string; onDone?: () => void; title: string; meta?: string;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const complete = questions.every(q => answers[q.id]);
  const hasScale = questions.some(q => q.options[0] === '1');

  async function finish(skipped: boolean) {
    for (const q of questions) {
      const value = skipped ? null : answers[q.id] ?? null;
      track('validation_answered', { question_id: q.id, kind, about_day: about, value, note: notes[q.id] || undefined, skipped: skipped || value == null });
    }
    track(skipped ? 'checkin_skipped' : 'checkin_completed', { kind, about_day: about, stage: STAGE });
    if (kind === 'daily') {
      await save<Checkin>('checkin', {
        id: about, day: about, status: skipped ? 'skipped' : 'answered',
        answers: skipped ? {} : { ...answers, ...Object.fromEntries(Object.entries(notes).map(([k, v]) => [`${k}.note`, v])) },
        updatedAt: '',
      });
    }
    setSent(true);
    onDone?.();
  }

  if (sent) return <div className="card checkin"><span className="secondary">{m.checkin.thanks}</span></div>;

  return (
    <div className="card checkin">
      <div className="row"><span className="label">{title}</span><span className="spacer" />{meta && <span className="hint">{meta}</span>}</div>
      {questions.map(q => (
        <div className="q" key={q.id}>
          <b>{q.text}</b>
          <div className="opts" role="group" aria-label={q.text}>
            {q.options.map(o => (
              <button key={o} type="button" className="chip" aria-pressed={answers[q.id] === o}
                onClick={() => setAnswers(a => ({ ...a, [q.id]: o }))}>{o}</button>
            ))}
          </div>
          {q.followUp && answers[q.id] === q.followUp.when && (
            <input className="input" placeholder={q.followUp.placeholder} value={notes[q.id] ?? ''}
              onChange={e => setNotes(n => ({ ...n, [q.id]: e.target.value }))} />
          )}
        </div>
      ))}
      {hasScale && <span className="hint">{SCALE_HINT}</span>}
      <div className="row">
        <span className="spacer" />
        <button type="button" className="btn sm ghost" onClick={() => void finish(true)}>{m.checkin.skip}</button>
        <button type="button" className="btn sm primary" disabled={!complete} onClick={() => void finish(false)}>{m.checkin.send}</button>
      </div>
    </div>
  );
}

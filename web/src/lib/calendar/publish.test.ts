import { describe, expect, it } from 'vitest';
import { needsWork } from './publish';
import type { DayBlock, PublishTarget } from '../types';

const b = (p: Partial<DayBlock> = {}): DayBlock => ({ id: 'b', dayId: 'd', start: 600, end: 660, title: 'Deep work', areaId: 'w', updatedAt: '', ...p });
const t = (p: Partial<PublishTarget> = {}): PublishTarget => ({ calendarKey: 'k', provider: 'google', accountId: 'a', calendarId: 'c', availability: 'busy', state: 'pending', ...p });

describe('publish agent decisions', () => {
  it('creates, updates on change and deletes', () => {
    expect(needsWork(b(), t(), 'me')).toBe('create');
    const ok = t({ state: 'ok', eventId: 'e', synced: { start: 600, end: 660, title: 'Deep work', availability: 'busy' } });
    expect(needsWork(b(), ok, 'me')).toBeNull();
    expect(needsWork(b({ start: 630, end: 690 }), ok, 'me')).toBe('update');
    expect(needsWork(b(), { ...ok, availability: 'free' }, 'me')).toBe('update');
    expect(needsWork(b({ deleted: true }), ok, 'me')).toBe('delete');
    expect(needsWork(b(), { ...ok, state: 'remove' }, 'me')).toBe('delete');
    expect(needsWork(b(), { ...ok, state: 'removed' }, 'me')).toBeNull();
  });
  it('waits for retry on error and respects another device lock', () => {
    expect(needsWork(b(), t({ state: 'error' }), 'me')).toBeNull();
    expect(needsWork(b(), t({ lock: { device: 'other', at: new Date().toISOString() } }), 'me')).toBeNull();
    expect(needsWork(b(), t({ lock: { device: 'other', at: new Date(Date.now() - 120_000).toISOString() } }), 'me')).toBe('create');
  });
});

import { describe, expect, it } from 'vitest';
import { parseQuick } from './quickParse';

const areas = [{ id: 'maker', name: 'Maker' }, { id: 'music', name: 'Music' }, { id: 'phys', name: 'Physical Activity' }, { id: 'fam', name: 'Família' }];

describe('quick add parsing', () => {
  it('keeps plain text as the title', () => {
    expect(parseQuick('Comprar PETG', areas)).toEqual({ title: 'Comprar PETG' });
  });
  it('reads estimate, priority, area and day', () => {
    expect(parseQuick('Imprimir case 1h30 #mak ! amanhã', areas)).toEqual({ title: 'Imprimir case', estimate: 90, priority: 'high', areaId: 'maker', areaToken: 'mak', when: 'tomorrow' });
    expect(parseQuick('Ligar dentista 15m today', areas)).toMatchObject({ title: 'Ligar dentista', estimate: 15, when: 'today' });
    expect(parseQuick('Treino 2h #activity', areas)).toMatchObject({ title: 'Treino', estimate: 120, areaId: 'phys' });
    expect(parseQuick('Jantar #familia', areas)).toMatchObject({ areaId: 'fam' });
  });
  it('leaves unknown tags and numbers inside words alone', () => {
    expect(parseQuick('Fix bug #123x in v2', areas)).toEqual({ title: 'Fix bug #123x in v2' });
    expect(parseQuick('Comprar 3 parafusos M3', areas).title).toBe('Comprar 3 parafusos M3');
  });
});

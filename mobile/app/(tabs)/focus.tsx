import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { nowNext } from '@shared/dayLogic';
import { useClock, useStore } from '../../src/hooks';
import { activeFocus, dayBlocks, endFocus, focusElapsedSec, pauseFocus, PRESETS, resumeFocus, startFocus } from '../../src/ops';
import { C } from '../../src/theme';
import { Btn, Card, Label, Row, s } from '../../src/ui';

const clock = (sec: number) => { const v = Math.max(0, Math.floor(sec)); const h = Math.floor(v / 3600), mm = Math.floor((v % 3600) / 60), ss = v % 60; return `${h ? `${h}:` : ''}${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`; };

/** Focus timer, the same sessions as the web (visible on every device). */
export default function Focus() {
  useStore();
  const { day, minute } = useClock();
  const [tick, setTick] = useState(Date.now());
  const f = activeFocus();
  useEffect(() => { if (!f) return; const t = setInterval(() => setTick(Date.now()), 1000); return () => clearInterval(t); }, [f]);
  const nb = nowNext(dayBlocks(day), minute).now;
  const el = f ? focusElapsedSec(f, tick) : 0;
  const left = f && f.focusMin ? f.focusMin * 60 - el : null;
  useEffect(() => { if (left != null && left <= 0 && left > -1.5) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }, [left]);
  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.h1}>Focus</Text>
        {f ? (
          <Card accent={C.focus}>
            <Label>{f.state === 'paused' ? 'Paused' : 'Focusing'} · {f.preset}</Label>
            <Text style={s.big}>{f.title}</Text>
            <Text style={{ color: left != null && left < 0 ? C.warn : C.text, fontSize: 56, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{left == null ? clock(el) : left >= 0 ? clock(left) : `+${clock(-left)}`}</Text>
            <Row>
              {f.state === 'paused' ? <Btn title="Resume" onPress={() => resumeFocus(f.id)} /> : <Btn title="Pause" onPress={() => pauseFocus(f.id)} />}
              <Btn title="Finish" kind="primary" onPress={() => endFocus(f.id, 'done')} />
              <Btn title="Stop" kind="ghost" onPress={() => endFocus(f.id, 'interrupted')} />
            </Row>
          </Card>
        ) : (
          <Card>
            <Label>{nb ? `Focus on ${nb.title}` : 'Focus'}</Label>
            <Row>{PRESETS.map(p => <Btn key={p.id} title={p.id === 'stopwatch' ? 'Stopwatch' : p.id.replace('/', ' / ')} onPress={() => startFocus(day, p, { areaId: nb?.areaId ?? 'area-personal', title: nb?.title ?? 'Focus', blockId: nb?.id })} />)}</Row>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

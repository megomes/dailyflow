import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { nowNext } from '@shared/dayLogic';
import { fmtDuration, fmtMin } from '@shared/time';
import type { Day } from '@shared/types';
import { useClock, useStore } from '../../src/hooks';
import { areas, dayBlocks, dayRecords, ensureDay, runningRecord, startActivity, startDay, stopActivity, todayTasks, toggleTask } from '../../src/ops';
import { get } from '../../src/store';
import { AREA, C, tint } from '../../src/theme';
import { Btn, Card, Label, Row, s } from '../../src/ui';

/** Today on the phone: Now (start/stop), quick switch, Next, the plan with the real beside it. */
export default function Today() {
  const status = useStore();
  const { day, minute, now } = useClock(10_000);
  ensureDay(day);
  const [switching, setSwitching] = useState(false);
  const [name, setName] = useState('');
  const blocks = dayBlocks(day);
  const records = dayRecords(day);
  const running = runningRecord();
  const areaList = areas();
  const areaMap = new Map(areaList.map(a => [a.id, a]));
  const { now: nb, next, remaining, untilNext } = nowNext(blocks, minute);
  const d = get<Day>('day', day);
  const color = (id: string) => AREA[areaMap.get(id)?.color ?? 'gray'];
  const elapsed = running?.startedAt ? Math.floor((now.getTime() - Date.parse(running.startedAt)) / 60000) : 0;
  const tasks = todayTasks(day).filter(t => !nb || t.blockId === nb.id || !t.blockId);

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ScrollView contentContainerStyle={s.content}>
        <View>
          <Text style={s.h1}>Today</Text>
          <Text style={s.sub}>{now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · {status.state === 'idle' ? 'Synced' : status.state}{status.pending ? ` · ${status.pending}` : ''}</Text>
        </View>
        {(!d?.status || d.status === 'unplanned') && (
          <Card accent={C.warn}><Label>Today is not started</Label><Btn title="Start day" kind="primary" onPress={() => startDay(day)} /></Card>
        )}
        <Card accent={running ? color(running.areaId) : nb ? color(nb.areaId) : undefined}>
          <Label>{running ? 'Doing' : 'Now'}</Label>
          {running ? (
            <>
              <Text style={s.big}>{running.title || areaMap.get(running.areaId)?.name}</Text>
              <Text style={s.text2}>since {fmtMin(running.start)} · {fmtDuration(elapsed)}</Text>
            </>
          ) : nb ? (
            <>
              <Text style={s.big}>{nb.title}</Text>
              <Text style={s.text2}>{fmtMin(nb.start)}–{fmtMin(nb.end)} · {fmtDuration(remaining)} left</Text>
            </>
          ) : <Text style={s.text2}>Nothing planned right now</Text>}
          <Row>
            {running ? <Btn title="Stop" onPress={() => stopActivity(running.id)} />
              : nb ? <Btn title="Start" kind="primary" onPress={() => startActivity(day, { areaId: nb.areaId, title: nb.title, blockId: nb.id, source: 'live' })} /> : null}
            {running && nb && running.blockId !== nb.id && <Btn title={`Switch to ${nb.title}`} onPress={() => startActivity(day, { areaId: nb.areaId, title: nb.title, blockId: nb.id, source: 'live' })} />}
            <Btn title="Something else" kind="ghost" onPress={() => setSwitching(true)} />
          </Row>
          {tasks.length > 0 && tasks.slice(0, 5).map(t => (
            <Pressable key={t.id} onPress={() => toggleTask(t.id)} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 4 }}>
              <Text style={{ color: t.status === 'done' ? C.ok : C.muted, fontSize: 16 }}>{t.status === 'done' ? '●' : '○'}</Text>
              <Text style={[s.text, t.status === 'done' && { color: C.muted, textDecorationLine: 'line-through' }]}>{t.title}</Text>
            </Pressable>
          ))}
        </Card>
        <Card>
          <Label>Next</Label>
          {next ? <Text style={s.text}>{next.title} · {fmtMin(next.start)} <Text style={s.muted}>in {fmtDuration(untilNext)}</Text></Text> : <Text style={s.text2}>Nothing else today</Text>}
        </Card>
        <Label>Plan · Real</Label>
        {blocks.map(b => {
          const recs = records.filter(r => r.start < b.end && (r.end ?? minute) > b.start);
          const cur = b.start <= minute && minute < b.end;
          return (
            <View key={b.id} style={{ flexDirection: 'row', gap: 8 }}>
              <Text style={[s.muted, { width: 44, paddingTop: 10 }]}>{fmtMin(b.start)}</Text>
              <View style={{ flex: 1, borderRadius: 8, padding: 10, backgroundColor: tint(color(b.areaId), 0.22), borderWidth: cur ? 1.5 : 1, borderColor: cur ? color(b.areaId) : tint(color(b.areaId), 0.46), opacity: b.end <= minute ? 0.75 : 1 }}>
                <Text style={{ color: tint(color(b.areaId), 0.52, C.text), fontWeight: '600' }}>{b.title}</Text>
                <Text style={s.muted}>{fmtMin(b.start)}–{fmtMin(b.end)}</Text>
                {recs.length > 0 && <Text style={[s.muted, { marginTop: 4 }]}>Real: {recs.map(r => `${fmtMin(r.start)}–${r.end == null ? 'now' : fmtMin(r.end)} ${r.title || areaMap.get(r.areaId)?.name}`).join(' · ')}</Text>}
              </View>
            </View>
          );
        })}
      </ScrollView>
      <Modal visible={switching} transparent animationType="slide" onRequestClose={() => setSwitching(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.5)' }} onPress={() => setSwitching(false)} />
        <View style={{ backgroundColor: C.elevated, padding: 16, gap: 12, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
          <Text style={s.big}>What are you doing?</Text>
          <TextInput style={s.input} placeholder="Optional name" placeholderTextColor={C.disabled} value={name} onChangeText={setName} />
          <Row>
            {areaList.map(a => (
              <Pressable key={a.id} style={s.chip} onPress={() => { startActivity(day, { areaId: a.id, title: name.trim() || a.name, source: 'switch' }); setName(''); setSwitching(false); }}>
                <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: AREA[a.color] }} />
                <Text style={s.text}>{a.name}</Text>
              </Pressable>
            ))}
          </Row>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

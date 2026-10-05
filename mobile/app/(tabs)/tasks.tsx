import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useClock, useStore } from '../../src/hooks';
import { createTask, inboxTasks, todayTasks, toggleTask } from '../../src/ops';
import { patch } from '../../src/store';
import type { Task } from '@shared/types';
import { C } from '../../src/theme';
import { Card, Label, s } from '../../src/ui';

/** Capture fast (no fields required), check off, move to today. Triage stays on the desktop. */
export default function Tasks() {
  useStore();
  const { day } = useClock();
  const [text, setText] = useState('');
  const today = todayTasks(day);
  const inbox = inboxTasks();
  const row = (t: Task, toToday = false) => (
    <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
      <Pressable onPress={() => toggleTask(t.id)} hitSlop={10}><Text style={{ color: t.status === 'done' ? C.ok : C.muted, fontSize: 18 }}>{t.status === 'done' ? '●' : '○'}</Text></Pressable>
      <Text style={[s.text, { flex: 1 }, t.status === 'done' && { color: C.muted, textDecorationLine: 'line-through' }]}>{t.priority === 'high' ? '! ' : ''}{t.title}</Text>
      {toToday && <Pressable onPress={() => patch<Task>('task', t.id, { status: 'today', dayId: day })} hitSlop={10}><Text style={{ color: C.focus }}>Today</Text></Pressable>}
    </View>
  );
  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.h1}>Tasks</Text>
        <TextInput style={s.input} placeholder="Add a task to the Inbox…" placeholderTextColor={C.disabled} value={text} onChangeText={setText}
          returnKeyType="done" onSubmitEditing={() => { if (text.trim()) { createTask(text); setText(''); } }} />
        <Card><Label>Today · {today.filter(t => t.status !== 'done').length}</Label>{today.length ? today.map(t => row(t)) : <Text style={s.text2}>Nothing scheduled today.</Text>}</Card>
        <Card><Label>Inbox & Backlog · {inbox.length}</Label>{inbox.length ? inbox.slice(0, 50).map(t => row(t, true)) : <Text style={s.text2}>Inbox zero.</Text>}</Card>
      </ScrollView>
    </SafeAreaView>
  );
}

import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { C } from './theme';

/** Small set of primitives in the design system (dark, dense, segmented). */
export function Card({ children, style, accent }: { children: ReactNode; style?: ViewStyle; accent?: string }) {
  return <View style={[s.card, accent ? { borderColor: accent } : null, style]}>{children}</View>;
}
export function Label({ children }: { children: ReactNode }) {
  return <Text style={s.label}>{children}</Text>;
}
export function Btn({ title, onPress, kind = 'default', disabled }: { title: string; onPress: () => void; kind?: 'default' | 'primary' | 'ghost' | 'danger'; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [s.btn, kind === 'primary' && s.primary, kind === 'ghost' && s.ghost, pressed && { opacity: 0.8 }, disabled && { opacity: 0.5 }]}>
      <Text style={[s.btnText, kind === 'primary' && { color: C.bg }, kind === 'danger' && { color: C.danger }, kind === 'ghost' && { color: C.text2 }]}>{title}</Text>
    </Pressable>
  );
}
export function Row({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }, style]}>{children}</View>;
}
export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  h1: { color: C.text, fontSize: 24, fontWeight: '700', letterSpacing: -0.4 },
  sub: { color: C.muted, fontSize: 13, marginTop: 2 },
  card: { backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: 12, padding: 14, gap: 8 },
  label: { color: C.muted, fontSize: 11, fontWeight: '600', letterSpacing: 0.7, textTransform: 'uppercase' },
  big: { color: C.text, fontSize: 20, fontWeight: '700' },
  text: { color: C.text, fontSize: 14 },
  text2: { color: C.text2, fontSize: 13 },
  muted: { color: C.muted, fontSize: 12 },
  btn: { height: 36, paddingHorizontal: 14, borderRadius: 8, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center' },
  primary: { backgroundColor: C.text, borderColor: C.text },
  ghost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  btnText: { color: C.text, fontSize: 14, fontWeight: '600' },
  input: { height: 44, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, color: C.text, paddingHorizontal: 12, fontSize: 15 },
  chip: { height: 34, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: C.border, flexDirection: 'row', alignItems: 'center', gap: 6 },
});

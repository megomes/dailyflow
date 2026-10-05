'use client';
import { useSyncExternalStore } from 'react';
import type { Task } from '@/lib/types';

/** The task being dragged (HTML5 DnD hides dataTransfer during dragover, so its area lives here). */
let dragged: Task | null = null;
const subs = new Set<() => void>();
export function setDraggedTask(t: Task | null) { dragged = t; subs.forEach(f => f()); }
export function useDraggedTask() {
  return useSyncExternalStore(cb => { subs.add(cb); return () => { subs.delete(cb); }; }, () => dragged, () => null);
}

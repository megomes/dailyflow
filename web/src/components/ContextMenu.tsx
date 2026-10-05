'use client';
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type MouseEvent as RMouseEvent, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { track } from '@/lib/analytics';

/**
 * Context menus (note #22): right-click on desktop, press-and-hold on touch. One host renders them
 * (a popover at the pointer, or a bottom sheet after a long press). Items can be actions, a row of
 * quick chips (priority, area, estimate…) or a submenu that opens in place (‹ back).
 */

export interface MenuChip { label: string; color?: string; checked?: boolean; onSelect: () => unknown }
export type MenuItem =
  | { label: string; icon?: ReactNode; hint?: string; danger?: boolean; checked?: boolean; disabled?: boolean; color?: string; onSelect?: () => unknown; children?: MenuItem[] }
  | { chips: MenuChip[]; label?: string }
  | 'sep'
  | null
  | false
  | undefined;
export interface MenuSpec { title?: string; subtitle?: string; color?: string; kind: string; items: MenuItem[] }

type Open = { spec: MenuSpec; x: number; y: number; touch: boolean; key: number };
let open: Open | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach(f => f());
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

export function closeMenu() { if (open) { open = null; emit(); } }

export async function openMenu(at: { x: number; y: number; touch: boolean }, spec: MenuSpec | Promise<MenuSpec | null> | null) {
  const s = await spec;
  if (!s) return;
  if (at.touch) navigator.vibrate?.(10);
  open = { spec: s, ...at, key: Date.now() };
  emit();
  track('context_menu_opened', { kind: s.kind, touch: at.touch });
}

// ── Triggers ───────────────────────────────────────────────────────────────

const LONG_PRESS_MS = 480;
let press: { timer: number; x: number; y: number; off: () => void } | null = null;
let openedByPressAt = 0;

function cancelPress() { if (press) { clearTimeout(press.timer); press.off(); press = null; } }

/** The click that ends a long press must not also select/open what was pressed. */
function swallowNextClick() {
  const stop = (e: Event) => { e.stopPropagation(); e.preventDefault(); };
  window.addEventListener('click', stop, { capture: true, once: true });
  setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 700);
}

/** Call from onPointerDown: a touch held still opens the menu. Mouse is ignored (it has right-click). */
export function pressForMenu(e: RPointerEvent, build: () => MenuSpec | Promise<MenuSpec | null> | null) {
  if (e.pointerType === 'mouse' || e.button > 0) return;
  if ((e.target as HTMLElement).closest('input, textarea, select, [data-no-menu]')) return;
  cancelPress();
  const x = e.clientX, y = e.clientY;
  const move = (ev: PointerEvent) => { if (Math.hypot(ev.clientX - x, ev.clientY - y) > 10) cancelPress(); };
  const off = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', cancelPress); window.removeEventListener('pointercancel', cancelPress); };
  window.addEventListener('pointermove', move, { passive: true });
  window.addEventListener('pointerup', cancelPress);
  window.addEventListener('pointercancel', cancelPress);
  const timer = window.setTimeout(() => {
    press?.off(); press = null;
    openedByPressAt = Date.now();
    swallowNextClick();
    void openMenu({ x, y, touch: true }, build());
  }, LONG_PRESS_MS);
  press = { timer, x, y, off };
}

/** Call from onContextMenu (right-click; also Android's own long-press event). */
export function contextForMenu(e: RMouseEvent, build: () => MenuSpec | Promise<MenuSpec | null> | null) {
  if ((e.target as HTMLElement).closest('input, textarea, select, [data-no-menu]')) return;
  e.preventDefault();
  e.stopPropagation();
  const touch = (e.nativeEvent as PointerEvent).pointerType === 'touch' || (e.nativeEvent as PointerEvent).pointerType === 'pen';
  if (Date.now() - openedByPressAt < 1000) return; // our long press already opened it
  if (touch) { cancelPress(); openedByPressAt = Date.now(); swallowNextClick(); }
  void openMenu({ x: e.clientX, y: e.clientY, touch }, build());
}

/** Both triggers for an element that has no pointer handlers of its own. */
export function menuProps(build: () => MenuSpec | Promise<MenuSpec | null> | null) {
  return {
    onContextMenu: (e: RMouseEvent) => contextForMenu(e, build),
    onPointerDown: (e: RPointerEvent) => pressForMenu(e, build),
  };
}

// ── Host ───────────────────────────────────────────────────────────────────

type Action = Extract<MenuItem, { label: string; onSelect?: unknown }>;
const real = (items: MenuItem[]) => items.filter((x): x is Exclude<MenuItem, null | false | undefined> => !!x);

export function ContextMenuHost() {
  const cur = useSyncExternalStore(subscribe, () => open, () => null);
  const [stack, setStack] = useState<{ title: string; items: MenuItem[] }[]>([]);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [lastKey, setLastKey] = useState(0);
  if (cur && cur.key !== lastKey) { setLastKey(cur.key); setStack([]); setPos(null); }

  // Desktop popover: at the pointer, kept inside the viewport.
  useLayoutEffect(() => {
    if (!cur || cur.touch || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(cur.x, window.innerWidth - r.width - 8));
    const top = cur.y + r.height + 8 > window.innerHeight ? Math.max(8, cur.y - r.height) : cur.y;
    setPos(p => (p && p.left === left && p.top === top ? p : { left, top }));
  }, [cur, stack]);

  useEffect(() => {
    if (!cur) return;
    ref.current?.querySelector<HTMLElement>('button:not(:disabled)')?.focus({ preventScroll: true });
  }, [cur, stack]);

  useEffect(() => {
    if (!cur) return;
    const outside = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) closeMenu(); };
    const away = () => closeMenu();
    const id = window.setTimeout(() => window.addEventListener('pointerdown', outside, true), 0);
    window.addEventListener('resize', away);
    if (!cur.touch) window.addEventListener('scroll', away, true);
    window.addEventListener('popstate', away);
    return () => {
      clearTimeout(id);
      window.removeEventListener('pointerdown', outside, true);
      window.removeEventListener('resize', away);
      window.removeEventListener('scroll', away, true);
      window.removeEventListener('popstate', away);
    };
  }, [cur]);

  if (!cur) return null;
  const level = stack[stack.length - 1];
  const items = real(level?.items ?? cur.spec.items);

  function run(fn: (() => unknown) | undefined, label: string) {
    closeMenu();
    track('context_menu_action', { kind: cur!.spec.kind, action: label });
    void Promise.resolve().then(fn);
  }
  function onKey(e: KeyboardEvent) {
    const btns = [...(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? [])];
    const i = btns.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') { e.preventDefault(); if (stack.length) setStack(s => s.slice(0, -1)); else closeMenu(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); btns[(i + (e.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length]?.focus(); }
    else if (e.key === 'ArrowLeft' && stack.length) { e.preventDefault(); setStack(s => s.slice(0, -1)); }
    else if (e.key === 'ArrowRight') { const el = document.activeElement as HTMLElement | null; if (el?.dataset.sub) el.click(); }
  }

  const body = (
    <div ref={ref} role="menu" aria-label={level?.title ?? cur.spec.title} onKeyDown={onKey}
      className={cur.touch ? 'ctx-menu ctx-sheet' : 'ctx-menu ctx-pop'}
      style={cur.touch ? undefined : { left: pos?.left ?? cur.x, top: pos?.top ?? cur.y, visibility: pos ? 'visible' : 'hidden' }}>
      {stack.length > 0 ? (
        <button type="button" className="ctx-back" onClick={() => setStack(s => s.slice(0, -1))}><ChevronLeft size={15} />{level.title}</button>
      ) : cur.spec.title ? (
        <div className="ctx-head" data-color={cur.spec.color}>
          {cur.spec.color && <span className="dot" />}
          <span className="ctx-title">{cur.spec.title}</span>
          {cur.spec.subtitle && <span className="ctx-sub">{cur.spec.subtitle}</span>}
        </div>
      ) : null}
      {items.map((it, i) => {
        if (it === 'sep') return <div key={i} className="ctx-sep" role="separator" />;
        if ('chips' in it) return (
          <div key={i} className="ctx-chips" role="group" aria-label={it.label}>
            {it.label && <span className="ctx-chips-label">{it.label}</span>}
            <div className="ctx-chips-row">
              {it.chips.map(c => (
                <button key={c.label} type="button" role="menuitemradio" aria-checked={!!c.checked} className={`chip${c.checked ? ' on' : ''}`} data-color={c.color}
                  onClick={() => run(c.onSelect, `${it.label ?? 'chip'}:${c.label}`)}>
                  {c.color && <span className="dot" />}{c.label}
                </button>
              ))}
            </div>
          </div>
        );
        const a = it as Action;
        const sub = !!a.children;
        return (
          <button key={i} type="button" role="menuitem" className={`ctx-item${a.danger ? ' danger' : ''}`} disabled={a.disabled} data-color={a.color} data-sub={sub || undefined}
            onClick={() => (sub ? setStack(s => [...s, { title: a.label, items: a.children! }]) : run(a.onSelect, a.label))}>
            <span className="ctx-icon">{a.checked ? <Check size={14} /> : a.color ? <span className="dot" /> : a.icon}</span>
            <span className="ctx-label">{a.label}</span>
            {a.hint && <span className="ctx-hint">{a.hint}</span>}
            {sub && <ChevronRight size={14} className="ctx-chev" />}
          </button>
        );
      })}
    </div>
  );
  return cur.touch ? <><div className="ctx-backdrop" onClick={closeMenu} />{body}</> : body;
}

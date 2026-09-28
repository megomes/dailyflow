import { track } from './analytics';

export type Theme = 'dark' | 'light';

export function currentTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

function apply(t: Theme) {
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('df-theme', t); } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent('df-theme', { detail: t }));
}

let busy = false;

/**
 * Design system §14.1: the light theme is always the top layer, clipped by a circle centered
 * on the clicked button. Dark → light opens the circle; light → dark closes it.
 */
export function toggleTheme(origin?: HTMLElement | null) {
  if (busy) return;
  const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
  track('theme_changed', { to: next });
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> } };
  if (!doc.startViewTransition || reduce) { apply(next); return; }
  const cls = next === 'light' ? 'vt-open' : 'vt-close';
  root.classList.add(cls);
  busy = true;
  const vt = doc.startViewTransition(() => apply(next));
  vt.ready.then(() => {
    const r = origin?.getBoundingClientRect();
    const x = r ? r.left + r.width / 2 : 40, y = r ? r.top + r.height / 2 : window.innerHeight - 40;
    const R = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const open = `circle(${R}px at ${x}px ${y}px)`, shut = `circle(0px at ${x}px ${y}px)`;
    if (next === 'light') root.animate({ clipPath: [shut, open] }, { duration: 700, easing: 'cubic-bezier(.22,.61,.36,1)', pseudoElement: '::view-transition-new(root)', fill: 'both' });
    else root.animate({ clipPath: [open, shut] }, { duration: 600, easing: 'cubic-bezier(.65,0,.35,1)', pseudoElement: '::view-transition-old(root)', fill: 'both' });
  }).catch(() => {});
  vt.finished.finally(() => { root.classList.remove('vt-open', 'vt-close'); busy = false; });
}

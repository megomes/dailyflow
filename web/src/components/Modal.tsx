'use client';
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Open modals, newest last: Esc closes only the top one (capture → details on top of it). */
const stack: object[] = [];

/** Centered dialog on desktop, bottom sheet on phones. Esc and backdrop close it. Portaled to body (escapes sticky columns). */
export function Modal({ children, onClose, label, wide = false }: { children: ReactNode; onClose: () => void; label: string; wide?: boolean }) {
  useEffect(() => {
    const token = {};
    stack.push(token);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && stack[stack.length - 1] === token) { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('keydown', onKey, true); stack.splice(stack.indexOf(token), 1); };
  }, [onClose]);
  // Keyboard-proof: follow the visual viewport (WebViews don't always resize the layout) and keep the focused field in view (note #31).
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    const apply = () => {
      if (!vv) return;
      root.style.setProperty('--vv-h', `${vv.height}px`);
      root.style.setProperty('--vv-top', `${vv.offsetTop}px`);
    };
    const onFocus = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
    };
    apply();
    vv?.addEventListener('resize', apply);
    vv?.addEventListener('scroll', apply);
    document.addEventListener('focusin', onFocus);
    return () => {
      vv?.removeEventListener('resize', apply);
      vv?.removeEventListener('scroll', apply);
      document.removeEventListener('focusin', onFocus);
      root.style.removeProperty('--vv-h');
      root.style.removeProperty('--vv-top');
    };
  }, []);
  return createPortal(
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={label}>{children}</div>
    </>,
    document.body,
  );
}

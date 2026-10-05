'use client';
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Centered dialog on desktop, bottom sheet on phones. Esc and backdrop close it. Portaled to body (escapes sticky columns). */
export function Modal({ children, onClose, label, wide = false }: { children: ReactNode; onClose: () => void; label: string; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return createPortal(
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={label}>{children}</div>
    </>,
    document.body,
  );
}

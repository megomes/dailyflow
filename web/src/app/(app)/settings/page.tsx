'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ChevronRight, MessageSquareText } from 'lucide-react';
import { m } from '@/i18n/en';
import { SETTINGS_SECTIONS } from '@/lib/settingsNav';

/** Phone: list of settings sections. Desktop: go straight to the first section (the sidebar lists the rest). */
export default function SettingsIndex() {
  const router = useRouter();
  useEffect(() => {
    if (window.matchMedia('(min-width: 821px)').matches) router.replace(SETTINGS_SECTIONS[0].href);
  }, [router]);

  return (
    <nav className="settings-list" aria-label="Settings sections">
      {SETTINGS_SECTIONS.map(s => (
        <Link key={s.href} href={s.href}>
          <span className="sl-icon"><s.icon size={17} strokeWidth={1.7} /></span>
          <span className="sl-text"><b>{s.label}</b><span>{s.hint}</span></span>
          <ChevronRight size={17} className="sl-chev" />
        </Link>
      ))}
      <Link href="/notes">
        <span className="sl-icon"><MessageSquareText size={17} strokeWidth={1.7} /></span>
        <span className="sl-text"><b>{m.nav.notes}</b><span>{m.notes.subtitle.split('.')[0]}</span></span>
        <ChevronRight size={17} className="sl-chev" />
      </Link>
    </nav>
  );
}

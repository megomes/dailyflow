'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { m } from '@/i18n/en';
import { SETTINGS_SECTIONS } from '@/lib/settingsNav';

/**
 * Desktop: section sidebar + content. Phone: /settings is a list of sections and each
 * section opens full screen with a back link (the usual mobile settings pattern).
 */
export default function SettingsLayout({ children }: LayoutProps<'/settings'>) {
  const path = usePathname();
  const current = SETTINGS_SECTIONS.find(i => path.startsWith(i.href));
  return (
    <div className="page">
      <header className="page-head settings-head">
        <div>
          {current && <Link href="/settings" className="back-link sheet-only"><ChevronLeft size={18} />{m.settings.title}</Link>}
          <h1>
            <span className="desk-only">{m.settings.title}</span>
            <span className="sheet-only">{current ? current.label : m.settings.title}</span>
          </h1>
        </div>
      </header>
      <div className="settings">
        <nav className="subnav" aria-label={m.settings.title}>
          {SETTINGS_SECTIONS.map(i => (
            <Link key={i.href} href={i.href} aria-current={path.startsWith(i.href) ? 'page' : undefined}>
              <i.icon size={16} strokeWidth={1.6} />{i.label}
            </Link>
          ))}
        </nav>
        <div className="settings-content">{children}</div>
      </div>
    </div>
  );
}

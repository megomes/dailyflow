'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardCheck, LayoutTemplate, Layers, MonitorSmartphone } from 'lucide-react';
import { m } from '@/i18n/en';

const ITEMS = [
  { href: '/settings/templates', label: m.templates.title, icon: LayoutTemplate },
  { href: '/settings/areas', label: m.areas.title, icon: Layers },
  { href: '/settings/validation', label: m.validation.title, icon: ClipboardCheck },
  { href: '/settings/device', label: m.device.title, icon: MonitorSmartphone },
];

export default function SettingsLayout({ children }: LayoutProps<'/settings'>) {
  const path = usePathname();
  return (
    <div className="page">
      <header className="page-head"><h1>{m.settings.title}</h1></header>
      <div className="settings">
        <nav className="subnav" aria-label={m.settings.title}>
          {ITEMS.map(i => (
            <Link key={i.href} href={i.href} aria-current={path.startsWith(i.href) ? 'page' : undefined}>
              <i.icon size={16} strokeWidth={1.6} />{i.label}
            </Link>
          ))}
        </nav>
        <div>{children}</div>
      </div>
    </div>
  );
}

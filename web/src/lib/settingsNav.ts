import { CalendarDays, ClipboardCheck, LayoutTemplate, Layers, MonitorSmartphone, Moon, SlidersHorizontal } from 'lucide-react';
import { m } from '@/i18n/en';

/** Settings sections: sidebar on desktop, a drill-down list on phones. */
export const SETTINGS_SECTIONS = [
  { href: '/settings/templates', label: m.templates.title, hint: m.settings.hints.templates, icon: LayoutTemplate },
  { href: '/settings/areas', label: m.areas.title, hint: m.settings.hints.areas, icon: Layers },
  { href: '/settings/calendars', label: m.calendars.title, hint: m.calendars.hint, icon: CalendarDays },
  { href: '/settings/sleep', label: m.sleep.settingsTitle, hint: m.sleep.settingsHint, icon: Moon },
  { href: '/settings/preferences', label: m.prefs.title, hint: m.prefs.hint, icon: SlidersHorizontal },
  { href: '/settings/validation', label: m.validation.title, hint: m.settings.hints.validation, icon: ClipboardCheck },
  { href: '/settings/device', label: m.device.title, hint: m.settings.hints.device, icon: MonitorSmartphone },
];

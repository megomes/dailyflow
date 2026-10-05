import type { Metadata } from 'next';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = { title: 'DailyFlow · Now' };

/** The desktop companion's floating window (note #20): the app's data and actions, no sidebar. */
export default function MiniLayout({ children }: LayoutProps<'/'>) {
  return <Providers>{children}</Providers>;
}

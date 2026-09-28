import { AppShell } from '@/components/AppShell';
import { Providers } from '@/components/Providers';

export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <Providers>
      <AppShell>{children}</AppShell>
    </Providers>
  );
}

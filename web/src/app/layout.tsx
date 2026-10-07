import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: 'DailyFlow',
  description: 'Curate your day.',
  applicationName: 'DailyFlow',
  appleWebApp: { capable: true, title: 'DailyFlow', statusBarStyle: 'black-translucent' },
  icons: { apple: '/apple-touch-icon.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // The keyboard shrinks the layout, so sheets and inputs stay above it (note #31).
  interactiveWidget: 'resizes-content',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0B0D12' },
    { media: '(prefers-color-scheme: light)', color: '#F6F6F7' },
  ],
};

/** Applies the saved theme before the first paint (no light/dark flash). Dark is the default. */
const themeScript = `try{var t=localStorage.getItem('df-theme');document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark')}catch(e){document.documentElement.setAttribute('data-theme','dark')}if(window.ReactNativeWebView)document.documentElement.classList.add('in-app')`;

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={inter.variable} data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

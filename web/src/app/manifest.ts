import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'DailyFlow',
    short_name: 'DailyFlow',
    description: 'Curate your day.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#141416',
    theme_color: '#141416',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}

import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/config';
import { verifySession } from '@/lib/session';

/** Optimistic gate: pages redirect to /login and APIs answer 401 without a valid device session. */
export async function proxy(req: NextRequest) {
  const bearer = req.headers.get('authorization')?.startsWith('Bearer ') ? req.headers.get('authorization')!.slice(7).trim() : undefined;
  const ok = (await verifySession(req.cookies.get(SESSION_COOKIE)?.value, process.env.SESSION_SECRET))
    || (bearer && req.nextUrl.pathname.startsWith('/api/') && (await verifySession(bearer, process.env.SESSION_SECRET)));
  if (ok) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith('/api/')) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const url = req.nextUrl.clone();
  // Come back here after signing in (the desktop companion opens /mini).
  const next = req.nextUrl.pathname !== '/' ? req.nextUrl.pathname : '';
  url.pathname = '/login';
  url.search = next ? `?next=${encodeURIComponent(next)}` : '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!login|about|privacy|terms|brand/|api/auth|api/health|api/devices/claim|_next/static|_next/image|sw.js|manifest.webmanifest|icon|apple-touch-icon|favicon).*)'],
};

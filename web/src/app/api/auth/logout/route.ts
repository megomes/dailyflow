import { cookies } from 'next/headers';
import { DEVICE_COOKIE, SESSION_COOKIE } from '@/lib/config';

export async function POST() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(DEVICE_COOKIE);
  return Response.json({ ok: true });
}

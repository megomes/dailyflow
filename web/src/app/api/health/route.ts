import { sql } from '@/lib/server';

/** Public liveness check: app is up and the database answers. Exposes nothing else. */
export async function GET() {
  const started = Date.now();
  try {
    await sql().query('select 1');
    return Response.json({ ok: true, db: true, ms: Date.now() - started });
  } catch {
    return Response.json({ ok: false, db: false }, { status: 503 });
  }
}

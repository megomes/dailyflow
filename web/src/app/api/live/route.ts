import { liveConfig } from '@/lib/push';
import { requireDevice, unauthorized } from '@/lib/server';

/** GET /api/live — where an open app listens for “something changed”, and who it is (to skip its own changes). */
export async function GET() {
  const deviceId = await requireDevice();
  if (!deviceId) return unauthorized();
  const live = liveConfig();
  return Response.json(live ? { ...live, deviceId } : { url: null, channel: null, deviceId });
}

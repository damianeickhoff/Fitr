import { db } from "@/lib/db";
import { buildVersion } from "@/lib/version";

/**
 * For the container's HEALTHCHECK, so outside the sign-in gate. It touches the
 * database because the likely failure is the SQLite file becoming unreadable
 * (a reset permission, an empty volume), which leaves the process up and every
 * page broken. `SELECT 1` so a half-applied migration can't fake a dead instance.
 * 503, not 500: not ready rather than broken, which is what a proxy acts on.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ ok: true, version: buildVersion() });
  } catch (error) {
    console.error("Health check failed", error);
    return Response.json({ ok: false }, { status: 503 });
  }
}

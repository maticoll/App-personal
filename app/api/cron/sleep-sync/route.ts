// ============================================================
// GET /api/cron/sleep-sync
// Cron diario — sync automático de sueño con Garmin
// Schedule: 0 8 * * * (8:00 AM todos los días)
// Protección: Authorization: Bearer $CRON_SECRET
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncGarminSleepRange } from "@/lib/garmin";
import { verifyCronSecret } from "@/lib/cron";

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const results: Array<{
    userId: string;
    synced: number;
    errors: number;
    skipped: number;
  }> = [];

  try {
    const usersWithGarmin = await db.userSettings.findMany({
      where: {
        garminSessionKey: { not: null },
        garminSessionExp: { gt: new Date() },
      },
      select: { userId: true },
    });

    for (const { userId } of usersWithGarmin) {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 2);

      try {
        const result = await syncGarminSleepRange(userId, from, to);
        results.push({ userId, ...result });
      } catch (err) {
        console.error(`[sleep-sync cron] Error para userId ${userId}:`, err);
        results.push({ userId, synced: 0, errors: 1, skipped: 0 });
      }
    }

    console.log("[sleep-sync cron] Completado:", results);
    return NextResponse.json({
      ok: true,
      message: `Sync completado — ${usersWithGarmin.length} usuarios procesados`,
      results,
    });
  } catch (error) {
    console.error("[sleep-sync cron] Error general:", error);
    return NextResponse.json(
      { ok: false, error: "Error en cron de sleep sync" },
      { status: 500 }
    );
  }
}

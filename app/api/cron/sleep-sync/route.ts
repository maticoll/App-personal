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
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    logger.warn("cron/sleep-sync", { event: "unauthorized" });
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const start = Date.now();
  logger.info("cron/sleep-sync", { event: "start" });

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
        logger.error("cron/sleep-sync", { event: "user_error", userId, error: String(err) });
        results.push({ userId, synced: 0, errors: 1, skipped: 0 });
      }
    }

    const totalSynced = results.reduce((a, r) => a + r.synced, 0);
    const totalErrors = results.reduce((a, r) => a + r.errors, 0);
    logger.info("cron/sleep-sync", {
      event: "complete",
      users: usersWithGarmin.length,
      totalSynced,
      totalErrors,
      durationMs: Date.now() - start,
    });

    return NextResponse.json({
      ok: true,
      message: `Sync completado — ${usersWithGarmin.length} usuarios procesados`,
      results,
    });
  } catch (error) {
    logger.error("cron/sleep-sync", { event: "error", error: String(error), durationMs: Date.now() - start });
    return NextResponse.json(
      { ok: false, error: "Error en cron de sleep sync" },
      { status: 500 }
    );
  }
}

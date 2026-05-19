// ============================================================
// GET /api/cron/fitness-sync
// Cron diario — sincroniza actividades de Garmin
// Schedule: 0 6 * * * (6:00 AM todos los días)
// Protección: Authorization: Bearer $CRON_SECRET o x-cron-secret: $CRON_SECRET
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fetchGarminActivities } from "@/lib/garmin";
import { upsertWorkoutFromGarmin } from "@/lib/fitness";
import { verifyCronSecret } from "@/lib/cron";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    logger.warn("cron/fitness-sync", { event: "unauthorized" });
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const start = Date.now();
  logger.info("cron/fitness-sync", { event: "start" });

  try {
    const users = await db.userSettings.findMany({
      where: { garminSessionKey: { not: null } },
      select: { userId: true },
    });

    const results = [];

    for (const { userId } of users) {
      let synced = 0;
      let errors = 0;

      for (let i = 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];

        try {
          const activities = await fetchGarminActivities(userId, dateStr);
          for (const activity of activities) {
            await upsertWorkoutFromGarmin(userId, activity);
            synced++;
          }
        } catch (err) {
          logger.error("cron/fitness-sync", { event: "user_error", userId, date: dateStr, error: String(err) });
          errors++;
        }

        if (i > 0) await new Promise((r) => setTimeout(r, 500));
      }

      results.push({ userId, synced, errors });
    }

    const totalSynced = results.reduce((sum, r) => sum + r.synced, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
    logger.info("cron/fitness-sync", { event: "complete", users: users.length, totalSynced, totalErrors, durationMs: Date.now() - start });

    return NextResponse.json({
      ok: true,
      message: `${totalSynced} actividades sincronizadas en ${users.length} usuarios`,
      results,
    });
  } catch (err) {
    logger.error("cron/fitness-sync", { event: "error", error: String(err), durationMs: Date.now() - start });
    return NextResponse.json({ ok: false, error: "Error en cron de fitness sync" }, { status: 500 });
  }
}

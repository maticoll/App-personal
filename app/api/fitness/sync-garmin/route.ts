// POST /api/fitness/sync-garmin
// Sync manual de actividades de Garmin Connect
// Body: { days?: number }  — default: 2 días hacia atrás

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { fetchGarminActivities, fetchGarminDailySteps } from "@/lib/garmin";
import { upsertWorkoutFromGarmin, upsertDailySteps } from "@/lib/fitness";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const daysBack = Math.min(parseInt(body.days ?? "2", 10), 14);

    const userId = session.user.id;
    let synced = 0;
    let errors = 0;
    let skipped = 0;

    for (let i = daysBack - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];

      try {
        const activities = await fetchGarminActivities(userId, dateStr);
        for (const activity of activities) {
          await upsertWorkoutFromGarmin(userId, activity);
          synced++;
        }

        // Pasos diarios (total del día) — independiente de las actividades
        try {
          const daily = await fetchGarminDailySteps(userId, dateStr);
          if (daily) await upsertDailySteps(userId, dateStr, daily.totalSteps);
        } catch (stepErr) {
          console.error(`Error sync Garmin steps ${dateStr}:`, stepErr);
        }

        if (activities.length === 0) skipped++;
      } catch (err) {
        console.error(`Error sync Garmin activities ${dateStr}:`, err);
        errors++;
      }

      // Rate limiting (ser respetuoso con la API de Garmin)
      if (i > 0) await new Promise((r) => setTimeout(r, 300));
    }

    return NextResponse.json({
      success: true,
      synced,
      errors,
      skipped,
      message: `Sync completado: ${synced} actividades importadas`,
    });
  } catch (err) {
    console.error("[POST /api/fitness/sync-garmin]", err);
    const message =
      err instanceof Error ? err.message : "Error al sincronizar con Garmin";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

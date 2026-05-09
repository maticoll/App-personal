// GET /api/cron/fitness-sync
// Cron job diario a las 6 AM — sincroniza actividades de Garmin de los últimos 2 días
// Protegido con Authorization: Bearer $CRON_SECRET
// Configurado en vercel.json: { "path": "/api/cron/fitness-sync", "schedule": "0 6 * * *" }

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fetchGarminActivities } from "@/lib/garmin";
import { upsertWorkoutFromGarmin } from "@/lib/fitness";

export async function GET(req: NextRequest) {
  // Verificar CRON_SECRET
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    // Encontrar todos los usuarios con Garmin configurado
    const users = await db.userSettings.findMany({
      where: {
        garminSessionKey: { not: null },
      },
      select: { userId: true },
    });

    const results = [];

    for (const { userId } of users) {
      let synced = 0;
      let errors = 0;

      // Sincronizar los últimos 2 días
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
          console.error(
            `[fitness-sync] Error userId=${userId} date=${dateStr}:`,
            err
          );
          errors++;
        }

        if (i > 0) await new Promise((r) => setTimeout(r, 500));
      }

      results.push({ userId, synced, errors });
    }

    const totalSynced = results.reduce((sum, r) => sum + r.synced, 0);
    console.log(
      `[fitness-sync] Completado: ${totalSynced} actividades en ${users.length} usuarios`
    );

    return NextResponse.json({
      success: true,
      users: users.length,
      totalSynced,
      results,
    });
  } catch (err) {
    console.error("[/api/cron/fitness-sync]", err);
    return NextResponse.json({ error: "Error en cron" }, { status: 500 });
  }
}

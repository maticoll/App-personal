// ============================================================
// GET /api/cron/sleep-sync
// Cron diario — sync automático de sueño con Garmin
// Schedule: 0 8 * * * (8:00 AM todos los días)
//
// PROTECCIÓN: header Authorization: Bearer $CRON_SECRET
// Configurar CRON_SECRET en Vercel Environment Variables
// y en vercel.json → crons → path
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncGarminSleepRange } from "@/lib/garmin";

export async function GET(req: NextRequest) {
  // Verificar CRON_SECRET para que solo Vercel Cron pueda llamar este endpoint
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const results: Array<{
    userId: string;
    synced: number;
    errors: number;
    skipped: number;
  }> = [];

  try {
    // Obtener todos los usuarios que tienen Garmin configurado
    const usersWithGarmin = await db.userSettings.findMany({
      where: {
        garminSessionKey: { not: null },
        garminSessionExp: { gt: new Date() },
      },
      select: { userId: true },
    });

    // Sincronizar los últimos 2 días (para capturar cualquier dato retrasado)
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
      success: true,
      users: usersWithGarmin.length,
      results,
    });
  } catch (error) {
    console.error("[sleep-sync cron] Error general:", error);
    return NextResponse.json(
      { error: "Error en cron de sleep sync" },
      { status: 500 }
    );
  }
}

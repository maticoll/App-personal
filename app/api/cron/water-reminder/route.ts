// ============================================================
// GET /api/cron/water-reminder
// Recordatorio de hidratación — mediodía y tarde
// NO está en vercel.json (necesita correr 2 veces/día)
// Configurado en cron-job.org — ver CRON_SETUP.md
//   - 12:00 hs: 0 12 * * *
//   - 17:00 hs: 0 17 * * *
// Protección: Authorization: Bearer $CRON_SECRET o ?secret=$CRON_SECRET
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyCronSecret } from "@/lib/cron";
import { sendTemplateMessage } from "@/lib/whatsapp";
import { startOfDay } from "date-fns";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    logger.warn("cron/water-reminder", { event: "unauthorized" });
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  logger.info("cron/water-reminder", { event: "start" });
  const sent: string[] = [];
  const errors: string[] = [];

  try {
    const users = await db.userSettings.findMany({
      where: { notificationsEnabled: true },
      select: { userId: true, whatsappNumber: true, dailyWaterGoalThermos: true },
    });

    const today = startOfDay(new Date());

    for (const user of users) {
      if (!user.whatsappNumber) continue;

      // Calcular agua consumida hoy
      const waterLogs = await db.waterLog.findMany({
        where: { userId: user.userId, date: today },
      });
      const totalThermos = waterLogs.reduce((acc: number, w: { thermos: number }) => acc + w.thermos, 0);
      const goal = user.dailyWaterGoalThermos ?? 1.0;

      // Si ya cumplió la meta, no molestar
      if (totalThermos >= goal) continue;

      const remaining = (goal - totalThermos).toFixed(1);

      // Template: {{1}} termos actuales, {{2}} meta, {{3}} restantes
      try {
        // Template "water": {{1}} termos actuales, {{2}} meta (sin variable de restantes)
        await sendTemplateMessage(user.whatsappNumber, "water", [
          { type: "text", text: totalThermos.toFixed(1) },
          { type: "text", text: goal.toFixed(1) },
        ]);
        sent.push(user.userId);
        logger.info("cron/water-reminder", { event: "sent", userId: user.userId, totalThermos, goal });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        errors.push(`${user.userId} → ${errMsg}`);
        logger.error("cron/water-reminder", { event: "send_error", userId: user.userId, error: errMsg });
      }
    }

    logger.info("cron/water-reminder", { event: "complete", sent: sent.length, errors: errors.length });
    return NextResponse.json({
      ok: true,
      message: `${sent.length} recordatorios enviados de ${users.length} usuarios`,
      sent,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    logger.error("cron/water-reminder", { event: "error", error: String(err) });
    return NextResponse.json({ ok: false, error: "Error en cron de water reminder" }, { status: 500 });
  }
}

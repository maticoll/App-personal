// ============================================================
// GET /api/cron/sleep-notifications
// Cron diario — recordatorios y alertas de sueño vía WhatsApp
// Schedule vercel.json: 0 22 * * * (22:00 hs todos los días)
// Para mayor frecuencia configurar en cron-job.org
// Protección: Authorization: Bearer $CRON_SECRET o ?secret=$CRON_SECRET
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyCronSecret } from "@/lib/cron";
import { sendTemplateMessage } from "@/lib/whatsapp";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    logger.warn("cron/sleep-notifications", { event: "unauthorized" });
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  logger.info("cron/sleep-notifications", { event: "start" });
  const now = new Date();
  const sent: string[] = [];
  const errors: string[] = [];

  try {
    const users = await db.userSettings.findMany({
      where: { notificationsEnabled: true },
      select: {
        userId: true,
        expectedSleepTime: true,
        expectedWakeTime: true,
        whatsappNumber: true,
      },
    });

    const debug: Record<string, unknown>[] = [];

    for (const user of users) {
      if (!user.whatsappNumber) continue;

      const notifications: Array<{ type: "bedtime_reminder" }> = [];
      const userDebug: Record<string, unknown> = { userId: user.userId };

      // --- Notificación 1: Recordatorio de dormir ---
      if (user.expectedSleepTime) {
        const [hours, minutes] = user.expectedSleepTime.split(":").map(Number);

        // Comparar en hora de Uruguay (UTC-3) para que "23:00" sea 23:00 UY
        const nowUY = new Date(now.toLocaleString("en-US", { timeZone: "America/Montevideo" }));
        const expectedTime = new Date(nowUY);
        expectedTime.setHours(hours, minutes, 0, 0);

        const diffMs = expectedTime.getTime() - nowUY.getTime();
        const diffMin = Math.round(diffMs / (1000 * 60));

        userDebug.nowUY = nowUY.toTimeString().slice(0, 5);
        userDebug.expectedSleepTime = user.expectedSleepTime;
        userDebug.diffMin = diffMin;
        userDebug.inWindow = diffMin >= 0 && diffMin <= 15;

        // Avisar en la ventana de 0–15 min antes de la hora esperada
        if (diffMin >= 0 && diffMin <= 15) {
          const hasTodaySleep = await db.sleepLog.findFirst({
            where: {
              userId: user.userId,
              bedTime: { gte: new Date(Date.now() - 4 * 60 * 60 * 1000) },
            },
          });

          userDebug.hasTodaySleep = !!hasTodaySleep;
          if (!hasTodaySleep) {
            notifications.push({ type: "bedtime_reminder" });
          }
        }
      }

      debug.push(userDebug);


      // --- Enviar notificaciones por WhatsApp usando templates aprobados ---
      for (const notification of notifications) {
        try {
          if (notification.type === "bedtime_reminder") {
            await sendTemplateMessage(user.whatsappNumber, "bedtime", [
              { type: "text", text: user.expectedSleepTime ?? "tu hora configurada" },
            ]);
            sent.push(`${user.userId}:bedtime_reminder`);
            console.log(`[sleep-notifications] Enviado bedtime_reminder a userId=${user.userId}`);
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          errors.push(`${user.userId}:${notification.type} → ${errMsg}`);
          logger.error("cron/sleep-notifications", { event: "send_error", userId: user.userId, type: notification.type, error: errMsg });
        }
      }
    }

    logger.info("cron/sleep-notifications", { event: "complete", sent: sent.length, errors: errors.length });

    return NextResponse.json({
      ok: true,
      sent: sent.length,
      errors: errors.length > 0 ? errors : undefined,
      detail: sent,
      debug,
    });
  } catch (error) {
    logger.error("cron/sleep-notifications", { event: "error", error: String(error) });
    return NextResponse.json(
      { ok: false, error: "Error en cron de notificaciones" },
      { status: 500 }
    );
  }
}

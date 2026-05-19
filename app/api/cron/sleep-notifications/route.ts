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

    for (const user of users) {
      if (!user.whatsappNumber) continue;

      const notifications: Array<{ type: "bedtime_reminder" | "wakeup_alert" }> = [];

      // --- Notificación 1: Recordatorio de dormir ---
      if (user.expectedSleepTime) {
        const [hours, minutes] = user.expectedSleepTime.split(":").map(Number);
        const expectedTime = new Date(now);
        expectedTime.setHours(hours, minutes, 0, 0);

        const diffMs = expectedTime.getTime() - now.getTime();
        const diffMin = diffMs / (1000 * 60);

        // Avisar en la ventana de 0–15 min antes de la hora esperada
        if (diffMin >= 0 && diffMin <= 15) {
          const hasTodaySleep = await db.sleepLog.findFirst({
            where: {
              userId: user.userId,
              bedTime: { gte: new Date(Date.now() - 4 * 60 * 60 * 1000) },
            },
          });

          if (!hasTodaySleep) {
            notifications.push({ type: "bedtime_reminder" });
          }
        }
      }

      // --- Notificación 2: Despertar no registrado ---
      if (now.getHours() >= 7) {
        const cutoff = new Date(now);
        cutoff.setHours(0, 0, 0, 0);

        const pendingSleep = await db.sleepLog.findFirst({
          where: {
            userId: user.userId,
            wakeTime: null,
            flexible: false,
            bedTime: { lt: cutoff },
          },
          orderBy: { bedTime: "desc" },
        });

        if (pendingSleep) {
          notifications.push({ type: "wakeup_alert" });
        }
      }

      // --- Enviar notificaciones por WhatsApp usando templates aprobados ---
      for (const notification of notifications) {
        try {
          if (notification.type === "bedtime_reminder") {
            // {{1}} = hora esperada de sueño (ej: "23:00")
            await sendTemplateMessage(user.whatsappNumber, "bedtime_reminder", [
              { type: "text", text: user.expectedSleepTime ?? "tu hora configurada" },
            ]);
          } else if (notification.type === "wakeup_alert") {
            // Sin variables — template estático
            await sendTemplateMessage(user.whatsappNumber, "wakeup_alert");
          }
          sent.push(`${user.userId}:${notification.type}`);
          console.log(`[sleep-notifications] Enviado ${notification.type} a userId=${user.userId}`);
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
    });
  } catch (error) {
    logger.error("cron/sleep-notifications", { event: "error", error: String(error) });
    return NextResponse.json(
      { ok: false, error: "Error en cron de notificaciones" },
      { status: 500 }
    );
  }
}

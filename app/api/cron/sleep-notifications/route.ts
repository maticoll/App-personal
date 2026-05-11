// ============================================================
// GET /api/cron/sleep-notifications
// Cron diario — recordatorios y alertas de sueño
// Schedule vercel.json: 0 22 * * * (22:00 hs todos los días)
// Para mayor frecuencia configurar en cron-job.org (ver CRON_SETUP.md)
// Protección: Authorization: Bearer $CRON_SECRET o x-cron-secret: $CRON_SECRET
//
// TODO: Sesión 8 — conectar con WhatsApp orquestrador para enviar los mensajes
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyCronSecret } from "@/lib/cron";

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const now = new Date();
  const notifications: Array<{
    userId: string;
    type: string;
    message: string;
  }> = [];

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
      // --- Notificación 1: Recordatorio de dormir ---
      if (user.expectedSleepTime) {
        const [hours, minutes] = user.expectedSleepTime.split(":").map(Number);
        const expectedTime = new Date(now);
        expectedTime.setHours(hours, minutes, 0, 0);

        const diffMs = expectedTime.getTime() - now.getTime();
        const diffMin = diffMs / (1000 * 60);

        if (diffMin >= 0 && diffMin <= 15) {
          const hasTodaySleep = await db.sleepLog.findFirst({
            where: {
              userId: user.userId,
              bedTime: { gte: new Date(Date.now() - 4 * 60 * 60 * 1000) },
            },
          });

          if (!hasTodaySleep) {
            notifications.push({
              userId: user.userId,
              type: "bedtime_reminder",
              message: `🌙 Es casi hora de dormir (${user.expectedSleepTime}). Que descanses bien!`,
            });
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
          notifications.push({
            userId: user.userId,
            type: "wake_reminder",
            message: `☀️ Buenos días! No olvidés registrar que te despertaste para completar tu sueño de anoche.`,
          });
        }
      }
    }

    // TODO: Sesión 8 — iterar notifications y enviar via orquestrador WhatsApp

    console.log(`[sleep-notifications cron] ${notifications.length} notificaciones generadas`);
    return NextResponse.json({
      ok: true,
      message: `${notifications.length} notificaciones generadas`,
      notifications,
    });
  } catch (error) {
    console.error("[sleep-notifications cron] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Error en cron de notificaciones" },
      { status: 500 }
    );
  }
}

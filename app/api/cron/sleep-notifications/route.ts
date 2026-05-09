// ============================================================
// GET /api/cron/sleep-notifications
// Cron de notificaciones de sueño — recordatorios y alertas
// Schedule: */30 20-23 * * * (cada 30min de 8 PM a 11:30 PM)
//
// Notificaciones enviadas:
//   1. Recordatorio de hora de dormir (si settings.expectedSleepTime está configurado)
//   2. Alerta de despertar no registrado (si hay bedTime sin wakeTime después de las 7 AM)
//
// TODO: Sesión 8 — conectar con WhatsApp orquestrador para enviar los mensajes
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const now = new Date();
  const notifications: Array<{
    userId: string;
    type: string;
    message: string;
  }> = [];

  try {
    // Obtener usuarios con notificaciones habilitadas
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

        // Enviar si estamos dentro de los 15 min antes de la hora esperada
        const diffMs = expectedTime.getTime() - now.getTime();
        const diffMin = diffMs / (1000 * 60);

        if (diffMin >= 0 && diffMin <= 15) {
          // Verificar que no se haya dormido ya hoy
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);

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
      // Si son pasadas las 7 AM y hay un bedTime sin wakeTime de la noche anterior
      if (now.getHours() >= 7) {
        const cutoff = new Date(now);
        cutoff.setHours(0, 0, 0, 0); // inicio del día de hoy

        const pendingSleep = await db.sleepLog.findFirst({
          where: {
            userId: user.userId,
            wakeTime: null,
            flexible: false,
            bedTime: {
              lt: cutoff, // bedTime fue antes de hoy (anoche)
            },
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
    // for (const n of notifications) {
    //   await orchestrator.sendNotification(n.userId, n.message);
    // }

    console.log(`[sleep-notifications cron] ${notifications.length} notificaciones generadas`);
    return NextResponse.json({
      success: true,
      notifications,
      note: "Las notificaciones están listas. Se conectarán al WhatsApp orquestrador en Sesión 8.",
    });
  } catch (error) {
    console.error("[sleep-notifications cron] Error:", error);
    return NextResponse.json(
      { error: "Error en cron de notificaciones" },
      { status: 500 }
    );
  }
}

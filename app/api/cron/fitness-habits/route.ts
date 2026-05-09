// GET /api/cron/fitness-habits
// Cron job diario a las 7:10 AM — detecta si el usuario no fue al gym en día de gym
// Genera notificación proactiva (log + TODO para WhatsApp en Sesión 8)
//
// Protegido con Authorization: Bearer $CRON_SECRET
// Configurado en vercel.json: { "path": "/api/cron/fitness-habits", "schedule": "10 7 * * *" }

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkSmartHabitDeviation } from "@/lib/fitness";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    // Buscar usuarios con gymDays configurados
    const users = await db.userSettings.findMany({
      where: {
        gymDays: { isEmpty: false },
        notificationsEnabled: true,
      },
      select: { userId: true },
    });

    const notifications = [];

    for (const { userId } of users) {
      const status = await checkSmartHabitDeviation(userId);
      if (status.shouldNotify) {
        console.log(
          `[fitness-habits] Desvío detectado para userId=${userId}: ${status.message}`
        );

        // TODO: Sesión 7 — Calendar: consultar huecos libres y proponer reagendado
        // TODO: Sesión 8 — WhatsApp: enviar notificación via orquestrador
        // Ej: `await orchestratorAgent.sendProactiveMessage(userId, {
        //   module: "fitness",
        //   message: status.message,
        //   action: "reschedule_gym"
        // })`

        notifications.push({
          userId,
          message: status.message,
          expectedGymTime: status.expectedGymTime,
          pending: "whatsapp_notification",
        });
      }
    }

    if (notifications.length > 0) {
      console.log(
        `[fitness-habits] ${notifications.length} notificaciones pendientes (WhatsApp: Sesión 8)`
      );
    }

    return NextResponse.json({
      success: true,
      checked: users.length,
      deviations: notifications.length,
      notifications,
    });
  } catch (err) {
    console.error("[/api/cron/fitness-habits]", err);
    return NextResponse.json({ error: "Error en cron" }, { status: 500 });
  }
}

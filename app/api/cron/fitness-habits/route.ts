// ============================================================
// GET /api/cron/fitness-habits
// Cron diario — detecta si el usuario no fue al gym en día de gym
// Schedule: 10 7 * * * (7:10 AM todos los días)
// Protección: Authorization: Bearer $CRON_SECRET o x-cron-secret: $CRON_SECRET
//
// TODO: Sesión 8 — conectar con WhatsApp orquestrador
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkSmartHabitDeviation } from "@/lib/fitness";
import { verifyCronSecret } from "@/lib/cron";

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  try {
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
        console.log(`[fitness-habits] Desvío detectado para userId=${userId}: ${status.message}`);

        // TODO: Sesión 7 — Calendar: consultar huecos libres y proponer reagendado
        // TODO: Sesión 8 — WhatsApp: enviar notificación via orquestrador

        notifications.push({
          userId,
          message: status.message,
          expectedGymTime: status.expectedGymTime,
          pending: "whatsapp_notification",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      message: `${users.length} usuarios revisados — ${notifications.length} desvíos detectados`,
      notifications,
    });
  } catch (err) {
    console.error("[fitness-habits cron] Error:", err);
    return NextResponse.json({ ok: false, error: "Error en cron de fitness habits" }, { status: 500 });
  }
}

// ============================================================
// GET /api/cron/water-reminder
// Recordatorio de hidratación — mediodía y tarde
// NO está en vercel.json (necesita correr 2 veces/día)
// Configurado en cron-job.org — ver CRON_SETUP.md
//   - 12:00 hs: 0 12 * * *
//   - 17:00 hs: 0 17 * * *
// Protección: x-cron-secret: $CRON_SECRET
//
// TODO: Sesión 8 — conectar con WhatsApp orquestrador
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getWaterReminderText } from "@/lib/nutrition";
import { verifyCronSecret } from "@/lib/cron";

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const reminders: Array<{ userId: string; message: string }> = [];

  try {
    const users = await db.userSettings.findMany({
      where: { notificationsEnabled: true },
      select: { userId: true, whatsappNumber: true },
    });

    for (const user of users) {
      const message = await getWaterReminderText(user.userId);
      if (message) {
        reminders.push({ userId: user.userId, message });
        // TODO: Sesión 8 — enviar via orquestrador de WhatsApp
      }
    }

    return NextResponse.json({
      ok: true,
      message: `${reminders.length} recordatorios generados de ${users.length} usuarios`,
      reminders,
    });
  } catch (err) {
    console.error("[water-reminder cron] Error:", err);
    return NextResponse.json({ ok: false, error: "Error en cron de water reminder" }, { status: 500 });
  }
}

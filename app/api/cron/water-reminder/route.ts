// ============================================================
// GET /api/cron/water-reminder
// Recordatorio de hidratación — medio día y tarde
// Schedule: 0 12,17 * * * (12 PM y 5 PM todos los días)
//
// TODO: Sesión 8 — conectar con WhatsApp orquestrador
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getWaterReminderText } from "@/lib/nutrition";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
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
        // await orchestrator.sendMessage(user.whatsappNumber, message)
      }
    }

    return NextResponse.json({
      ok: true,
      checked: users.length,
      remindersSent: reminders.length,
      reminders,
    });
  } catch (err) {
    console.error("[cron/water-reminder] Error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

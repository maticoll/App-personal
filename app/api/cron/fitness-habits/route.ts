// ============================================================
// GET /api/cron/fitness-habits
// Cron diario — detecta si el usuario no fue al gym en día de gym
// Schedule: 10 7 * * * (7:10 AM todos los días)
// Protección: Authorization: Bearer $CRON_SECRET
//
// Flujo (smart habits):
//   1. Verifica usuarios con días de gym configurados
//   2. checkSmartHabitDeviation: ¿debería haber ido hoy y no hay registro?
//   3. Si hay desvío → consulta Google Calendar para buscar huecos libres
//   4. Envía notificación WhatsApp proponiendo el mejor hueco disponible
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkSmartHabitDeviation } from "@/lib/fitness";
import { verifyCronSecret } from "@/lib/cron";
import { findFreeSlots } from "@/lib/calendar";
import { sendTextMessage } from "@/lib/whatsapp";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(date: Date): string {
  return date.toLocaleTimeString("es-UY", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Montevideo",
  });
}

// ─── Handler ─────────────────────────────────────────────────────────────────

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
      select: {
        userId: true,
        whatsappNumber: true,
        expectedGymTime: true,
      },
    });

    const notifications: Array<{
      userId: string;
      message: string;
      sentWhatsApp: boolean;
    }> = [];

    for (const user of users) {
      // 1. Verificar si hubo desvío del hábito de gym
      const status = await checkSmartHabitDeviation(user.userId);
      if (!status.shouldNotify) continue;

      console.log(`[fitness-habits] Desvío para userId=${user.userId}: ${status.message}`);

      // 2. Buscar huecos libres en Google Calendar para hoy (90 min de gym)
      const today = new Date();
      let suggestionText = "";

      try {
        const freeSlots = await findFreeSlots(user.userId, today, 90);

        if (freeSlots.length > 0) {
          const bestSlot = freeSlots[0];
          const slotStart = formatTime(bestSlot.start);
          const slotEnd = formatTime(bestSlot.end);
          suggestionText =
            `\n\nTenés un hueco libre a las ${slotStart}-${slotEnd}. ` +
            `¿Querés que te lo agendo? Respondé "sí agendame" para confirmarlo.`;
        }
      } catch (calErr) {
        // Calendar no conectado o error — igualmente mandamos la notificación base
        console.warn(`[fitness-habits] No se pudo consultar Calendar para userId=${user.userId}:`, calErr);
      }

      // 3. Armar mensaje y enviar por WhatsApp
      const baseMessage =
        `💪 ${status.message}` + suggestionText;

      let sentWhatsApp = false;
      if (user.whatsappNumber) {
        try {
          await sendTextMessage(user.whatsappNumber, baseMessage);
          sentWhatsApp = true;
        } catch (waErr) {
          console.error(`[fitness-habits] Error enviando WhatsApp a userId=${user.userId}:`, waErr);
        }
      }

      notifications.push({
        userId: user.userId,
        message: baseMessage,
        sentWhatsApp,
      });
    }

    return NextResponse.json({
      ok: true,
      message: `${users.length} usuarios revisados — ${notifications.length} desvíos detectados`,
      notifications,
    });
  } catch (err) {
    console.error("[fitness-habits cron] Error:", err);
    return NextResponse.json(
      { ok: false, error: "Error en cron de fitness habits" },
      { status: 500 }
    );
  }
}

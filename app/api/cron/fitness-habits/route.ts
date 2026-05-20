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
import { sendTemplateMessage, sendTextMessage } from "@/lib/whatsapp";
import { logger } from "@/lib/logger";

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
    logger.warn("cron/fitness-habits", { event: "unauthorized" });
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  logger.info("cron/fitness-habits", { event: "start" });

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

      logger.info("cron/fitness-habits", { event: "deviation_detected", userId: user.userId });

      // 2. Buscar huecos libres en Google Calendar para hoy (90 min de gym)
      const today = new Date();
      let slotSuggestion: string | null = null;

      try {
        const freeSlots = await findFreeSlots(user.userId, today, 90);
        if (freeSlots.length > 0) {
          const bestSlot = freeSlots[0];
          slotSuggestion =
            `Tenés un hueco libre a las ${formatTime(bestSlot.start)}-${formatTime(bestSlot.end)}. ` +
            `¿Querés que te lo agendo?`;
        }
      } catch (calErr) {
        logger.warn("cron/fitness-habits", { event: "calendar_error", userId: user.userId, error: String(calErr) });
      }

      // 3. Enviar template aprobado + sugerencia de slot como texto libre
      let sentWhatsApp = false;
      if (user.whatsappNumber) {
        try {
          // Template con botón Quick Reply — abre ventana de 24hs
          // Template "gym" en inglés, sin variables, con botón Quick Reply
          await sendTemplateMessage(
            user.whatsappNumber,
            "gym",
            [],
            [{ type: "button", sub_type: "QUICK_REPLY", index: 0 }],
            "en"
          );

          // Si hay hueco en Calendar, mandarlo como texto libre dentro de la ventana abierta
          if (slotSuggestion) {
            await sendTextMessage(user.whatsappNumber, slotSuggestion);
          }

          sentWhatsApp = true;
        } catch (waErr) {
          logger.error("cron/fitness-habits", { event: "whatsapp_error", userId: user.userId, error: String(waErr) });
        }
      }

      notifications.push({
        userId: user.userId,
        message: slotSuggestion ?? "gym_habit_reminder template enviado",
        sentWhatsApp,
      });
    }

    logger.info("cron/fitness-habits", { event: "complete", users: users.length, deviations: notifications.length });
    return NextResponse.json({
      ok: true,
      message: `${users.length} usuarios revisados — ${notifications.length} desvíos detectados`,
      notifications,
    });
  } catch (err) {
    logger.error("cron/fitness-habits", { event: "error", error: String(err) });
    return NextResponse.json(
      { ok: false, error: "Error en cron de fitness habits" },
      { status: 500 }
    );
  }
}

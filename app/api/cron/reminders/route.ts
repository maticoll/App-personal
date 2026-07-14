// ============================================================
// GET /api/cron/reminders
// Cron de recordatorios — corre cada 15 minutos via cron-job.org
//
// Dos funciones:
//   1. Disparar recordatorios pendientes creados por el usuario
//      ("recordame en 2 horas que tengo dentista")
//   2. Alertar 2 horas antes de eventos de Google Calendar
//
// Protección: Authorization: Bearer $CRON_SECRET o ?secret=$CRON_SECRET
//
// Configurar en cron-job.org:
//   URL: https://app-personal-ten.vercel.app/api/cron/reminders?secret=TU_CRON_SECRET
//   Schedule: */15 * * * * (cada 15 minutos)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyCronSecret } from "@/lib/cron";
import { sendReminderTemplate } from "@/lib/whatsapp";
import {
  getDueReminders,
  markReminderSent,
  calendarReminderExists,
  createReminder,
  formatTimeLabel,
} from "@/lib/reminders";
import { getTodayEvents, getWeekEvents } from "@/lib/calendar";
import { logger } from "@/lib/logger";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Formatea Date a "HH:MM" en hora de Uruguay */
function fmtTime(date: Date): string {
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
    logger.warn("cron/reminders", { event: "unauthorized" });
    return NextResponse.json(
      { ok: false, error: "No autorizado" },
      { status: 401 },
    );
  }

  logger.info("cron/reminders", { event: "start" });

  const sent: string[] = [];
  const errors: string[] = [];

  // ──────────────────────────────────────────────────────────────
  // PARTE 1: Recordatorios manuales del usuario (tabla reminders)
  // Ventana: fireAt <= ahora + 5 min
  // ──────────────────────────────────────────────────────────────
  try {
    const dueReminders = await getDueReminders(5);

    for (const reminder of dueReminders) {
      const whatsapp = reminder.user.settings?.whatsappNumber;
      if (!whatsapp) continue;

      try {
        const timeLabel = formatTimeLabel(reminder.fireAt);
        await sendReminderTemplate(whatsapp, timeLabel, reminder.message);
        await markReminderSent(reminder.id);

        sent.push(`manual:${reminder.userId}:${reminder.message}`);
        logger.info("cron/reminders", {
          event: "sent_manual",
          userId: reminder.userId,
          message: reminder.message,
          fireAt: reminder.fireAt,
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        errors.push(`manual:${reminder.userId} → ${errMsg}`);
        logger.error("cron/reminders", {
          event: "error_manual",
          userId: reminder.userId,
          error: errMsg,
        });
      }
    }
  } catch (err) {
    logger.error("cron/reminders", {
      event: "error_part1",
      error: String(err),
    });
  }

  // ──────────────────────────────────────────────────────────────
  // PARTE 2: Alertas de Google Calendar (2 horas antes del evento)
  // Ventana: eventos que empiezan entre 1h50m y 2h10m desde ahora
  // ──────────────────────────────────────────────────────────────
  try {
    const usersWithCalendar = await db.userSettings.findMany({
      where: { notificationsEnabled: true },
      select: { userId: true, whatsappNumber: true },
    });

    const now = Date.now();
    const WINDOW_MIN_MS = (2 * 60 - 10) * 60 * 1000; // 1h50m
    const WINDOW_MAX_MS = (2 * 60 + 10) * 60 * 1000; // 2h10m

    for (const user of usersWithCalendar) {
      if (!user.whatsappNumber) continue;

      try {
        // Obtener eventos de hoy + mañana
        const [todayEvents, weekEvents] = await Promise.allSettled([
          getTodayEvents(user.userId),
          getWeekEvents(user.userId),
        ]);

        const allEvents = [
          ...(todayEvents.status === "fulfilled" ? todayEvents.value : []),
          ...(weekEvents.status === "fulfilled" ? weekEvents.value : []),
        ];

        // Deduplicar por id
        const uniqueEvents = Array.from(
          new Map(allEvents.map((e) => [e.id, e])).values(),
        );

        for (const event of uniqueEvents) {
          if (event.isAllDay) continue;

          const diff = event.start.getTime() - now;
          if (diff < WINDOW_MIN_MS || diff > WINDOW_MAX_MS) continue;

          // Generar externalId para deduplicar — incluye hora de inicio del evento
          const externalId = `cal:${event.id}_${event.start.toISOString()}`;

          const alreadySent = await calendarReminderExists(
            user.userId,
            externalId,
          );
          if (alreadySent) continue;

          // Registrar en DB (dedup) con sent=false — se marca sent DESPUÉS
          // de enviar; si se marcara antes y Meta fallara, el aviso se
          // perdería para siempre (mismo patrón send-then-mark de la Parte 1).
          const reminder = await db.reminder.create({
            data: {
              userId: user.userId,
              message: event.title,
              fireAt: event.start,
              externalId,
              sent: false,
            },
          });

          try {
            const timeLabel = formatTimeLabel(event.start);
            await sendReminderTemplate(
              user.whatsappNumber,
              timeLabel,
              event.title,
            );
          } catch (sendErr) {
            // Si el envío falla, borrar el registro de dedup para que el
            // próximo run (15 min) lo reintente.
            await db.reminder
              .delete({ where: { id: reminder.id } })
              .catch(() => {});
            throw sendErr;
          }

          await markReminderSent(reminder.id);

          sent.push(
            `calendar:${user.userId}:${event.title}@${fmtTime(event.start)}`,
          );
          logger.info("cron/reminders", {
            event: "sent_calendar",
            userId: user.userId,
            eventTitle: event.title,
            eventStart: event.start,
          });
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        errors.push(`calendar:${user.userId} → ${errMsg}`);
        logger.error("cron/reminders", {
          event: "error_calendar",
          userId: user.userId,
          error: errMsg,
        });
      }
    }
  } catch (err) {
    logger.error("cron/reminders", {
      event: "error_part2",
      error: String(err),
    });
  }

  logger.info("cron/reminders", {
    event: "complete",
    sent: sent.length,
    errors: errors.length,
  });

  return NextResponse.json({
    ok: true,
    sent: sent.length,
    detail: sent,
    errors: errors.length > 0 ? errors : undefined,
  });
}

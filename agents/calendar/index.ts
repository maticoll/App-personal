// ============================================================
// agents/calendar/index.ts — Agente de Google Calendar
// Responsabilidades:
//   - Responder consultas de agenda (hoy / semana)
//   - Crear eventos en Google Calendar
//   - Mover / actualizar eventos existentes
//   - Proveer contexto de agenda al orquestrador y al Morning Summary
//   - Buscar huecos libres para reagendado de gym (smart habits)
// ============================================================

import type { AgentInput, AgentOutput } from "@/lib/types";
import {
  getTodayEvents,
  getWeekEvents,
  createEvent,
  updateEvent,
  findEventByTitle,
  findFreeSlots,
  getTodayEventsText,
  getCalendarStatus,
  type CalendarEvent,
} from "@/lib/calendar";
import {
  createReminder,
  parseReminderRequest,
  formatTimeLabel,
} from "@/lib/reminders";
import { detectIntentAI } from "@/lib/nlp";
import { callClaude } from "@/lib/claude";

// ─── Tipos de intención ───────────────────────────────────────────────────────

type CalendarIntent =
  | "query_today"    // consultar agenda de hoy
  | "query_week"     // consultar agenda de la semana
  | "create_event"   // crear un evento en el calendario
  | "update_event"   // mover / cambiar hora de un evento existente
  | "remind_me"      // crear recordatorio personal ("recordame en X que...")
  | "status"         // verificar estado de conexión
  | "unknown";

// ─── Detección de intención con LLM ──────────────────────────────────────────

async function detectIntent(text: string): Promise<CalendarIntent> {
  const intent = await detectIntentAI(
    "Eres el agente de Google Calendar de una app personal.",
    {
      query_today:  "El usuario quiere saber qué tiene hoy en su agenda o calendario",
      query_week:   "El usuario quiere saber qué tiene esta semana o los próximos días",
      create_event: "El usuario quiere crear, agendar o agregar un evento nuevo al calendario",
      update_event: "El usuario quiere mover, cambiar la hora, reagendar o modificar un evento ya existente (palabras clave: movelo, cambialo, reagendalo, cambiale la hora, pasalo, re-agendar)",
      remind_me:    "El usuario quiere que se le recuerde algo en X tiempo o en determinado momento (palabras clave: recordame, avisame, acordame, remindme, recordatorio)",
      status:       "El usuario pregunta si el calendario está conectado o vinculado",
      unknown:      "Otro mensaje no relacionado al calendario",
    },
    text
  );
  return intent as CalendarIntent;
}

// ─── Parseo de evento nuevo desde texto ───────────────────────────────────────

/**
 * Usa Claude Haiku para extraer título, fecha y hora de un texto libre.
 * Siempre devuelve tiempos con offset -03:00 (Uruguay).
 * Acepta contexto de conversación opcional para resolver referencias anafóricas.
 */
async function parseEventFromText(
  text: string,
  referenceDate: Date,
  context?: string
): Promise<{
  title: string;
  start: Date;
  end: Date;
  recurrence: string[] | null;
} | null> {
  const dateStr = referenceDate.toLocaleDateString("es-UY", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Montevideo",
  });

  const contextSection = context
    ? `\nContexto de la conversación reciente:\n${context}\n\n`
    : "";

  try {
    const raw = await callClaude({
      model: "claude-haiku-4-5-20251001",
      maxTokens: 250,
      messages: [
        {
          role: "user",
          content:
            `Hoy es ${dateStr}.${contextSection}\n` +
              `Extrae del siguiente texto: título del evento, fecha y hora de inicio (la PRIMERA ocurrencia), fecha y hora de fin de esa primera ocurrencia, y si es un evento recurrente. ` +
              `Si no se menciona duración, asumir 1 hora. ` +
              `Si el texto hace referencia a un evento mencionado antes en el contexto, usá esa información para completar los datos faltantes.\n\n` +
              `RECURRENCIA: si el usuario pide que el evento se repita (ej: "todos los días", "cada lunes", "de lunes a viernes", "todas las semanas", "cada día por un mes"), ` +
              `generá una regla RRULE estándar de iCalendar en el campo "recurrence". Reglas:\n` +
              `- "todos los días" → "RRULE:FREQ=DAILY"\n` +
              `- "de lunes a viernes" / "días de semana" → "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"\n` +
              `- "cada lunes" / "todos los lunes" → "RRULE:FREQ=WEEKLY;BYDAY=MO"\n` +
              `- "todas las semanas" → "RRULE:FREQ=WEEKLY"\n` +
              `- Si dice una cantidad explícita (ej: "por un mes", "durante un mes"), agregá un límite con UNTIL en formato UTC: "...;UNTIL=YYYYMMDDT235959Z" calculado a un mes desde la primera ocurrencia.\n` +
              `- Si dice "X veces", usá COUNT (ej: ";COUNT=10").\n` +
              `- Si NO menciona un final y es recurrente "todos los días" sin límite, agregá UNTIL a un mes desde la primera ocurrencia para no agendar indefinidamente.\n` +
              `- Si el evento NO es recurrente, devolvé "recurrence": null.\n\n` +
              `IMPORTANTE: Devuelve las horas en formato de Uruguay (UTC-3), usando el offset -03:00. ` +
              `Responde SOLO con JSON con este formato exacto: ` +
              `{"title":"...","start":"YYYY-MM-DDTHH:MM:SS-03:00","end":"YYYY-MM-DDTHH:MM:SS-03:00","recurrence":"RRULE:..." o null} ` +
              `Texto: "${text}"`,
        },
      ],
    });

    if (!raw) return null;

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as {
      title: string;
      start: string;
      end: string;
      recurrence?: string | null;
    };

    if (!parsed.title || !parsed.start || !parsed.end) return null;

    // Normalizar la RRULE: aceptar string no vacío que arranque con "RRULE:"
    let recurrence: string[] | null = null;
    if (typeof parsed.recurrence === "string") {
      const rule = parsed.recurrence.trim();
      if (rule && rule.toUpperCase().startsWith("RRULE:")) {
        recurrence = [rule];
      }
    }

    return {
      title: parsed.title,
      start: new Date(parsed.start),
      end: new Date(parsed.end),
      recurrence,
    };
  } catch {
    return null;
  }
}

// ─── Etiqueta legible de una RRULE ────────────────────────────────────────────

/**
 * Convierte una RRULE en una descripción corta en español para confirmar al usuario.
 * Ej: "RRULE:FREQ=DAILY;UNTIL=20260701T235959Z" → "todos los días hasta el 1 jul".
 */
function describeRecurrence(rule: string): string {
  const upper = rule.toUpperCase();
  let base = "que se repite";

  if (upper.includes("FREQ=DAILY")) {
    base = "todos los días";
  } else if (upper.includes("FREQ=WEEKLY")) {
    const byday = upper.match(/BYDAY=([A-Z,]+)/)?.[1];
    if (byday === "MO,TU,WE,TH,FR") {
      base = "de lunes a viernes";
    } else if (byday) {
      const dayNames: Record<string, string> = {
        MO: "lunes", TU: "martes", WE: "miércoles", TH: "jueves",
        FR: "viernes", SA: "sábados", SU: "domingos",
      };
      const days = byday.split(",").map((d) => dayNames[d] ?? d).join(", ");
      base = `cada ${days}`;
    } else {
      base = "todas las semanas";
    }
  } else if (upper.includes("FREQ=MONTHLY")) {
    base = "todos los meses";
  }

  const count = upper.match(/COUNT=(\d+)/)?.[1];
  if (count) return `${base} (${count} veces)`;

  const until = upper.match(/UNTIL=(\d{8})/)?.[1];
  if (until) {
    const y = Number(until.slice(0, 4));
    const m = Number(until.slice(4, 6)) - 1;
    const d = Number(until.slice(6, 8));
    const untilLabel = new Date(Date.UTC(y, m, d)).toLocaleDateString("es-UY", {
      day: "numeric",
      month: "short",
      timeZone: "America/Montevideo",
    });
    return `${base} hasta el ${untilLabel}`;
  }

  return base;
}

// ─── Parseo de actualización de evento desde texto ────────────────────────────

/**
 * Usa Claude Haiku para extraer qué evento se quiere mover y la nueva hora.
 * Devuelve tiempos con offset -03:00 (Uruguay).
 */
async function parseEventUpdateFromText(
  text: string,
  referenceDate: Date,
  context?: string
): Promise<{
  searchTitle: string;
  newStart: Date;
  newEnd: Date;
} | null> {
  const dateStr = referenceDate.toLocaleDateString("es-UY", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Montevideo",
  });

  const contextSection = context
    ? `\nContexto de la conversación reciente:\n${context}\n\n`
    : "";

  try {
    const raw = await callClaude({
      model: "claude-haiku-4-5-20251001",
      maxTokens: 150,
      messages: [
        {
          role: "user",
          content:
            `Hoy es ${dateStr}.${contextSection}\n` +
            `El usuario quiere modificar la hora de un evento de su Google Calendar. ` +
            `Basándote en el contexto de la conversación (si está disponible), identificá:\n` +
            `1. El título o palabras clave del evento a modificar\n` +
            `2. La nueva fecha y hora de inicio\n` +
            `3. La nueva fecha y hora de fin (si no se menciona duración, mantener 1 hora)\n\n` +
            `IMPORTANTE: Devuelve las horas en formato de Uruguay (UTC-3), usando el offset -03:00. ` +
            `Responde SOLO con JSON con este formato exacto: ` +
            `{"searchTitle":"...","newStart":"YYYY-MM-DDTHH:MM:SS-03:00","newEnd":"YYYY-MM-DDTHH:MM:SS-03:00"} ` +
            `Texto: "${text}"`,
        },
      ],
    });

    if (!raw) return null;

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as {
      searchTitle: string;
      newStart: string;
      newEnd: string;
    };

    if (!parsed.searchTitle || !parsed.newStart || !parsed.newEnd) return null;

    return {
      searchTitle: parsed.searchTitle,
      newStart: new Date(parsed.newStart),
      newEnd: new Date(parsed.newEnd),
    };
  } catch {
    return null;
  }
}

// ─── Formateo de eventos ─────────────────────────────────────────────────────

function formatEventList(events: CalendarEvent[], label: string): string {
  if (events.length === 0) return `No tenés eventos para ${label}.`;

  const lines = events.map((e) => {
    if (e.isAllDay) {
      return `• ${e.title} (todo el día)`;
    }
    const start = formatTime(e.start);
    const end = formatTime(e.end);
    return `• ${start}-${end} ${e.title}`;
  });

  return `📅 Agenda ${label}:\n${lines.join("\n")}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("es-UY", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Montevideo",
  });
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString("es-UY", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "America/Montevideo",
  });
}

// ─── Agente ───────────────────────────────────────────────────────────────────

export const calendarAgent = {
  name: "calendar",
  description: "Gestiona el Google Calendar del usuario",

  async process(input: AgentInput): Promise<AgentOutput> {
    const { userId, message, context } = input;
    const intent = await detectIntent(message);

    switch (intent) {
      case "status": {
        const status = await getCalendarStatus(userId);
        if (!status.connected) {
          return {
            success: true,
            message:
              "Google Calendar no está conectado. Para conectarlo, andá a Configuración → Google Calendar en la app.",
          };
        }
        if (!status.hasCalendarScope) {
          return {
            success: true,
            message:
              "Tenés Google conectado pero sin permisos de Calendar. Cerrá sesión y volvé a entrar para otorgar los permisos.",
          };
        }
        return {
          success: true,
          message: "Google Calendar está conectado y activo ✅",
        };
      }

      case "query_today": {
        const events = await getTodayEvents(userId);
        return {
          success: true,
          message: formatEventList(events, "de hoy"),
        };
      }

      case "query_week": {
        const events = await getWeekEvents(userId);
        if (events.length === 0) {
          return {
            success: true,
            message: "No tenés eventos para los próximos 7 días.",
          };
        }

        // Agrupar por día
        const byDay = new Map<string, CalendarEvent[]>();
        for (const e of events) {
          const key = e.start.toDateString();
          if (!byDay.has(key)) byDay.set(key, []);
          byDay.get(key)!.push(e);
        }

        const lines: string[] = ["📅 Agenda de la semana:"];
        for (const [, dayEvents] of byDay) {
          const dayLabel = formatDateShort(dayEvents[0].start);
          lines.push(`\n${dayLabel}:`);
          for (const e of dayEvents) {
            if (e.isAllDay) {
              lines.push(`  • ${e.title} (todo el día)`);
            } else {
              lines.push(`  • ${formatTime(e.start)}-${formatTime(e.end)} ${e.title}`);
            }
          }
        }

        return { success: true, message: lines.join("\n") };
      }

      case "create_event": {
        const parsed = await parseEventFromText(message, new Date(), context);
        if (!parsed) {
          return {
            success: false,
            message:
              "No pude entender el evento. Intentá con algo como: " +
              '"Agendame gym el jueves a las 18:00"',
          };
        }

        const eventId = await createEvent(
          userId,
          parsed.title,
          parsed.start,
          parsed.end,
          undefined,
          parsed.recurrence ?? undefined
        );

        if (!eventId) {
          return {
            success: false,
            message:
              "No pude crear el evento. Verificá que Google Calendar esté conectado en Configuración.",
          };
        }

        const dateLabel = formatDateShort(parsed.start);
        const startTime = formatTime(parsed.start);
        const endTime = formatTime(parsed.end);

        if (parsed.recurrence && parsed.recurrence.length > 0) {
          const recurrenceLabel = describeRecurrence(parsed.recurrence[0]);
          return {
            success: true,
            message:
              `✅ Evento recurrente creado: "${parsed.title}"\n` +
              `🔁 ${recurrenceLabel}\n` +
              `📅 Desde el ${dateLabel}, ${startTime}-${endTime}`,
          };
        }

        return {
          success: true,
          message:
            `✅ Evento creado: "${parsed.title}"\n` +
            `📅 ${dateLabel}, ${startTime}-${endTime}`,
        };
      }

      case "update_event": {
        const parsed = await parseEventUpdateFromText(message, new Date(), context);
        if (!parsed) {
          return {
            success: false,
            message:
              "No pude entender qué evento querés mover ni a qué hora. " +
              'Intentá con algo como: "Mové la reunión con Marcos a las 15:00"',
          };
        }

        // Buscar el evento por título
        const event = await findEventByTitle(userId, parsed.searchTitle);
        if (!event) {
          return {
            success: false,
            message:
              `No encontré ningún evento que coincida con "${parsed.searchTitle}" en tu agenda. ` +
              "¿Podés darme más detalles del evento?",
          };
        }

        const ok = await updateEvent(userId, event.id, parsed.newStart, parsed.newEnd);
        if (!ok) {
          return {
            success: false,
            message:
              "No pude actualizar el evento. Verificá que Google Calendar esté conectado en Configuración.",
          };
        }

        const newStartTime = formatTime(parsed.newStart);
        const newEndTime = formatTime(parsed.newEnd);
        const dateLabel = formatDateShort(parsed.newStart);

        return {
          success: true,
          message:
            `✅ Evento actualizado: "${event.title}"\n` +
            `📅 ${dateLabel}, ${newStartTime}-${newEndTime}`,
        };
      }

      case "remind_me": {
        const parsed = await parseReminderRequest(message, new Date(), context);
        if (!parsed) {
          return {
            success: false,
            message:
              "No pude entender el recordatorio. Intentá con algo como: " +
              '"Recordame en 2 horas que tengo dentista" o "Avisame mañana a las 10 que es el cumple de mamá".',
          };
        }

        await createReminder(userId, parsed.message, parsed.fireAt);

        const timeLabel = formatTimeLabel(parsed.fireAt);
        const fireDate = formatDateShort(parsed.fireAt);
        const fireTime = formatTime(parsed.fireAt);

        return {
          success: true,
          message:
            `✅ Recordatorio guardado: "${parsed.message}"\n` +
            `⏰ Te aviso el ${fireDate} a las ${fireTime} (en ${timeLabel})`,
        };
      }

      default:
        return {
          success: false,
          message:
            "¿Qué querés saber de tu agenda? Puedo decirte qué tenés hoy, esta semana, crear un evento, mover uno o configurar un recordatorio.",
        };
    }
  },

  /**
   * Devuelve los eventos de hoy como texto para el Morning Summary.
   * Retorna null si no hay eventos o Calendar no está conectado.
   */
  async getTodayEventsText(userId: string): Promise<string | null> {
    return getTodayEventsText(userId);
  },

  /**
   * Busca huecos libres en la agenda del usuario.
   * Usado por el agente de fitness para smart habits.
   */
  async findFreeSlots(
    userId: string,
    date: Date,
    durationMinutes: number
  ): Promise<Array<{ start: Date; end: Date }>> {
    return findFreeSlots(userId, date, durationMinutes);
  },

  /**
   * Crea un evento directamente (para uso de otros agentes).
   */
  async createEvent(
    userId: string,
    title: string,
    start: Date,
    end: Date,
    description?: string,
    recurrence?: string[]
  ): Promise<string | null> {
    return createEvent(userId, title, start, end, description, recurrence);
  },
};

// ============================================================
// agents/calendar/index.ts — Agente de Google Calendar
// Responsabilidades:
//   - Responder consultas de agenda (hoy / semana)
//   - Crear eventos en Google Calendar con confirmación del usuario
//   - Proveer contexto de agenda al orquestrador y al Morning Summary
//   - Buscar huecos libres para reagendado de gym (smart habits)
// ============================================================

import type { AgentInput, AgentOutput } from "@/lib/types";
import {
  getTodayEvents,
  getWeekEvents,
  createEvent,
  findFreeSlots,
  getTodayEventsText,
  getCalendarStatus,
  type CalendarEvent,
} from "@/lib/calendar";
import { detectIntentAI } from "@/lib/nlp";

// ─── Tipos de intención ───────────────────────────────────────────────────────

type CalendarIntent =
  | "query_today"    // consultar agenda de hoy
  | "query_week"     // consultar agenda de la semana
  | "create_event"   // crear un evento en el calendario
  | "status"         // verificar estado de conexión
  | "unknown";

// ─── Detección de intención con LLM ──────────────────────────────────────────

async function detectIntent(text: string): Promise<CalendarIntent> {
  const intent = await detectIntentAI(
    "Eres el agente de Google Calendar de una app personal.",
    {
      query_today:  "El usuario quiere saber qué tiene hoy en su agenda o calendario",
      query_week:   "El usuario quiere saber qué tiene esta semana o los próximos días",
      create_event: "El usuario quiere crear, agendar o agregar un evento al calendario",
      status:       "El usuario pregunta si el calendario está conectado o vinculado",
      unknown:      "Otro mensaje no relacionado al calendario",
    },
    text
  );
  return intent as CalendarIntent;
}

// ─── Parseo de evento desde texto ─────────────────────────────────────────────

/**
 * Usa Claude Haiku para extraer título, fecha y hora de un texto libre.
 * Retorna null si no puede parsear.
 */
async function parseEventFromText(
  text: string,
  referenceDate: Date
): Promise<{ title: string; start: Date; end: Date } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const dateStr = referenceDate.toLocaleDateString("es-UY", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Montevideo",
  });

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 120,
        messages: [
          {
            role: "user",
            content:
              `Hoy es ${dateStr}. Extrae del siguiente texto: título del evento, fecha y hora de inicio, fecha y hora de fin. ` +
              `Si no se menciona duración, asumir 1 hora. ` +
              `Responde SOLO con JSON con este formato exacto: ` +
              `{"title":"...","start":"ISO8601","end":"ISO8601"} ` +
              `Texto: "${text}"`,
          },
        ],
      }),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      content: Array<{ type: string; text: string }>;
    };
    const raw = data.content?.[0]?.text?.trim() ?? "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as {
      title: string;
      start: string;
      end: string;
    };

    if (!parsed.title || !parsed.start || !parsed.end) return null;

    return {
      title: parsed.title,
      start: new Date(parsed.start),
      end: new Date(parsed.end),
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
    const { userId, message } = input;
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
        const parsed = await parseEventFromText(message, new Date());
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
          parsed.end
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

        return {
          success: true,
          message:
            `✅ Evento creado: "${parsed.title}"\n` +
            `📅 ${dateLabel}, ${startTime}-${endTime}`,
        };
      }

      default:
        return {
          success: false,
          message:
            "¿Qué querés saber de tu agenda? Puedo decirte qué tenés hoy, esta semana, o crear un evento.",
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
    description?: string
  ): Promise<string | null> {
    return createEvent(userId, title, start, end, description);
  },
};

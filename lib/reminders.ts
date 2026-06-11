// ============================================================
// lib/reminders.ts — Recordatorios personales
//
// Dos orígenes:
//   1. Usuario via WhatsApp: "recordame en 2 horas que tengo dentista"
//   2. Google Calendar: cron que detecta eventos 2h antes y envía alerta
// ============================================================

import { db } from "@/lib/db";
import { callClaude } from "@/lib/claude";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type ReminderWithUser = {
  id: string;
  userId: string;
  message: string;
  fireAt: Date;
  externalId: string | null;
  user: {
    settings: { whatsappNumber: string | null } | null;
  };
};

// ─── CRUD ─────────────────────────────────────────────────────────────────────

/**
 * Crea un recordatorio para el usuario.
 * @param userId   ID del usuario
 * @param message  Qué recordar (va como {{2}} en la plantilla)
 * @param fireAt   Cuándo dispararlo
 * @param externalId  Opcional: ID para evitar duplicados (ej: "cal:eventId_fecha")
 */
export async function createReminder(
  userId: string,
  message: string,
  fireAt: Date,
  externalId?: string
): Promise<string> {
  const reminder = await db.reminder.create({
    data: {
      userId,
      message,
      fireAt,
      externalId: externalId ?? null,
    },
  });
  return reminder.id;
}

/**
 * Retorna todos los recordatorios pendientes que ya deben dispararse.
 * Ventana: desde ahora hasta +windowMin minutos en el futuro.
 * Solo devuelve los no enviados.
 */
export async function getDueReminders(
  windowMin = 5
): Promise<ReminderWithUser[]> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + windowMin * 60 * 1000);

  return db.reminder.findMany({
    where: {
      sent: false,
      fireAt: { lte: windowEnd },
    },
    include: {
      user: {
        select: {
          settings: {
            select: { whatsappNumber: true },
          },
        },
      },
    },
  }) as Promise<ReminderWithUser[]>;
}

/**
 * Marca un recordatorio como enviado.
 */
export async function markReminderSent(id: string): Promise<void> {
  await db.reminder.update({
    where: { id },
    data: { sent: true },
  });
}

/**
 * Verifica si ya existe un recordatorio de Calendar para este evento (dedup).
 */
export async function calendarReminderExists(
  userId: string,
  externalId: string
): Promise<boolean> {
  const existing = await db.reminder.findUnique({
    where: { userId_externalId: { userId, externalId } },
  });
  return !!existing;
}

// ─── Formateo de tiempo ───────────────────────────────────────────────────────

/**
 * Convierte la diferencia entre ahora y fireAt en texto legible para {{1}}.
 * Ejemplos: "2 horas", "30 minutos", "1 hora y 30 minutos"
 */
export function formatTimeLabel(fireAt: Date): string {
  const totalMin = Math.max(1, Math.round((fireAt.getTime() - Date.now()) / 60000));

  if (totalMin < 60) {
    return `${totalMin} ${totalMin === 1 ? "minuto" : "minutos"}`;
  }

  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;

  const hoursLabel = hours === 1 ? "1 hora" : `${hours} horas`;
  if (mins === 0) return hoursLabel;
  return `${hoursLabel} y ${mins} ${mins === 1 ? "minuto" : "minutos"}`;
}

// ─── Parseo de solicitud del usuario ─────────────────────────────────────────

/**
 * Usa Claude Haiku para extraer qué recordar y cuándo desde texto libre.
 * Ejemplos de input:
 *   "recordame en 2 horas que tengo dentista"
 *   "avisame mañana a las 10 que es el cumple de mamá"
 *   "recordame en 30 minutos que tengo call"
 *
 * Retorna null si no se puede parsear.
 */
export async function parseReminderRequest(
  text: string,
  referenceDate: Date,
  context?: string
): Promise<{ message: string; fireAt: Date } | null> {
  const dateStr = referenceDate.toLocaleDateString("es-UY", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Montevideo",
  });

  const timeStr = referenceDate.toLocaleTimeString("es-UY", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Montevideo",
  });

  const contextSection = context
    ? `\nContexto de conversación reciente:\n${context}\n\n`
    : "";

  try {
    const raw = await callClaude({
      model: "claude-haiku-4-5-20251001",
      maxTokens: 120,
      messages: [
        {
          role: "user",
          content:
            `Hoy es ${dateStr} y son las ${timeStr} en Uruguay (UTC-3).${contextSection}\n` +
            `El usuario quiere configurar un recordatorio. Extrae:\n` +
            `1. Qué hay que recordar (máximo 4 palabras, ej: "dentista", "reunión con Pablo", "gym")\n` +
            `2. Cuándo disparar el recordatorio (fecha y hora exactas)\n\n` +
            `IMPORTANTE: Devuelve la hora en formato de Uruguay (UTC-3), con el offset -03:00.\n` +
            `Responde SOLO con JSON: {"message":"...","fireAt":"YYYY-MM-DDTHH:MM:SS-03:00"}\n` +
            `Texto: "${text}"`,
        },
      ],
    });

    if (!raw) return null;

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as {
      message: string;
      fireAt: string;
    };

    if (!parsed.message || !parsed.fireAt) return null;

    const fireAt = new Date(parsed.fireAt);
    if (isNaN(fireAt.getTime())) return null;

    // Verificar que el fireAt sea en el futuro (mínimo 1 minuto)
    if (fireAt.getTime() < Date.now() + 60000) return null;

    return { message: parsed.message, fireAt };
  } catch {
    return null;
  }
}

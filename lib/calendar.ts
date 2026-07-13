// ============================================================
// lib/calendar.ts — Google Calendar integration
// Usa los tokens OAuth almacenados en la tabla accounts por NextAuth
// No requiere la librería googleapis — llamadas REST directas con fetch
// ============================================================

import { db } from "@/lib/db";
import {
  startOfDayUY,
  endOfDayUY,
  addDays,
  atHourUY,
  UY_OFFSET,
} from "@/lib/dates";

// ─── Tipos públicos ────────────────────────────────────────────────────────────

export type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  description?: string | null;
  location?: string | null;
  isAllDay: boolean;
};

export type CalendarStatus = {
  connected: boolean;
  hasCalendarScope: boolean;
};

// ─── Tipos internos (Google API) ──────────────────────────────────────────────

type GoogleEventItem = {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
};

type GoogleEventsResponse = {
  items?: GoogleEventItem[];
};

type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

// ─── Autenticación ────────────────────────────────────────────────────────────

/**
 * Lee los tokens de Google de la tabla accounts (guardados por NextAuth PrismaAdapter).
 */
async function getGoogleTokens(userId: string): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
  scope: string | null;
} | null> {
  const account = await db.account.findFirst({
    where: { userId, provider: "google" },
    select: {
      access_token: true,
      refresh_token: true,
      expires_at: true,
      scope: true,
    },
  });

  if (!account?.access_token) return null;

  return {
    accessToken: account.access_token,
    refreshToken: account.refresh_token ?? null,
    expiresAt: account.expires_at ?? null,
    scope: account.scope ?? null,
  };
}

/**
 * Usa el refresh_token para obtener un nuevo access_token y lo persiste en la DB.
 */
async function refreshGoogleToken(
  userId: string,
  refreshToken: string,
): Promise<string | null> {
  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  if (!clientId || !clientSecret) return null;

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) {
      console.error(
        "[calendar] Error refresh token:",
        res.status,
        await res.text(),
      );
      return null;
    }

    const data = (await res.json()) as GoogleTokenResponse;
    const newExpiry = Math.floor(Date.now() / 1000) + data.expires_in;

    await db.account.updateMany({
      where: { userId, provider: "google" },
      data: {
        access_token: data.access_token,
        expires_at: newExpiry,
      },
    });

    return data.access_token;
  } catch (err) {
    console.error("[calendar] refreshGoogleToken exception:", err);
    return null;
  }
}

/**
 * Devuelve un access_token válido, refrescando si expiró o está por expirar (<60s).
 */
async function getValidAccessToken(userId: string): Promise<string | null> {
  const tokens = await getGoogleTokens(userId);
  if (!tokens) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  const isExpired = tokens.expiresAt !== null && tokens.expiresAt < nowSec + 60;

  if (isExpired) {
    if (!tokens.refreshToken) {
      console.warn(
        "[calendar] Token expirado y sin refresh_token para userId=" + userId,
      );
      return null;
    }
    return refreshGoogleToken(userId, tokens.refreshToken);
  }

  return tokens.accessToken;
}

/**
 * Revoca el acceso de la app a la cuenta de Google del usuario.
 * Equivale a "Quitar acceso" en myaccount.google.com/permissions.
 *
 * Se usa al reconectar: revocar el grant viejo obliga a Google a entregar un
 * refresh_token NUEVO en el próximo consentimiento (con prompt=consent). Sin
 * esto, Google reutiliza el grant existente y puede no devolver refresh_token,
 * dejando el token muerto en la DB.
 *
 * Best-effort: si falla (token ya inválido, red), no lanza.
 */
export async function revokeGoogleAccess(userId: string): Promise<void> {
  const tokens = await getGoogleTokens(userId);
  if (!tokens) return;

  const tokenToRevoke = tokens.refreshToken ?? tokens.accessToken;
  if (!tokenToRevoke) return;

  try {
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: tokenToRevoke }),
    });
  } catch (err) {
    console.error("[calendar] revokeGoogleAccess exception:", err);
  }
}

// ─── Estado de la integración ────────────────────────────────────────────────

/**
 * Retorna si el usuario tiene Google Calendar conectado y con los scopes necesarios.
 */
export async function getCalendarStatus(
  userId: string,
): Promise<CalendarStatus> {
  const tokens = await getGoogleTokens(userId);

  if (!tokens) {
    return { connected: false, hasCalendarScope: false };
  }

  const hasCalendarScope = tokens.scope?.includes("calendar") ?? false;

  return { connected: true, hasCalendarScope };
}

// ─── Eventos ─────────────────────────────────────────────────────────────────

/**
 * Retorna los eventos de hoy del Google Calendar del usuario.
 */
export async function getTodayEvents(userId: string): Promise<CalendarEvent[]> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return [];

  const calendarId = process.env.GOOGLE_CALENDAR_ID ?? "primary";

  // Límites del día en hora Uruguay — con setHours() el "día" era el del
  // servidor (UTC en Vercel) y después de las 21:00 UY la agenda se corría
  // al día siguiente.
  const timeMin = startOfDayUY();
  const timeMax = endOfDayUY();

  return fetchEvents(accessToken, calendarId, timeMin, timeMax, 20);
}

/**
 * Retorna los eventos de mañana (día calendario de Uruguay).
 */
export async function getTomorrowEvents(
  userId: string,
): Promise<CalendarEvent[]> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return [];

  const calendarId = process.env.GOOGLE_CALENDAR_ID ?? "primary";
  const timeMin = addDays(startOfDayUY(), 1);
  const timeMax = endOfDayUY(timeMin);

  return fetchEvents(accessToken, calendarId, timeMin, timeMax, 20);
}

/**
 * Retorna los eventos de los próximos 7 días del Google Calendar del usuario.
 */
export async function getWeekEvents(userId: string): Promise<CalendarEvent[]> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return [];

  const calendarId = process.env.GOOGLE_CALENDAR_ID ?? "primary";
  const timeMin = startOfDayUY();
  const timeMax = addDays(timeMin, 7);

  return fetchEvents(accessToken, calendarId, timeMin, timeMax, 50);
}

/**
 * Helper interno — llama a la API de Calendar y mapea los resultados.
 */
async function fetchEvents(
  accessToken: string,
  calendarId: string,
  timeMin: Date,
  timeMax: Date,
  maxResults: number,
): Promise<CalendarEvent[]> {
  try {
    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: String(maxResults),
    });

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!res.ok) {
      console.error(
        "[calendar] fetchEvents error:",
        res.status,
        await res.text(),
      );
      return [];
    }

    const data = (await res.json()) as GoogleEventsResponse;
    return (data.items ?? []).map(mapGoogleEvent);
  } catch (err) {
    console.error("[calendar] fetchEvents exception:", err);
    return [];
  }
}

/**
 * Crea un evento en Google Calendar.
 * Devuelve el ID del evento creado, o null si falló.
 *
 * @param recurrence  Reglas RRULE para eventos recurrentes (ej:
 *                    ["RRULE:FREQ=DAILY;UNTIL=20260701T000000Z"]).
 *                    Si se pasa, Google expande automáticamente las repeticiones
 *                    (un solo evento "master") — no hace falta crear N eventos.
 */
export async function createEvent(
  userId: string,
  title: string,
  start: Date,
  end: Date,
  description?: string,
  recurrence?: string[],
): Promise<string | null> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return null;

  const calendarId = process.env.GOOGLE_CALENDAR_ID ?? "primary";

  try {
    const body: Record<string, unknown> = {
      summary: title,
      description: description ?? "",
      // timeZone es necesario para que los eventos recurrentes respeten la
      // hora local (UTC-3) en cada repetición, incluso cruzando cambios de DST.
      start: { dateTime: start.toISOString(), timeZone: "America/Montevideo" },
      end: { dateTime: end.toISOString(), timeZone: "America/Montevideo" },
    };
    if (recurrence && recurrence.length > 0) {
      body.recurrence = recurrence;
    }

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      console.error(
        "[calendar] createEvent error:",
        res.status,
        await res.text(),
      );
      return null;
    }

    const data = (await res.json()) as { id: string };
    return data.id ?? null;
  } catch (err) {
    console.error("[calendar] createEvent exception:", err);
    return null;
  }
}

/**
 * Actualiza la fecha/hora de un evento existente en Google Calendar.
 * Devuelve true si el update fue exitoso.
 */
export async function updateEvent(
  userId: string,
  eventId: string,
  start: Date,
  end: Date,
): Promise<boolean> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return false;

  const calendarId = process.env.GOOGLE_CALENDAR_ID ?? "primary";

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          start: {
            dateTime: start.toISOString(),
            timeZone: "America/Montevideo",
          },
          end: { dateTime: end.toISOString(), timeZone: "America/Montevideo" },
        }),
      },
    );

    if (!res.ok) {
      console.error(
        "[calendar] updateEvent error:",
        res.status,
        await res.text(),
      );
      return false;
    }

    return true;
  } catch (err) {
    console.error("[calendar] updateEvent exception:", err);
    return false;
  }
}

/**
 * Busca un evento en los próximos N días por coincidencia de título.
 * Busca también desde ayer para atrapar eventos recién creados.
 */
export async function findEventByTitle(
  userId: string,
  searchTitle: string,
  windowDays = 14,
): Promise<CalendarEvent | null> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return null;

  const calendarId = process.env.GOOGLE_CALENDAR_ID ?? "primary";

  // Incluir desde ayer (hora UY) para atrapar eventos recién creados en el día
  const timeMin = addDays(startOfDayUY(), -1);
  const timeMax = addDays(timeMin, windowDays);

  const events = await fetchEvents(
    accessToken,
    calendarId,
    timeMin,
    timeMax,
    50,
  );

  const q = searchTitle.toLowerCase().trim();
  // Primero buscar coincidencia exacta, luego parcial
  return (
    events.find((e) => e.title.toLowerCase() === q) ??
    events.find((e) => e.title.toLowerCase().includes(q)) ??
    events.find((e) => q.includes(e.title.toLowerCase())) ??
    null
  );
}

/**
 * Busca huecos libres en el calendario del usuario para un día dado.
 * Busca dentro de la ventana 6 AM – 10 PM.
 * Devuelve hasta 3 slots libres de la duración indicada.
 * Usado por el agente de fitness para proponer reagendado del gym.
 */
export async function findFreeSlots(
  userId: string,
  date: Date,
  durationMinutes: number,
): Promise<Array<{ start: Date; end: Date }>> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return [];

  const calendarId = process.env.GOOGLE_CALENDAR_ID ?? "primary";

  const dayStart = atHourUY(date, 6);
  const dayEnd = atHourUY(date, 22);

  try {
    const params = new URLSearchParams({
      timeMin: dayStart.toISOString(),
      timeMax: dayEnd.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "50",
    });

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!res.ok) return [];

    const data = (await res.json()) as GoogleEventsResponse;

    // Solo eventos con hora exacta (no all-day)
    const busyBlocks = (data.items ?? [])
      .filter((e) => e.start.dateTime)
      .map((e) => ({
        start: new Date(e.start.dateTime!),
        end: new Date(e.end.dateTime!),
      }))
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    const slots: Array<{ start: Date; end: Date }> = [];
    const requiredMs = durationMinutes * 60 * 1000;
    let cursor = new Date(dayStart);

    for (const block of busyBlocks) {
      const gap = block.start.getTime() - cursor.getTime();
      if (gap >= requiredMs) {
        slots.push({
          start: new Date(cursor),
          end: new Date(cursor.getTime() + requiredMs),
        });
        if (slots.length >= 3) break;
      }
      // Avanzar el cursor si el bloque termina después del cursor actual
      if (block.end.getTime() > cursor.getTime()) {
        cursor = new Date(block.end);
      }
    }

    // Hueco después del último evento
    if (slots.length < 3) {
      const remaining = dayEnd.getTime() - cursor.getTime();
      if (remaining >= requiredMs) {
        slots.push({
          start: new Date(cursor),
          end: new Date(cursor.getTime() + requiredMs),
        });
      }
    }

    return slots;
  } catch (err) {
    console.error("[calendar] findFreeSlots exception:", err);
    return [];
  }
}

// ─── Texto para Morning Summary ───────────────────────────────────────────────

/**
 * Devuelve la agenda de hoy como string para incluir en el Morning Summary.
 * Retorna null si no hay eventos o el calendario no está conectado.
 */
export async function getTodayEventsText(
  userId: string,
): Promise<string | null> {
  try {
    const events = await getTodayEvents(userId);
    if (events.length === 0) return null;

    const lines = events.map((e) => {
      const time = e.isAllDay
        ? "(todo el día)"
        : `${formatTime(e.start)} - ${formatTime(e.end)}`;
      return `• ${e.title} ${time}`;
    });

    return "📅 Agenda de hoy:\n" + lines.join("\n");
  } catch {
    return null;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapGoogleEvent(item: GoogleEventItem): CalendarEvent {
  const isAllDay = !item.start.dateTime;

  // All-day: Google manda solo "YYYY-MM-DD". Parsearlo sin offset lo anclaba a
  // medianoche del SERVIDOR (UTC en Vercel) = 21:00 UY del día anterior, y el
  // evento aparecía corrido un día. El offset -03:00 lo ancla al día correcto.
  const start = isAllDay
    ? new Date(`${item.start.date}T00:00:00${UY_OFFSET}`)
    : new Date(item.start.dateTime!);

  let end: Date;
  if (isAllDay) {
    // end.date de Google es EXCLUSIVO (el día siguiente al último día del
    // evento): restamos 1s para que el evento no "derrame" al día siguiente.
    const endExclusive = item.end.date
      ? new Date(`${item.end.date}T00:00:00${UY_OFFSET}`)
      : addDays(start, 1);
    end = new Date(endExclusive.getTime() - 1000);
  } else {
    end = new Date(item.end.dateTime!);
  }

  return {
    id: item.id,
    title: item.summary ?? "(sin título)",
    start,
    end,
    description: item.description ?? null,
    location: item.location ?? null,
    isAllDay,
  };
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("es-UY", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Montevideo",
  });
}

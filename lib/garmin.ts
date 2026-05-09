// ============================================================
// lib/garmin.ts — Garmin Connect API Client
// Sesión 3 — Módulo de Sueño
//
// AUTENTICACIÓN:
//   Modo actual: SSO email/password (API no oficial de Garmin Connect)
//   Modo futuro: OAuth 1.0a oficial (requiere partnership con Garmin)
//
// VARIABLES DE ENTORNO REQUERIDAS (ver .env.local.example):
//   GARMIN_EMAIL      — email de la cuenta Garmin Connect
//   GARMIN_PASSWORD   — contraseña de la cuenta Garmin Connect
//
// PARA OBTENER ACCESO OFICIAL A LA API:
//   https://developer.garmin.com/health-api/overview/
//   Requerido para: aplicaciones comerciales, acceso a datos de terceros
//   Para uso personal esta implementación SSO es suficiente.
//
// DATOS DISPONIBLES DE GARMIN (sueño):
//   - Duración total, profundo, ligero, REM, despierto
//   - Score de sueño Garmin (0–100) con sub-scores
//   - SpO2 promedio y mínimo
//   - Frecuencia respiratoria promedio
//   - Body Battery antes y después del sueño
//   - Nivel de estrés promedio durante el sueño
// ============================================================

import { db } from "@/lib/db";

// --- Tipos ---

export type GarminSleepData = {
  date: string; // "YYYY-MM-DD" (día de despertar)
  startTimeGMT: Date;
  endTimeGMT: Date;
  durationSeconds: number;
  deepSleepSeconds: number;
  lightSleepSeconds: number;
  remSleepSeconds: number;
  awakeSleepSeconds: number;
  overallScore: number | null; // 0–100 Garmin sleep score
  stressScore: number | null; // Estrés promedio (Garmin, 0–100, menor = mejor)
  spo2Avg: number | null;
  respirationAvg: number | null;
  bodyBatteryChange: number | null; // Positivo = cargó batería
};

export type GarminStatus = {
  connected: boolean;
  sessionValid: boolean;
  lastSync: Date | null;
  error?: string;
};

// --- Constantes ---

const GARMIN_SSO_URL = "https://sso.garmin.com/sso";
const GARMIN_CONNECT_URL = "https://connect.garmin.com";
const SESSION_TTL_MS = 23 * 60 * 60 * 1000; // 23 horas

const SSO_PARAMS = new URLSearchParams({
  id: "gauth-widget",
  embedWidget: "true",
  gauthHost: GARMIN_SSO_URL,
  service: `${GARMIN_CONNECT_URL}/modern/`,
  source: `${GARMIN_CONNECT_URL}/signin/`,
  redirectAfterAccountLoginUrl: `${GARMIN_CONNECT_URL}/modern/`,
  redirectAfterAccountCreationUrl: `${GARMIN_CONNECT_URL}/modern/`,
});

// Cache en memoria (se invalida si el proceso reinicia)
let _memSession: string | null = null;
let _memSessionExp: Date | null = null;

// --- Auth ---

/**
 * Obtener sesión activa de Garmin Connect.
 * Prioridad: memoria → DB → autenticar de nuevo.
 */
export async function getGarminSession(userId: string): Promise<string> {
  // 1. Cache en memoria
  if (_memSession && _memSessionExp && _memSessionExp > new Date()) {
    return _memSession;
  }

  // 2. DB cache
  const settings = await db.userSettings.findUnique({ where: { userId } });
  if (
    settings?.garminSessionKey &&
    settings?.garminSessionExp &&
    settings.garminSessionExp > new Date()
  ) {
    _memSession = settings.garminSessionKey;
    _memSessionExp = settings.garminSessionExp;
    return _memSession;
  }

  // 3. Autenticar con SSO
  const email = process.env.GARMIN_EMAIL;
  const password = process.env.GARMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Variables de entorno GARMIN_EMAIL y GARMIN_PASSWORD no configuradas. " +
        "Completalas en .env.local para habilitar la sincronización con Garmin."
    );
  }

  const session = await authenticateGarminSSO(email, password);
  const expiry = new Date(Date.now() + SESSION_TTL_MS);

  // Guardar en DB
  await db.userSettings.upsert({
    where: { userId },
    update: { garminSessionKey: session, garminSessionExp: expiry },
    create: {
      userId,
      garminSessionKey: session,
      garminSessionExp: expiry,
    },
  });

  _memSession = session;
  _memSessionExp = expiry;
  return session;
}

/**
 * Invalidar sesión (en error 401 o manualmente).
 */
export async function invalidateGarminSession(userId: string): Promise<void> {
  _memSession = null;
  _memSessionExp = null;
  await db.userSettings.update({
    where: { userId },
    data: { garminSessionKey: null, garminSessionExp: null },
  });
}

/**
 * Flujo SSO de Garmin Connect (no oficial).
 *
 * Paso 1: GET embed form → obtener CSRF token
 * Paso 2: POST login con credenciales + CSRF
 * Paso 3: Canjear ticket por cookies de sesión
 */
async function authenticateGarminSSO(
  email: string,
  password: string
): Promise<string> {
  const UA =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

  // Paso 1: GET embed para obtener CSRF
  const embedRes = await fetch(`${GARMIN_SSO_URL}/embed?${SSO_PARAMS}`, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "es-AR,es;q=0.9",
    },
  });

  if (!embedRes.ok) {
    throw new Error(`Garmin SSO embed falló: ${embedRes.status}`);
  }

  const embedHtml = await embedRes.text();
  const csrfMatch = embedHtml.match(/name="_csrf"\s+value="([^"]+)"/);
  if (!csrfMatch) {
    throw new Error(
      "No se pudo extraer el CSRF token del formulario Garmin. " +
        "La estructura del SSO puede haber cambiado."
    );
  }

  const csrf = csrfMatch[1];
  const step1Cookies = extractCookies(embedRes);

  // Paso 2: POST con credenciales
  const loginBody = new URLSearchParams({
    username: email,
    password,
    embed: "true",
    _csrf: csrf,
    id: "gauth-widget",
    gauthHost: GARMIN_SSO_URL,
    service: `${GARMIN_CONNECT_URL}/modern/`,
    source: `${GARMIN_CONNECT_URL}/signin/`,
    redirectAfterAccountLoginUrl: `${GARMIN_CONNECT_URL}/modern/`,
    redirectAfterAccountCreationUrl: `${GARMIN_CONNECT_URL}/modern/`,
  });

  const loginRes = await fetch(`${GARMIN_SSO_URL}/signin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": UA,
      Cookie: step1Cookies,
      Origin: GARMIN_SSO_URL,
      Referer: `${GARMIN_SSO_URL}/embed?${SSO_PARAMS}`,
    },
    body: loginBody.toString(),
    redirect: "manual",
  });

  const step2Cookies = extractCookies(loginRes);
  const combinedCookies = mergeCookieStrings(step1Cookies, step2Cookies);

  // Extraer ticket
  let ticket = "";
  const locationHeader = loginRes.headers.get("location") ?? "";
  const ticketFromLocation = locationHeader.match(/ticket=([^&"]+)/);
  if (ticketFromLocation) {
    ticket = ticketFromLocation[1];
  } else {
    // Intentar desde el HTML embebido
    const loginHtml = await loginRes.text();
    const ticketFromHtml = loginHtml.match(/ticket=([A-Z0-9-]+)/);
    if (ticketFromHtml) ticket = ticketFromHtml[1];
  }

  if (!ticket) {
    throw new Error(
      "Autenticación Garmin fallida. Verificá que GARMIN_EMAIL y GARMIN_PASSWORD son correctos. " +
        "Si recientemente cambiaste la contraseña, actualizá las variables de entorno."
    );
  }

  // Paso 3: canjear ticket por sesión de Connect
  const ticketRes = await fetch(
    `${GARMIN_CONNECT_URL}/modern/?ticket=${ticket}`,
    {
      headers: {
        "User-Agent": UA,
        Cookie: combinedCookies,
      },
      redirect: "manual",
    }
  );

  const step3Cookies = extractCookies(ticketRes);
  const finalCookies = mergeCookieStrings(combinedCookies, step3Cookies);

  if (
    !finalCookies.includes("GARMIN-SSO") &&
    !finalCookies.includes("SESSIONID") &&
    !finalCookies.includes("connect.garmin")
  ) {
    throw new Error(
      "Sesión Garmin no obtenida. El protocolo SSO puede haber cambiado."
    );
  }

  return finalCookies;
}

// --- API calls ---

/**
 * Obtener displayName del usuario (requerido para algunos endpoints de Garmin).
 */
async function getGarminDisplayName(session: string): Promise<string> {
  const res = await fetch(
    `${GARMIN_CONNECT_URL}/proxy/userprofile-service/socialProfile`,
    {
      headers: {
        Cookie: session,
        NK: "NT",
        "User-Agent": "Mozilla/5.0",
        "DI-Backend": "connectapi.garmin.com",
      },
    }
  );

  if (!res.ok) {
    throw new Error(`No se pudo obtener el perfil de Garmin: ${res.status}`);
  }

  const json = (await res.json()) as Record<string, unknown>;
  return (json.displayName as string) ?? (json.userName as string) ?? "user";
}

/**
 * Obtener datos de sueño para una fecha.
 * @param userId — para obtener la sesión y regenerarla si expira
 * @param date — "YYYY-MM-DD"
 * @param retrying — internal flag para evitar recursión infinita en 401
 */
export async function fetchGarminSleepData(
  userId: string,
  date: string,
  retrying = false
): Promise<GarminSleepData | null> {
  const session = await getGarminSession(userId);

  let displayName: string;
  try {
    displayName = await getGarminDisplayName(session);
  } catch {
    if (!retrying) {
      await invalidateGarminSession(userId);
      return fetchGarminSleepData(userId, date, true);
    }
    throw new Error("No se pudo autenticar con Garmin después de reintentar.");
  }

  const url =
    `${GARMIN_CONNECT_URL}/proxy/wellness-service/wellness/dailySleepData/${displayName}` +
    `?date=${date}&nonSleepBufferMinutes=60`;

  const res = await fetch(url, {
    headers: {
      Cookie: session,
      NK: "NT",
      "User-Agent": "Mozilla/5.0",
      "DI-Backend": "connectapi.garmin.com",
      Accept: "application/json",
    },
  });

  if (res.status === 401 && !retrying) {
    await invalidateGarminSession(userId);
    return fetchGarminSleepData(userId, date, true);
  }

  if (res.status === 204 || res.status === 404) {
    return null; // Sin datos para esta fecha
  }

  if (!res.ok) {
    throw new Error(`Garmin wellness API error: ${res.status}`);
  }

  const json = await res.json();
  return parseGarminSleepResponse(json);
}

/**
 * Parsear respuesta de Garmin al tipo interno GarminSleepData.
 */
function parseGarminSleepResponse(raw: unknown): GarminSleepData | null {
  const data = raw as Record<string, unknown>;
  const dto = data?.dailySleepDTO as Record<string, unknown> | undefined;
  if (!dto) return null;

  const startMs = dto.sleepStartTimestampGMT as number | undefined;
  const endMs = dto.sleepEndTimestampGMT as number | undefined;
  if (!startMs || !endMs) return null;

  const scores = dto.sleepScores as
    | Record<string, Record<string, number>>
    | undefined;
  const overallScore =
    (scores?.overall?.value as number | undefined) ??
    (dto.sleepScore as number | undefined) ??
    null;

  return {
    date: dto.calendarDate as string,
    startTimeGMT: new Date(startMs),
    endTimeGMT: new Date(endMs),
    durationSeconds: (dto.sleepTimeSeconds as number) ?? 0,
    deepSleepSeconds: (dto.deepSleepSeconds as number) ?? 0,
    lightSleepSeconds: (dto.lightSleepSeconds as number) ?? 0,
    remSleepSeconds: (dto.remSleepSeconds as number) ?? 0,
    awakeSleepSeconds: (dto.awakeSleepSeconds as number) ?? 0,
    overallScore: overallScore !== null ? Math.round(overallScore) : null,
    stressScore: (dto.averageStressLevel as number | undefined) ?? null,
    spo2Avg: (dto.averageSpO2Value as number | undefined) ?? null,
    respirationAvg: (dto.averageRespirationValue as number | undefined) ?? null,
    bodyBatteryChange: (dto.bodyBatteryChange as number | undefined) ?? null,
  };
}

// --- Sync ---

/**
 * Sincronizar datos de Garmin para un rango de fechas y guardarlos en DB.
 */
export async function syncGarminSleepRange(
  userId: string,
  from: Date,
  to: Date
): Promise<{ synced: number; errors: number; skipped: number }> {
  let synced = 0;
  let errors = 0;
  let skipped = 0;

  const current = new Date(from);
  while (current <= to) {
    const dateStr = current.toISOString().split("T")[0];
    try {
      const data = await fetchGarminSleepData(userId, dateStr);
      if (data) {
        await upsertSleepFromGarmin(userId, data);
        synced++;
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`Error sync Garmin sleep ${dateStr}:`, err);
      errors++;
    }
    current.setDate(current.getDate() + 1);
    // Rate limiting — Garmin no tiene límite documentado pero ser respetuoso
    await new Promise((r) => setTimeout(r, 300));
  }

  return { synced, errors, skipped };
}

/**
 * Guardar / actualizar un SleepLog con datos de Garmin.
 * Si el usuario ya registró manualmente, solo actualiza los campos de Garmin
 * (preserva bedTime/wakeTime manuales si ya existen).
 */
export async function upsertSleepFromGarmin(
  userId: string,
  data: GarminSleepData
): Promise<void> {
  const date = new Date(data.date + "T00:00:00.000Z");
  const durationMinutes = Math.round(data.durationSeconds / 60);

  const existing = await db.sleepLog.findUnique({
    where: { userId_date: { userId, date } },
  });

  if (existing) {
    // Merge: preservar bedTime/wakeTime manuales, solo agregar datos Garmin
    await db.sleepLog.update({
      where: { userId_date: { userId, date } },
      data: {
        // Actualizar tiempos solo si no hay registro manual
        bedTime: existing.bedTime ?? data.startTimeGMT,
        wakeTime: existing.wakeTime ?? data.endTimeGMT,
        durationMinutes: durationMinutes,
        garminSleepId: data.date,
        garminScore: data.overallScore ?? undefined,
        deepSleepMinutes: Math.round(data.deepSleepSeconds / 60),
        lightSleepMinutes: Math.round(data.lightSleepSeconds / 60),
        remSleepMinutes: Math.round(data.remSleepSeconds / 60),
        awakeMinutes: Math.round(data.awakeSleepSeconds / 60),
        stressScore: data.stressScore ?? undefined,
        spo2Avg: data.spo2Avg ?? undefined,
        respirationAvg: data.respirationAvg ?? undefined,
        bodyBatteryChange: data.bodyBatteryChange ?? undefined,
      },
    });
  } else {
    await db.sleepLog.create({
      data: {
        userId,
        date,
        bedTime: data.startTimeGMT,
        wakeTime: data.endTimeGMT,
        durationMinutes,
        garminSleepId: data.date,
        garminScore: data.overallScore ?? undefined,
        deepSleepMinutes: Math.round(data.deepSleepSeconds / 60),
        lightSleepMinutes: Math.round(data.lightSleepSeconds / 60),
        remSleepMinutes: Math.round(data.remSleepSeconds / 60),
        awakeMinutes: Math.round(data.awakeSleepSeconds / 60),
        stressScore: data.stressScore ?? undefined,
        spo2Avg: data.spo2Avg ?? undefined,
        respirationAvg: data.respirationAvg ?? undefined,
        bodyBatteryChange: data.bodyBatteryChange ?? undefined,
      },
    });
  }
}

/**
 * Verificar estado de la conexión con Garmin.
 */
export async function checkGarminStatus(userId: string): Promise<GarminStatus> {
  const hasCredentials = !!(
    process.env.GARMIN_EMAIL && process.env.GARMIN_PASSWORD
  );

  if (!hasCredentials) {
    return {
      connected: false,
      sessionValid: false,
      lastSync: null,
      error:
        "Variables GARMIN_EMAIL y GARMIN_PASSWORD no configuradas en .env.local",
    };
  }

  const settings = await db.userSettings.findUnique({ where: { userId } });
  const sessionValid = !!(
    settings?.garminSessionKey &&
    settings?.garminSessionExp &&
    settings.garminSessionExp > new Date()
  );

  // Última sincronización = última sesión renovada
  const lastSync = settings?.garminSessionExp
    ? new Date(settings.garminSessionExp.getTime() - SESSION_TTL_MS)
    : null;

  return {
    connected: hasCredentials,
    sessionValid,
    lastSync,
  };
}

// ============================================================
// ACTIVIDADES (Fitness — Sesión 4)
// ============================================================

/** Tipo de actividad Garmin mapeado a nuestro WorkoutType */
export type GarminActivityData = {
  garminActivityId: string;
  date: Date;
  title: string;
  type: "GYM" | "RUNNING" | "SWIMMING" | "WALKING" | "CYCLING" | "OTHER";
  durationSeconds: number;
  distanceMeters: number | null;
  calories: number | null;
  steps: number | null;
  startTimeGMT: Date;
};

const GARMIN_ACTIVITY_TYPE_MAP: Record<
  string,
  "GYM" | "RUNNING" | "SWIMMING" | "WALKING" | "CYCLING" | "OTHER"
> = {
  swimming: "SWIMMING",
  lap_swimming: "SWIMMING",
  pool_swimming: "SWIMMING",
  open_water_swimming: "SWIMMING",
  running: "RUNNING",
  trail_running: "RUNNING",
  treadmill_running: "RUNNING",
  virtual_run: "RUNNING",
  walking: "WALKING",
  hiking: "WALKING",
  casual_walking: "WALKING",
  cycling: "CYCLING",
  road_biking: "CYCLING",
  indoor_cycling: "CYCLING",
  strength_training: "GYM",
  indoor_cardio: "GYM",
  fitness_equipment: "GYM",
  yoga: "OTHER",
  other: "OTHER",
};

/**
 * Obtener actividades de Garmin para una fecha dada.
 * Endpoint: /proxy/activitylist-service/activities/search/activities
 */
export async function fetchGarminActivities(
  userId: string,
  date: string,
  retrying = false
): Promise<GarminActivityData[]> {
  const session = await getGarminSession(userId);

  const url =
    `${GARMIN_CONNECT_URL}/proxy/activitylist-service/activities/search/activities` +
    `?startDate=${date}&endDate=${date}&start=0&limit=20`;

  const res = await fetch(url, {
    headers: {
      Cookie: session,
      NK: "NT",
      "User-Agent": "Mozilla/5.0",
      "DI-Backend": "connectapi.garmin.com",
      Accept: "application/json",
    },
  });

  if (res.status === 401 && !retrying) {
    await invalidateGarminSession(userId);
    return fetchGarminActivities(userId, date, true);
  }

  if (res.status === 204 || res.status === 404) return [];

  if (!res.ok) {
    throw new Error(`Garmin activities API error: ${res.status}`);
  }

  const json = await res.json();
  if (!Array.isArray(json)) return [];

  return json
    .map((item: Record<string, unknown>) => parseGarminActivity(item))
    .filter((a): a is GarminActivityData => a !== null);
}

function parseGarminActivity(
  item: Record<string, unknown>
): GarminActivityData | null {
  const id = item.activityId;
  if (!id) return null;

  const typeKey =
    ((item.activityType as Record<string, unknown>)?.typeKey as string) ??
    "other";
  const type = GARMIN_ACTIVITY_TYPE_MAP[typeKey] ?? "OTHER";

  const startTimeStr = item.startTimeGMT as string | undefined;
  if (!startTimeStr) return null;

  const startTimeGMT = new Date(startTimeStr.replace(" ", "T") + "Z");

  return {
    garminActivityId: String(id),
    date: startTimeGMT,
    title: (item.activityName as string) ?? type,
    type,
    durationSeconds: Math.round((item.duration as number) ?? 0),
    distanceMeters: (item.distance as number) ?? null,
    calories: (item.calories as number) ?? null,
    steps: (item.steps as number) ?? null,
    startTimeGMT,
  };
}

// --- Utils internos ---

function extractCookies(res: Response): string {
  // En Node.js / Edge Runtime, headers.getSetCookie() puede no estar disponible
  const setCookie = res.headers.get("set-cookie") ?? "";
  // Si viene como string único separado por coma, parsear manualmente
  return setCookie
    .split(/,(?=[^ ][^;]*=)/)
    .map((c) => c.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

function mergeCookieStrings(...parts: string[]): string {
  const map = new Map<string, string>();
  for (const part of parts) {
    if (!part) continue;
    for (const cookie of part.split("; ")) {
      const [key] = cookie.split("=");
      if (key) map.set(key.trim(), cookie.trim());
    }
  }
  return Array.from(map.values()).join("; ");
}

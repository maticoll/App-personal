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

import crypto from "crypto";
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

// connectapi NO está bloqueado por Cloudflare (sí lo está sso.garmin.com, el login).
const CONNECTAPI_URL = "https://connectapi.garmin.com";

// Consumer OAuth público de Garmin (el mismo de garth/garminconnect). Es público.
// Sobreescribible por env si Garmin lo rota.
const OAUTH_CONSUMER_KEY =
  process.env.GARMIN_OAUTH_CONSUMER_KEY ?? "fc3e99d2-118c-44b8-8ae3-03370dde24c0";
const OAUTH_CONSUMER_SECRET =
  process.env.GARMIN_OAUTH_CONSUMER_SECRET ?? "E08WAR897WEy2knn7aFBrvegVAf0AFdWBBF";

// User-Agent aceptado por connectapi (app mobile de Garmin)
const GARMIN_UA = "com.garmin.android.apps.connectmobile";

// Margen para refrescar el access token antes de que expire
const ACCESS_TOKEN_BUFFER_MS = 5 * 60 * 1000;

// Cache en memoria del access token OAuth2 (se pierde al reiniciar el proceso)
let _memAccessToken: string | null = null;
let _memAccessExp: Date | null = null;

// --- OAuth 1.0a signing (HMAC-SHA1) ---

function rfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

/**
 * Header Authorization OAuth 1.0a para connectapi. Incluye en la firma los
 * query params de la URL + los oauth_*.
 */
function buildOAuth1Header(
  method: string,
  url: string,
  token?: string,
  tokenSecret?: string
): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: OAUTH_CONSUMER_KEY,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: "1.0",
  };
  if (token) oauth.oauth_token = token;

  const u = new URL(url);
  const all: Record<string, string> = {};
  u.searchParams.forEach((v, k) => {
    all[k] = v;
  });
  Object.assign(all, oauth);

  const paramString = Object.keys(all)
    .sort()
    .map((k) => `${rfc3986(k)}=${rfc3986(all[k])}`)
    .join("&");
  const baseString = `${method.toUpperCase()}&${rfc3986(
    u.origin + u.pathname
  )}&${rfc3986(paramString)}`;
  const signingKey = `${rfc3986(OAUTH_CONSUMER_SECRET)}&${rfc3986(
    tokenSecret ?? ""
  )}`;
  oauth.oauth_signature = crypto
    .createHmac("sha1", signingKey)
    .update(baseString)
    .digest("base64");

  return (
    "OAuth " +
    Object.keys(oauth)
      .map((k) => `${rfc3986(k)}="${rfc3986(oauth[k])}"`)
      .join(", ")
  );
}

/**
 * Intercambia el token OAuth1 (durable ~1 año) por un access token OAuth2 (corto).
 * Corre en Vercel: connectapi.garmin.com NO está bloqueado por Cloudflare.
 */
async function exchangeOAuth1ForOAuth2(
  oauth1Token: string,
  oauth1Secret: string
): Promise<{ accessToken: string; expiresInSec: number }> {
  const url = `${CONNECTAPI_URL}/oauth-service/oauth/exchange/user/2.0`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: buildOAuth1Header("POST", url, oauth1Token, oauth1Secret),
      "User-Agent": GARMIN_UA,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Garmin OAuth2 exchange falló (${res.status}). ` +
        (res.status === 401
          ? "El token OAuth de Garmin expiró o se revocó — re-vinculá ejecutando " +
            "`node scripts/garmin-refresh-session.mjs` en tu PC."
          : body.slice(0, 200))
    );
  }

  const json = (await res.json()) as Record<string, unknown>;
  const accessToken = json.access_token as string | undefined;
  if (!accessToken) {
    throw new Error("Garmin OAuth2 exchange no devolvió access_token");
  }
  return {
    accessToken,
    expiresInSec: (json.expires_in as number | undefined) ?? 3600,
  };
}

// --- Auth (OAuth) ---

/**
 * Devuelve un access token OAuth2 válido.
 * Prioridad: memoria → DB (si no expiró) → re-mintear desde el OAuth1 token.
 */
export async function ensureGarminAccessToken(userId: string): Promise<string> {
  const now = Date.now();

  if (
    _memAccessToken &&
    _memAccessExp &&
    _memAccessExp.getTime() > now + ACCESS_TOKEN_BUFFER_MS
  ) {
    return _memAccessToken;
  }

  const settings = await db.userSettings.findUnique({ where: { userId } });

  if (
    settings?.garminOauth2Token &&
    settings?.garminOauth2Exp &&
    settings.garminOauth2Exp.getTime() > now + ACCESS_TOKEN_BUFFER_MS
  ) {
    _memAccessToken = settings.garminOauth2Token;
    _memAccessExp = settings.garminOauth2Exp;
    return _memAccessToken;
  }

  if (!settings?.garminOauth1Token || !settings?.garminOauth1Secret) {
    throw new Error(
      "Garmin no está vinculado por OAuth. Ejecutá `node scripts/garmin-refresh-session.mjs` " +
        "en tu PC para vincular la cuenta (login una vez)."
    );
  }

  const { accessToken, expiresInSec } = await exchangeOAuth1ForOAuth2(
    settings.garminOauth1Token,
    settings.garminOauth1Secret
  );
  const exp = new Date(now + expiresInSec * 1000);

  await db.userSettings.update({
    where: { userId },
    data: { garminOauth2Token: accessToken, garminOauth2Exp: exp },
  });

  _memAccessToken = accessToken;
  _memAccessExp = exp;
  return accessToken;
}

/**
 * GET autenticado contra connectapi.garmin.com con Bearer.
 * Maneja el 401 re-minteando el token una vez.
 */
async function garminApiGet(
  userId: string,
  path: string,
  retrying = false
): Promise<Response> {
  const token = await ensureGarminAccessToken(userId);
  const res = await fetch(`${CONNECTAPI_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": GARMIN_UA,
      Accept: "application/json",
      "DI-Backend": "connectapi.garmin.com",
    },
  });

  if (res.status === 401 && !retrying) {
    _memAccessToken = null;
    _memAccessExp = null;
    await db.userSettings
      .update({
        where: { userId },
        data: { garminOauth2Token: null, garminOauth2Exp: null },
      })
      .catch(() => {});
    return garminApiGet(userId, path, true);
  }

  return res;
}

/**
 * Guardar los tokens OAuth de Garmin obtenidos desde el script local.
 *
 * El login pasa por Cloudflare (bloqueado en Vercel), así que corre en la PC:
 * `scripts/garmin-refresh-session.mjs` loguea, intercambia el ticket por tokens
 * OAuth y los postea a `/api/fitness/garmin-session`, que llama a esta función.
 */
export async function saveGarminOAuth(
  userId: string,
  tokens: {
    oauth1Token: string;
    oauth1Secret: string;
    oauth2Token?: string;
    oauth2Exp?: Date;
  }
): Promise<void> {
  await db.userSettings.upsert({
    where: { userId },
    update: {
      garminOauth1Token: tokens.oauth1Token,
      garminOauth1Secret: tokens.oauth1Secret,
      garminOauth2Token: tokens.oauth2Token ?? null,
      garminOauth2Exp: tokens.oauth2Exp ?? null,
    },
    create: {
      userId,
      garminOauth1Token: tokens.oauth1Token,
      garminOauth1Secret: tokens.oauth1Secret,
      garminOauth2Token: tokens.oauth2Token ?? null,
      garminOauth2Exp: tokens.oauth2Exp ?? null,
    },
  });

  if (tokens.oauth2Token && tokens.oauth2Exp) {
    _memAccessToken = tokens.oauth2Token;
    _memAccessExp = tokens.oauth2Exp;
  } else {
    _memAccessToken = null;
    _memAccessExp = null;
  }
}

/**
 * Desvincular Garmin / invalidar el access token cacheado.
 * Mantiene el OAuth1 token (durable) salvo que se pida `full`.
 */
export async function invalidateGarminSession(
  userId: string,
  full = false
): Promise<void> {
  _memAccessToken = null;
  _memAccessExp = null;
  await db.userSettings.update({
    where: { userId },
    data: {
      garminOauth2Token: null,
      garminOauth2Exp: null,
      ...(full && { garminOauth1Token: null, garminOauth1Secret: null }),
    },
  });
}

// --- API calls ---

/**
 * Obtener displayName del usuario (requerido para algunos endpoints de Garmin).
 */
async function getGarminDisplayName(userId: string): Promise<string> {
  const res = await garminApiGet(userId, "/userprofile-service/socialProfile");
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
  date: string
): Promise<GarminSleepData | null> {
  const displayName = await getGarminDisplayName(userId);

  const res = await garminApiGet(
    userId,
    `/wellness-service/wellness/dailySleepData/${displayName}` +
      `?date=${date}&nonSleepBufferMinutes=60`
  );

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
 * "Conectado" = hay un OAuth1 token guardado (vinculado desde la PC).
 */
export async function checkGarminStatus(userId: string): Promise<GarminStatus> {
  const settings = await db.userSettings.findUnique({ where: { userId } });

  const hasOAuth = !!(settings?.garminOauth1Token && settings?.garminOauth1Secret);

  if (!hasOAuth) {
    return {
      connected: false,
      sessionValid: false,
      lastSync: null,
      error:
        "Garmin no vinculado. Ejecutá `node scripts/garmin-refresh-session.mjs` en tu PC.",
    };
  }

  // El access token OAuth2 se renueva solo; lo consideramos válido si hay OAuth1.
  return {
    connected: true,
    sessionValid: true,
    lastSync: settings?.updatedAt ?? null,
  };
}

// ============================================================
// ACTIVIDADES (Fitness — Sesión 4)
// ============================================================

export type GarminActivityMetrics = {
  hrZones?: number[];          // [z1..z5] segundos
  vo2Max?: number;
  strideLengthCm?: number;
  poolLengthM?: number;
  activeLengths?: number;
  avgSwolf?: number;
  strokes?: number;
  swimCadence?: number;
};

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
  // nuevos
  avgHr: number | null;
  maxHr: number | null;
  elevationGainM: number | null;
  avgSpeedMps: number | null;
  maxSpeedMps: number | null;
  movingSeconds: number | null;
  cadence: number | null;       // running spm
  locationName: string | null;
  metrics: GarminActivityMetrics | null;
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
  resort_snowboarding: "OTHER",
  resort_skiing: "OTHER",
  backcountry_snowboarding: "OTHER",
  mountain_biking: "CYCLING",
  gravel_cycling: "CYCLING",
  cyclocross: "CYCLING",
  elliptical: "GYM",
  stair_climbing: "GYM",
  other: "OTHER",
};

/**
 * Obtener actividades de Garmin para una fecha dada.
 * Endpoint: /activitylist-service/activities/search/activities (connectapi, Bearer)
 */
export async function fetchGarminActivities(
  userId: string,
  date: string
): Promise<GarminActivityData[]> {
  const res = await garminApiGet(
    userId,
    `/activitylist-service/activities/search/activities` +
      `?startDate=${date}&endDate=${date}&start=0&limit=20`
  );

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
    ((item.activityType as Record<string, unknown>)?.typeKey as string) ?? "other";
  const type = GARMIN_ACTIVITY_TYPE_MAP[typeKey] ?? "OTHER";

  const startTimeStr = item.startTimeGMT as string | undefined;
  if (!startTimeStr) return null;
  const startTimeGMT = new Date(startTimeStr.replace(" ", "T") + "Z");

  const num = (k: string): number | null => {
    const v = item[k];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };

  const zones = [1, 2, 3, 4, 5].map((z) => num(`hrTimeInZone_${z}`) ?? 0);
  const hasZones = zones.some((z) => z > 0);

  const metrics: GarminActivityMetrics = {};
  if (hasZones) metrics.hrZones = zones;
  if (num("vO2MaxValue") !== null) metrics.vo2Max = num("vO2MaxValue")!;
  if (num("avgStrideLength") !== null) metrics.strideLengthCm = num("avgStrideLength")!;
  if (num("poolLength") !== null) metrics.poolLengthM = num("poolLength")!;
  if (num("activeLengths") !== null) metrics.activeLengths = num("activeLengths")!;
  if (num("averageSwolf") !== null) metrics.avgSwolf = num("averageSwolf")!;
  if (num("strokes") !== null) metrics.strokes = num("strokes")!;
  if (num("averageSwimCadenceInStrokesPerMinute") !== null)
    metrics.swimCadence = num("averageSwimCadenceInStrokesPerMinute")!;

  return {
    garminActivityId: String(id),
    date: startTimeGMT,
    title: (item.activityName as string) ?? type,
    type,
    durationSeconds: Math.round((item.duration as number) ?? 0),
    distanceMeters: num("distance"),
    calories: num("calories"),
    steps: num("steps"),
    startTimeGMT,
    avgHr: num("averageHR"),
    maxHr: num("maxHR"),
    elevationGainM: num("elevationGain") !== null ? Math.round(num("elevationGain")!) : null,
    avgSpeedMps: num("averageSpeed"),
    maxSpeedMps: num("maxSpeed"),
    movingSeconds: num("movingDuration") !== null ? Math.round(num("movingDuration")!) : null,
    cadence: num("averageRunningCadenceInStepsPerMinute"),
    locationName: (item.locationName as string) ?? null,
    metrics: Object.keys(metrics).length ? metrics : null,
  };
}

// ============================================================
// PASOS DIARIOS (Fitness)
// ============================================================

export type GarminDailySteps = {
  date: string; // "YYYY-MM-DD"
  totalSteps: number;
  dailyStepGoal: number | null;
};

/**
 * Obtener el total de pasos del día desde el resumen diario de Garmin.
 * Endpoint: /proxy/usersummary-service/usersummary/daily/{displayName}?calendarDate=YYYY-MM-DD
 * Devuelve null si no hay datos para la fecha.
 */
export async function fetchGarminDailySteps(
  userId: string,
  date: string
): Promise<GarminDailySteps | null> {
  const displayName = await getGarminDisplayName(userId);

  const res = await garminApiGet(
    userId,
    `/usersummary-service/usersummary/daily/${displayName}?calendarDate=${date}`
  );

  if (res.status === 204 || res.status === 404) return null;

  if (!res.ok) {
    throw new Error(`Garmin usersummary API error: ${res.status}`);
  }

  const json = (await res.json()) as Record<string, unknown>;
  const totalSteps = json.totalSteps as number | null | undefined;
  if (totalSteps === null || totalSteps === undefined) return null;

  return {
    date,
    totalSteps: Math.round(totalSteps),
    dailyStepGoal: (json.dailyStepGoal as number | undefined) ?? null,
  };
}

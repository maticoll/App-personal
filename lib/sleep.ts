// ============================================================
// lib/sleep.ts — Lógica de negocio del módulo de Sueño
// Sesión 3
// ============================================================

import { db } from "@/lib/db";
import { uyDayDate, addDays, currentHourUY } from "@/lib/dates";
import type { SleepSummary } from "@/lib/types";

// --- Tipos ---

export type SleepLogEntry = {
  id: string;
  date: Date;
  bedTime: Date;
  wakeTime: Date | null;
  durationMinutes: number | null;
  garminScore: number | null;
  deepSleepMinutes: number | null;
  lightSleepMinutes: number | null;
  remSleepMinutes: number | null;
  awakeMinutes: number | null;
  stressScore: number | null;
  spo2Avg: number | null;
  respirationAvg: number | null;
  bodyBatteryChange: number | null;
  notes: string | null;
  flexible: boolean;
};

export type LogSleepInput = {
  userId: string;
  date?: Date;
  bedTime: Date;
  wakeTime?: Date;
  notes?: string;
  flexible?: boolean;
};

export type WeeklyStats = {
  avgDurationMinutes: number | null;
  daysInIdealRange: number;
  daysInAcceptableRange: number;
  avgGarminScore: number | null;
  streak: number;
  totalDays: number;
};

// --- Queries ---

/**
 * Sueño de hoy (la fecha de "hoy" = el día de despertar)
 */
export async function getTodaySleep(
  userId: string,
): Promise<SleepLogEntry | null> {
  const today = getToday();
  const log = await db.sleepLog.findUnique({
    where: { userId_date: { userId, date: today } },
  });
  return log ? mapSleepLog(log) : null;
}

/**
 * Sleep log de ayer (para el agente cuando el usuario pregunta por "anoche")
 */
export async function getSleepYesterday(
  userId: string,
): Promise<SleepLogEntry | null> {
  const yesterday = addDays(getToday(), -1);
  const log = await db.sleepLog.findUnique({
    where: { userId_date: { userId, date: yesterday } },
  });
  return log ? mapSleepLog(log) : null;
}

/**
 * Historial de sueño de los últimos N días
 */
export async function getSleepHistory(
  userId: string,
  days = 14,
): Promise<SleepLogEntry[]> {
  const from = addDays(getToday(), -days);

  const logs = await db.sleepLog.findMany({
    where: { userId, date: { gte: from } },
    orderBy: { date: "asc" },
  });

  return logs.map(mapSleepLog);
}

/**
 * Registro pendiente — bedTime sin wakeTime en las últimas 20h.
 * Si existe, el flujo está en "modo despertar".
 */
export async function getPendingSleepLog(
  userId: string,
): Promise<SleepLogEntry | null> {
  const cutoff = new Date(Date.now() - 20 * 60 * 60 * 1000);
  const log = await db.sleepLog.findFirst({
    where: {
      userId,
      wakeTime: null,
      flexible: false,
      bedTime: { gte: cutoff },
    },
    orderBy: { bedTime: "desc" },
  });
  return log ? mapSleepLog(log) : null;
}

// --- Mutations ---

/**
 * Registrar hora de dormir (primer paso del flujo de dos pasos).
 * La "fecha" del registro es el día en que el usuario se va a despertar.
 */
export async function logBedTime(
  userId: string,
  bedTime: Date,
  options?: { notes?: string; flexible?: boolean },
): Promise<SleepLogEntry> {
  const date = getDateForSleep(bedTime);

  const log = await db.sleepLog.upsert({
    where: { userId_date: { userId, date } },
    update: {
      bedTime,
      notes: options?.notes ?? undefined,
      flexible: options?.flexible ?? false,
    },
    create: {
      userId,
      date,
      bedTime,
      notes: options?.notes ?? null,
      flexible: options?.flexible ?? false,
    },
  });

  return mapSleepLog(log);
}

/**
 * Registrar hora de despertar (segundo paso del flujo).
 * Busca el registro pendiente más reciente y le agrega el wakeTime.
 */
export async function logWakeTime(
  userId: string,
  wakeTime: Date,
): Promise<SleepLogEntry> {
  const cutoff = new Date(Date.now() - 20 * 60 * 60 * 1000);

  const existingLog = await db.sleepLog.findFirst({
    where: {
      userId,
      wakeTime: null,
      bedTime: { gte: cutoff },
    },
    orderBy: { bedTime: "desc" },
  });

  if (!existingLog) {
    throw new Error(
      "No hay registro de hora de dormir activo. Registrá primero cuándo te fuiste a dormir.",
    );
  }

  const durationMinutes = Math.round(
    (wakeTime.getTime() - existingLog.bedTime.getTime()) / (1000 * 60),
  );

  const log = await db.sleepLog.update({
    where: { id: existingLog.id },
    data: { wakeTime, durationMinutes },
  });

  return mapSleepLog(log);
}

/**
 * Upsert completo — para el formulario manual o edición.
 */
export async function upsertSleepLog(
  input: LogSleepInput,
): Promise<SleepLogEntry> {
  const { userId } = input;
  const date = input.date ?? getToday();

  let durationMinutes: number | undefined;
  if (input.wakeTime) {
    const ms = input.wakeTime.getTime() - input.bedTime.getTime();
    durationMinutes = Math.round(ms / (1000 * 60));
  }

  const log = await db.sleepLog.upsert({
    where: { userId_date: { userId, date } },
    update: {
      bedTime: input.bedTime,
      wakeTime: input.wakeTime ?? null,
      durationMinutes: durationMinutes ?? null,
      notes: input.notes ?? null,
      flexible: input.flexible ?? false,
    },
    create: {
      userId,
      date,
      bedTime: input.bedTime,
      wakeTime: input.wakeTime ?? null,
      durationMinutes: durationMinutes ?? null,
      notes: input.notes ?? null,
      flexible: input.flexible ?? false,
    },
  });

  return mapSleepLog(log);
}

/**
 * Eliminar un registro de sueño (verifica ownership).
 */
export async function deleteSleepLog(
  userId: string,
  id: string,
): Promise<void> {
  const log = await db.sleepLog.findUnique({ where: { id } });
  if (!log || log.userId !== userId) {
    throw new Error("Registro no encontrado");
  }
  await db.sleepLog.delete({ where: { id } });
}

// --- Stats ---

/**
 * Estadísticas semanales (últimos 7 días).
 */
export async function getWeeklyStats(userId: string): Promise<WeeklyStats> {
  const from = addDays(getToday(), -6);

  const logs = await db.sleepLog.findMany({
    where: { userId, date: { gte: from } },
    orderBy: { date: "desc" },
  });

  if (logs.length === 0) {
    return {
      avgDurationMinutes: null,
      daysInIdealRange: 0,
      daysInAcceptableRange: 0,
      avgGarminScore: null,
      streak: 0,
      totalDays: 0,
    };
  }

  const durations = logs
    .filter((l: any) => l.durationMinutes !== null)
    .map((l: any) => l.durationMinutes!);
  const garminScores = logs
    .filter((l: any) => l.garminScore !== null)
    .map((l: any) => l.garminScore!);

  const avgDurationMinutes =
    durations.length > 0
      ? Math.round(
          durations.reduce((a: any, b: any) => a + b, 0) / durations.length,
        )
      : null;

  const avgGarminScore =
    garminScores.length > 0
      ? Math.round(
          garminScores.reduce((a: any, b: any) => a + b, 0) /
            garminScores.length,
        )
      : null;

  let daysInIdealRange = 0;
  let daysInAcceptableRange = 0;
  for (const d of durations) {
    const h = d / 60;
    if (h >= 7 && h <= 9) daysInIdealRange++;
    else if (h >= 6 && h <= 10) daysInAcceptableRange++;
  }

  // Streak: días consecutivos con registro (hacia atrás desde hoy)
  let streak = 0;
  const today = getToday();
  for (let i = 0; i < 30; i++) {
    const d = addDays(today, -i);
    const dStr = d.toISOString().split("T")[0];
    const found = logs.find(
      (l: any) => l.date.toISOString().split("T")[0] === dStr,
    );
    if (found) streak++;
    else break;
  }

  return {
    avgDurationMinutes,
    daysInIdealRange,
    daysInAcceptableRange,
    avgGarminScore,
    streak,
    totalDays: logs.length,
  };
}

/**
 * Summary para el dashboard principal.
 */
export async function getTodaySleepSummary(
  userId: string,
): Promise<SleepSummary | null> {
  const log = await getTodaySleep(userId);
  if (!log) return null;

  return {
    date: log.date,
    durationMinutes: log.durationMinutes,
    quality: log.garminScore,
    bedTime: log.bedTime,
    wakeTime: log.wakeTime,
  };
}

// --- Helpers de fecha ---

/**
 * El "día del sueño" es el día en que el usuario se despierta.
 * Si se va a dormir a las 11 PM → el día es el siguiente.
 * Si se va a dormir a la 1 AM → el día es el mismo (ya es el día siguiente).
 */
export function getDateForSleep(bedTime: Date): Date {
  // Día calendario y hora evaluados en UY, no en el server (UTC): con
  // getHours() acostarse a las 22:00 UY (01:00 UTC) apuntaba al día
  // equivocado según la hora del server.
  const d = uyDayDate(bedTime);
  // Si son >= mediodía (hora UY) → la noche apunta al día siguiente
  if (currentHourUY(bedTime) >= 12) {
    return addDays(d, 1);
  }
  return d;
}

export function getToday(): Date {
  // Key de día = medianoche UTC del día calendario UY (ver lib/dates.ts).
  // Antes usaba setHours(0,0,0,0) del server: después de las 21:00 UY "hoy"
  // era mañana y el streak se cortaba todas las noches.
  return uyDayDate();
}

function mapSleepLog(log: {
  id: string;
  date: Date;
  bedTime: Date;
  wakeTime: Date | null;
  durationMinutes: number | null;
  garminScore: number | null;
  deepSleepMinutes: number | null;
  lightSleepMinutes: number | null;
  remSleepMinutes: number | null;
  awakeMinutes: number | null;
  stressScore: number | null;
  spo2Avg: number | null;
  respirationAvg: number | null;
  bodyBatteryChange: number | null;
  notes: string | null;
  flexible: boolean;
}): SleepLogEntry {
  return {
    id: log.id,
    date: log.date,
    bedTime: log.bedTime,
    wakeTime: log.wakeTime,
    durationMinutes: log.durationMinutes,
    garminScore: log.garminScore,
    deepSleepMinutes: log.deepSleepMinutes,
    lightSleepMinutes: log.lightSleepMinutes,
    remSleepMinutes: log.remSleepMinutes,
    awakeMinutes: log.awakeMinutes,
    stressScore: log.stressScore,
    spo2Avg: log.spo2Avg,
    respirationAvg: log.respirationAvg,
    bodyBatteryChange: log.bodyBatteryChange,
    notes: log.notes,
    flexible: log.flexible,
  };
}

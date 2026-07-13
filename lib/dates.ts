// ============================================================
// lib/dates.ts — Helpers de fecha en timezone Uruguay
//
// El servidor (Vercel) corre en UTC. Todo cálculo de "día" para el
// usuario debe hacerse en America/Montevideo, si no la app "vive
// corrida": después de las 21:00 UY ya es el día siguiente en UTC.
//
// Uruguay usa UTC-3 fijo (sin DST desde 2015), por eso el offset
// -03:00 hardcodeado es seguro.
// ============================================================

export const UY_TIMEZONE = "America/Montevideo";
export const UY_OFFSET = "-03:00";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Clave "YYYY-MM-DD" del día en Uruguay para un instante dado.
 * Usar SIEMPRE esto (y no toISOString().split("T")[0] ni toDateString())
 * para agrupar o persistir por día.
 */
export function uyDateKey(date: Date = new Date()): string {
  // en-CA formatea como YYYY-MM-DD
  return date.toLocaleDateString("en-CA", { timeZone: UY_TIMEZONE });
}

/**
 * Medianoche de Uruguay (00:00 UY = 03:00 UTC) del día en que cae `date`.
 */
export function startOfDayUY(date: Date = new Date()): Date {
  return new Date(`${uyDateKey(date)}T00:00:00${UY_OFFSET}`);
}

/**
 * Fin del día de Uruguay (23:59:59.999 UY) del día en que cae `date`.
 */
export function endOfDayUY(date: Date = new Date()): Date {
  return new Date(startOfDayUY(date).getTime() + DAY_MS - 1);
}

/**
 * Suma (o resta) días calendario.
 */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/**
 * Instante correspondiente a las `hour:minute` (hora Uruguay) del día
 * en que cae `date`. Ej: atHourUY(hoy, 6) = 06:00 UY de hoy.
 */
export function atHourUY(date: Date, hour: number, minute = 0): Date {
  return new Date(
    startOfDayUY(date).getTime() + hour * 60 * 60 * 1000 + minute * 60 * 1000,
  );
}

/**
 * Hora actual (0-23) en Uruguay.
 */
export function currentHourUY(date: Date = new Date()): number {
  return Number(
    date.toLocaleString("en-US", {
      timeZone: UY_TIMEZONE,
      hour: "numeric",
      hour12: false,
    }),
  );
}

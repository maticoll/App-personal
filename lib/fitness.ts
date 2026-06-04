// ============================================================
// lib/fitness.ts — Módulo de Fitness
// Sesión 4 — Rutinas, registro de actividad, NLP con Claude API,
//             smart habits y sync con Garmin Connect
// ============================================================

import { db } from "@/lib/db";
import type { FitnessSummary, WorkoutSummary } from "@/lib/types";

// -------------------------------------------------------
// Tipos exportados
// -------------------------------------------------------

export type WorkoutWithExercises = {
  id: string;
  userId: string;
  date: Date;
  type: string;
  durationMinutes: number | null;
  distanceKm: number | null;
  calories: number | null;
  steps: number | null;
  title: string | null;
  notes: string | null;
  source: string;
  garminActivityId: string | null;
  avgHr: number | null;
  maxHr: number | null;
  elevationGainM: number | null;
  avgSpeedMps: number | null;
  maxSpeedMps: number | null;
  movingSeconds: number | null;
  cadence: number | null;
  locationName: string | null;
  garminMetrics: unknown | null;
  exercises: ExerciseWithSets[];
  createdAt: Date;
};

export type ExerciseWithSets = {
  id: string;
  workoutId: string;
  name: string;
  order: number;
  notes: string | null;
  sets: WorkoutSetData[];
};

export type WorkoutSetData = {
  id: string;
  exerciseId: string;
  setNumber: number;
  reps: number | null;
  weightKg: number | null;
  notes: string | null;
};

export type GymRoutineWithExercises = {
  id: string;
  name: string;
  days: string[];
  active: boolean;
  exercises: RoutineExerciseData[];
};

export type RoutineExerciseData = {
  id: string;
  name: string;
  order: number;
  sets: number;
  repsRange: string | null;
  notes: string | null;
};

export type WeeklyStatEntry = {
  date: string; // "YYYY-MM-DD"
  totalMinutes: number;
  gymMinutes: number;
  cardioMinutes: number;
  workoutCount: number;
  hasActivity: boolean;
};

export type LogActivityInput = {
  type: "GYM" | "RUNNING" | "SWIMMING" | "WALKING" | "CYCLING" | "OTHER";
  durationMinutes?: number;
  distanceKm?: number;
  calories?: number;
  title?: string;
  notes?: string;
  date?: Date;
};

export type CreateRoutineInput = {
  name: string;
  days: string[];
  exercises: {
    name: string;
    order?: number;
    sets?: number;
    repsRange?: string;
    notes?: string;
  }[];
};

export type ParsedExercise = {
  name: string;
  sets: { setNumber: number; reps: number | null; weightKg: number | null }[];
};

export type SmartHabitStatus = {
  shouldNotify: boolean;
  message: string | null;
  expectedGymTime?: string;
};

// -------------------------------------------------------
// Helpers internos
// -------------------------------------------------------

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function getDayOfWeek(date: Date): string {
  const days = [
    "SUNDAY",
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
  ];
  return days[date.getDay()];
}

function subDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - n);
  return d;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapWorkout(w: any): WorkoutWithExercises {
  return {
    id: w.id,
    userId: w.userId,
    date: w.date,
    type: w.type,
    durationMinutes: w.durationMinutes ?? null,
    distanceKm: w.distanceKm ?? null,
    calories: w.calories ?? null,
    steps: w.steps ?? null,
    title: w.title ?? null,
    notes: w.notes ?? null,
    source: w.source ?? "MANUAL",
    garminActivityId: w.garminActivityId ?? null,
    avgHr: w.avgHr ?? null,
    maxHr: w.maxHr ?? null,
    elevationGainM: w.elevationGainM ?? null,
    avgSpeedMps: w.avgSpeedMps ?? null,
    maxSpeedMps: w.maxSpeedMps ?? null,
    movingSeconds: w.movingSeconds ?? null,
    cadence: w.cadence ?? null,
    locationName: w.locationName ?? null,
    garminMetrics: w.garminMetrics ?? null,
    exercises: (w.exercises ?? []).map(mapExercise),
    createdAt: w.createdAt,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapExercise(e: any): ExerciseWithSets {
  return {
    id: e.id,
    workoutId: e.workoutId,
    name: e.name,
    order: e.order,
    notes: e.notes ?? null,
    sets: (e.sets ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any): WorkoutSetData => ({
        id: s.id,
        exerciseId: s.exerciseId,
        setNumber: s.setNumber,
        reps: s.reps ?? null,
        weightKg: s.weightKg ?? null,
        notes: s.notes ?? null,
      })
    ),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRoutine(r: any): GymRoutineWithExercises {
  return {
    id: r.id,
    name: r.name,
    days: r.days,
    active: r.active,
    exercises: (r.exercises ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (e: any): RoutineExerciseData => ({
        id: e.id,
        name: e.name,
        order: e.order,
        sets: e.sets,
        repsRange: e.repsRange ?? null,
        notes: e.notes ?? null,
      })
    ),
  };
}

// -------------------------------------------------------
// Funciones de lectura
// -------------------------------------------------------

/** Workouts de hoy con ejercicios y series */
export async function getTodayWorkouts(
  userId: string
): Promise<WorkoutWithExercises[]> {
  const now = new Date();
  const workouts = await db.workout.findMany({
    where: {
      userId,
      date: { gte: startOfDay(now), lte: endOfDay(now) },
    },
    include: {
      exercises: {
        orderBy: { order: "asc" },
        include: { sets: { orderBy: { setNumber: "asc" } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return workouts.map(mapWorkout);
}

/** Historial de workouts (últimos N días, default 14) */
export async function getWorkoutHistory(
  userId: string,
  days = 14
): Promise<WorkoutWithExercises[]> {
  const from = subDays(new Date(), days);
  const workouts = await db.workout.findMany({
    where: {
      userId,
      date: { gte: startOfDay(from), lte: endOfDay(new Date()) },
    },
    include: {
      exercises: {
        orderBy: { order: "asc" },
        include: { sets: { orderBy: { setNumber: "asc" } } },
      },
    },
    orderBy: { date: "desc" },
  });
  return workouts.map(mapWorkout);
}

/** Estadísticas por día — últimos 7 días (para gráficos) */
export async function getWeeklyStats(userId: string): Promise<WeeklyStatEntry[]> {
  const today = new Date();
  const stats: WeeklyStatEntry[] = [];

  for (let i = 6; i >= 0; i--) {
    const date = subDays(today, i);
    const dateStr = date.toISOString().split("T")[0];

    const workouts = await db.workout.findMany({
      where: { userId, date: { gte: startOfDay(date), lte: endOfDay(date) } },
    });

    const totalMinutes = workouts.reduce(
      (sum: any, w: any) => sum + (w.durationMinutes ?? 0),
      0
    );
    const gymMinutes = workouts
      .filter((w: any) => w.type === "GYM")
      .reduce((sum: any, w: any) => sum + (w.durationMinutes ?? 0), 0);
    const cardioMinutes = workouts
      .filter((w: any) =>
        ["RUNNING", "SWIMMING", "CYCLING", "WALKING"].includes(w.type)
      )
      .reduce((sum: any, w: any) => sum + (w.durationMinutes ?? 0), 0);

    stats.push({
      date: dateStr,
      totalMinutes,
      gymMinutes,
      cardioMinutes,
      workoutCount: workouts.length,
      hasActivity: workouts.length > 0,
    });
  }

  return stats;
}

/** Rutina asignada a hoy (por día de la semana) */
export async function getTodayGymRoutine(
  userId: string
): Promise<GymRoutineWithExercises | null> {
  const dayName = getDayOfWeek(new Date());
  const routine = await db.gymRoutine.findFirst({
    where: { userId, active: true, days: { has: dayName } },
    include: { exercises: { orderBy: { order: "asc" } } },
  });
  return routine ? mapRoutine(routine) : null;
}

/** Todas las rutinas del usuario */
export async function getRoutines(
  userId: string
): Promise<GymRoutineWithExercises[]> {
  const routines = await db.gymRoutine.findMany({
    where: { userId },
    include: { exercises: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
  return routines.map(mapRoutine);
}

/** Resumen del día para el dashboard y el agente */
export async function getTodayFitnessSummary(
  userId: string
): Promise<FitnessSummary | null> {
  const [workouts, stepsInfo] = await Promise.all([
    getTodayWorkouts(userId),
    getTodaySteps(userId).catch(() => null),
  ]);

  // Sin workouts y sin pasos → no hay datos de fitness hoy
  if (workouts.length === 0 && !stepsInfo) return null;

  return {
    date: new Date(),
    workouts: workouts.map(
      (w): WorkoutSummary => ({
        id: w.id,
        type: w.type,
        durationMinutes: w.durationMinutes,
        notes: w.notes,
      })
    ),
    didGym: workouts.some((w) => w.type === "GYM"),
    totalActivityMinutes: workouts.reduce(
      (sum, w) => sum + (w.durationMinutes ?? 0),
      0
    ),
    steps: stepsInfo?.steps ?? null,
    stepsGoal: stepsInfo?.goal ?? null,
  };
}

// -------------------------------------------------------
// Pasos diarios (Garmin)
// El total de pasos del día se guarda en DailySteps, separado de los
// pasos por-actividad de Workout.steps. La clave es la fecha calendario
// en UTC (consistente con el sync de Garmin, que usa toISOString()).
// -------------------------------------------------------

const DEFAULT_STEPS_GOAL = 8000;

/** "YYYY-MM-DD" → Date a medianoche UTC (para columnas @db.Date) */
function stepsKeyFromStr(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00.000Z");
}

/** Date → clave de fecha calendario UTC para DailySteps */
function stepsKeyFromDate(date: Date): Date {
  return stepsKeyFromStr(date.toISOString().split("T")[0]);
}

/** Guarda (upsert) el total de pasos de un día. dateStr en formato "YYYY-MM-DD". */
export async function upsertDailySteps(
  userId: string,
  dateStr: string,
  steps: number,
  source: "GARMIN" | "MANUAL" = "GARMIN"
): Promise<void> {
  const date = stepsKeyFromStr(dateStr);
  await db.dailySteps.upsert({
    where: { userId_date: { userId, date } },
    update: { steps, source },
    create: { userId, date, steps, source },
  });
}

/** Total de pasos de una fecha dada (o null si no hay registro). */
export async function getStepsForDate(
  userId: string,
  date: Date
): Promise<number | null> {
  const row = await db.dailySteps.findUnique({
    where: { userId_date: { userId, date: stepsKeyFromDate(date) } },
  });
  return row?.steps ?? null;
}

/** Pasos de hoy + meta diaria del usuario (null si no hay pasos registrados). */
export async function getTodaySteps(
  userId: string
): Promise<{ steps: number; goal: number } | null> {
  const [row, goals] = await Promise.all([
    db.dailySteps.findUnique({
      where: { userId_date: { userId, date: stepsKeyFromDate(new Date()) } },
    }),
    db.userGoals.findUnique({ where: { userId } }).catch(() => null),
  ]);

  const goal = goals?.fitnessDailyStepsGoal ?? DEFAULT_STEPS_GOAL;
  if (!row) return null;
  return { steps: row.steps, goal };
}

// -------------------------------------------------------
// Smart habits
// -------------------------------------------------------

/**
 * Detecta si el usuario debería haber ido al gym y no fue.
 * Aplica cuando: hoy es día de gym configurado + pasó 1h del horario esperado
 * + no hay ningún workout registrado.
 */
export async function checkSmartHabitDeviation(
  userId: string
): Promise<SmartHabitStatus> {
  const settings = await db.userSettings.findUnique({ where: { userId } });

  if (!settings?.gymDays?.length || !settings?.expectedGymTime) {
    return { shouldNotify: false, message: null };
  }

  const now = new Date();
  const dayName = getDayOfWeek(now);

  if (!settings.gymDays.includes(dayName)) {
    return { shouldNotify: false, message: null };
  }

  // Parsear hora esperada de gym (ej: "06:00")
  const [expHour, expMin] = settings.expectedGymTime
    .split(":")
    .map((s: any) => parseInt(s, 10));
  const gymTime = new Date(now);
  gymTime.setHours(expHour, expMin ?? 0, 0, 0);

  // Periodo de gracia: 1 hora después de la hora esperada
  if (now.getTime() < gymTime.getTime() + 60 * 60 * 1000) {
    return { shouldNotify: false, message: null };
  }

  // Verificar si ya hay workout hoy
  const count = await db.workout.count({
    where: {
      userId,
      date: { gte: startOfDay(now), lte: endOfDay(now) },
    },
  });

  if (count > 0) {
    return { shouldNotify: false, message: null };
  }

  return {
    shouldNotify: true,
    message: `Pasó la hora del gym (${settings.expectedGymTime}) y no hay actividad registrada para hoy.`,
    expectedGymTime: settings.expectedGymTime,
    // TODO: Sesión 7 — Calendar: consultar huecos libres y proponer reagendado
  };
}

// -------------------------------------------------------
// Funciones de escritura
// -------------------------------------------------------

/** Registrar cualquier actividad física */
export async function logActivity(
  userId: string,
  data: LogActivityInput
): Promise<WorkoutWithExercises> {
  const date = data.date ?? new Date();
  const workout = await db.workout.create({
    data: {
      userId,
      date,
      type: data.type,
      durationMinutes: data.durationMinutes ?? null,
      distanceKm: data.distanceKm ?? null,
      calories: data.calories ?? null,
      notes: data.notes ?? null,
      // Campos nuevos Sesión 4 (disponibles después de `npm run db:push`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(({ title: data.title ?? null, source: "MANUAL" }) as any),
    } as Parameters<typeof db.workout.create>[0]["data"],
    include: { exercises: { include: { sets: true } } },
  });
  return mapWorkout(workout);
}

/**
 * Obtener o crear la sesión de gym de hoy.
 * Si ya existe un workout de tipo GYM para hoy, lo devuelve.
 * @param title — nombre de la rutina (ej: "Push A"). Si se pasa y la sesión de
 *   hoy no tiene título (o difiere), se actualiza para etiquetarla. Esto permite
 *   registrar CUALQUIER rutina, no solo la que toca según el día.
 */
export async function startGymWorkout(
  userId: string,
  title?: string
): Promise<WorkoutWithExercises> {
  const existing = await db.workout.findFirst({
    where: {
      userId,
      type: "GYM",
      date: { gte: startOfDay(new Date()), lte: endOfDay(new Date()) },
    },
    include: {
      exercises: {
        orderBy: { order: "asc" },
        include: { sets: { orderBy: { setNumber: "asc" } } },
      },
    },
  });

  if (existing) {
    // Si llega un título nuevo y la sesión no lo tenía, etiquetarla.
    const existingTitle = (existing as { title?: string | null }).title ?? null;
    if (title && existingTitle !== title) {
      const updated = await db.workout.update({
        where: { id: existing.id },
        data: { title } as Parameters<typeof db.workout.update>[0]["data"],
        include: {
          exercises: {
            orderBy: { order: "asc" },
            include: { sets: { orderBy: { setNumber: "asc" } } },
          },
        },
      });
      return mapWorkout(updated);
    }
    return mapWorkout(existing);
  }

  const workout = await db.workout.create({
    data: {
      userId,
      date: new Date(),
      type: "GYM",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...({ source: "MANUAL", title: title ?? null } as any),
    } as Parameters<typeof db.workout.create>[0]["data"],
    include: { exercises: { include: { sets: true } } },
  });
  return mapWorkout(workout);
}

/** Agregar series de un ejercicio a un workout */
export async function addExerciseSets(
  workoutId: string,
  exerciseName: string,
  sets: { reps: number | null; weightKg: number | null }[]
): Promise<ExerciseWithSets> {
  const existingCount = await db.workoutExercise.count({
    where: { workoutId },
  });

  const exercise = await db.workoutExercise.create({
    data: { workoutId, name: exerciseName, order: existingCount },
  });

  const createdSets = await Promise.all(
    sets.map((s, idx) =>
      db.workoutSet.create({
        data: {
          exerciseId: exercise.id,
          setNumber: idx + 1,
          reps: s.reps ?? undefined,
          weightKg: s.weightKg ?? undefined,
        },
      })
    )
  );

  return {
    id: exercise.id,
    workoutId,
    name: exercise.name,
    order: exercise.order,
    notes: exercise.notes ?? null,
    sets: createdSets.map((s: any) => ({
      id: s.id,
      exerciseId: s.exerciseId,
      setNumber: s.setNumber,
      reps: s.reps ?? null,
      weightKg: s.weightKg ?? null,
      notes: s.notes ?? null,
    })),
  };
}

/**
 * Parsear texto en lenguaje natural con Claude API y loguear ejercicios.
 * Ej: "press plano 100kg 4 reps 3 series" → WorkoutExercise + WorkoutSets
 */
export async function parseAndLogExerciseNLP(
  userId: string,
  text: string
): Promise<{
  workout: WorkoutWithExercises;
  parsedExercises: ParsedExercise[];
  message: string;
}> {
  const parsed = await parseExercisesFromText(text);

  if (parsed.length === 0) {
    throw new Error(
      "No se pudo interpretar el ejercicio. Intentá con: 'press plano 100kg 4 reps 3 series'"
    );
  }

  // Obtener o crear la sesión de gym de hoy
  const workout = await startGymWorkout(userId);

  // Registrar cada ejercicio parseado
  for (const ex of parsed) {
    await addExerciseSets(workout.id, ex.name, ex.sets);
  }

  // Estimar duración: ~5 min por ejercicio × series (si no tiene duración)
  const totalSets = parsed.reduce((sum, ex) => sum + ex.sets.length, 0);
  const estimatedMin = (workout.durationMinutes ?? 0) + totalSets * 5;
  if (estimatedMin > (workout.durationMinutes ?? 0)) {
    await db.workout.update({
      where: { id: workout.id },
      data: { durationMinutes: Math.min(estimatedMin, 120) },
    });
  }

  // Refrescar workout con los nuevos ejercicios
  const updated = await getTodayWorkouts(userId);
  const gymWorkout = updated.find((w) => w.id === workout.id) ?? updated[0];

  const names = parsed
    .map((e) => `${e.name} (${e.sets.length} series)`)
    .join(", ");
  return {
    workout: gymWorkout,
    parsedExercises: parsed,
    message: `✅ Registré: ${names}`,
  };
}

/**
 * Llamar a Claude Haiku API para parsear ejercicios en lenguaje natural.
 * Retorna un array de ParsedExercise con name + sets expandidas.
 */
async function parseExercisesFromText(text: string): Promise<ParsedExercise[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY no configurada. Agregala en .env.local para habilitar el parsing NLP."
    );
  }

  const system = `Sos un asistente de fitness que parsea ejercicios de gym desde texto en español informal de Argentina.
Respondé SOLO con un JSON válido (sin markdown, sin texto extra) con esta estructura exacta:
{"exercises":[{"name":"string","sets":[{"setNumber":1,"reps":número_o_null,"weightKg":número_o_null}]}]}

Reglas:
- Si el usuario dice "3 series" o "3x", expandí el array sets con N objetos idénticos
- Si no hay peso, usá null para weightKg; si no hay reps, usá null para reps
- Capitalizar correctamente: "Press Plano", "Sentadilla", "Peso Muerto", "Dominadas", etc.
- Si hay múltiples ejercicios en el texto, devolvé múltiples items en exercises

Ejemplos de entrada → salida:
"press plano 100kg 4 reps 3 series" → {"exercises":[{"name":"Press Plano","sets":[{"setNumber":1,"reps":4,"weightKg":100},{"setNumber":2,"reps":4,"weightKg":100},{"setNumber":3,"reps":4,"weightKg":100}]}]}
"sentadillas 80kg 3x12" → {"exercises":[{"name":"Sentadilla","sets":[{"setNumber":1,"reps":12,"weightKg":80},{"setNumber":2,"reps":12,"weightKg":80},{"setNumber":3,"reps":12,"weightKg":80}]}]}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: text }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    content: Array<{ type: string; text: string }>;
  };
  const raw = data.content[0]?.text ?? "{}";

  // Extraer JSON aunque venga envuelto en ```json ... ```
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\})/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : raw.trim();

  try {
    const parsed = JSON.parse(jsonStr) as { exercises?: ParsedExercise[] };
    return parsed.exercises ?? [];
  } catch {
    throw new Error(`No se pudo interpretar la respuesta del parser: ${raw}`);
  }
}

// -------------------------------------------------------
// Rutinas: matching por nombre + progreso entre sesiones
// La sesión de gym se etiqueta con el nombre de la rutina (Workout.title),
// así se puede comparar "Push A" de hoy contra la última "Push A".
// -------------------------------------------------------

/** Normaliza texto para comparar nombres (sin acentos, minúsculas) */
function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Mejor serie de un ejercicio: mayor peso (desempate por reps). */
function exerciseTopSet(
  sets: { weightKg: number | null; reps: number | null }[]
): { weightKg: number | null; reps: number | null } | null {
  let best: { weightKg: number | null; reps: number | null } | null = null;
  for (const s of sets) {
    if (s.weightKg == null && s.reps == null) continue;
    if (!best) {
      best = s;
      continue;
    }
    const bw = best.weightKg ?? -1;
    const sw = s.weightKg ?? -1;
    if (sw > bw || (sw === bw && (s.reps ?? 0) > (best.reps ?? 0))) best = s;
  }
  return best ? { weightKg: best.weightKg ?? null, reps: best.reps ?? null } : null;
}

/** Volumen total de un ejercicio (suma de peso × reps de cada serie). */
function exerciseVolume(
  sets: { weightKg: number | null; reps: number | null }[]
): number {
  return sets.reduce((sum, s) => sum + (s.weightKg ?? 0) * (s.reps ?? 0), 0);
}

/**
 * Busca una rutina del usuario por nombre aproximado.
 * Tolerante: exacto → nombre contenido en el texto → texto contenido en nombre.
 */
export function matchRoutineByName(
  routines: GymRoutineWithExercises[],
  query: string
): GymRoutineWithExercises | null {
  const q = normalizeName(query);
  if (!q) return null;

  // 1. Coincidencia exacta
  const exact = routines.find((r) => normalizeName(r.name) === q);
  if (exact) return exact;

  // 2. El nombre de la rutina aparece dentro del texto (ej: "tráeme push a")
  //    Si varias coinciden, preferir el nombre más largo (más específico).
  const contained = routines
    .filter((r) => q.includes(normalizeName(r.name)))
    .sort((a, b) => b.name.length - a.name.length);
  if (contained.length) return contained[0];

  // 3. El texto aparece dentro del nombre de la rutina
  const reverse = routines.find((r) => normalizeName(r.name).includes(q));
  return reverse ?? null;
}

/**
 * Última sesión de gym con un título de rutina dado.
 * @param beforeDate — si se pasa, busca sesiones estrictamente anteriores a esa fecha.
 */
export async function findLastRoutineSession(
  userId: string,
  routineName: string,
  beforeDate?: Date
): Promise<WorkoutWithExercises | null> {
  const w = await db.workout.findFirst({
    where: {
      userId,
      type: "GYM",
      title: { equals: routineName, mode: "insensitive" },
      ...(beforeDate ? { date: { lt: beforeDate } } : {}),
      exercises: { some: {} },
    },
    orderBy: { date: "desc" },
    include: {
      exercises: {
        orderBy: { order: "asc" },
        include: { sets: { orderBy: { setNumber: "asc" } } },
      },
    },
  });
  return w ? mapWorkout(w) : null;
}

export type ExerciseLastPerformance = {
  name: string;
  plannedSets: number;
  repsRange: string | null;
  /** Mejor serie de la última sesión (para mostrar en cards web). */
  top: { weightKg: number | null; reps: number | null } | null;
  /** Todas las series de la última sesión, en orden (para el detalle de WhatsApp). */
  lastSets: { weightKg: number | null; reps: number | null }[];
};

export type RoutineLastPerformance = {
  routineName: string;
  lastDate: Date | null;
  exercises: ExerciseLastPerformance[];
};

/** Construye el detalle de performance por ejercicio de una rutina vs su última sesión. */
function buildExercisePerformance(
  routine: GymRoutineWithExercises,
  last: WorkoutWithExercises | null
): ExerciseLastPerformance[] {
  const lastMap = new Map<string, ExerciseWithSets>();
  if (last) for (const ex of last.exercises) lastMap.set(normalizeName(ex.name), ex);

  return routine.exercises.map((re) => {
    const match = lastMap.get(normalizeName(re.name));
    const lastSets = match
      ? match.sets.map((s) => ({ weightKg: s.weightKg ?? null, reps: s.reps ?? null }))
      : [];
    return {
      name: re.name,
      plannedSets: re.sets,
      repsRange: re.repsRange ?? null,
      top: match ? exerciseTopSet(match.sets) : null,
      lastSets,
    };
  });
}

// ============================================================
// Workout activo (pantalla de sesión en vivo, estilo Hevy)
// ============================================================

export type ExerciseBests = {
  maxWeightKg: number | null;
  maxSessionVolume: number | null;
  repsAtWeight: Record<string, number>; // weightKey -> mejores reps históricas
};

export type SessionPrepExercise = {
  name: string;
  plannedSets: number;
  repsRange: string | null;
  lastSets: { weightKg: number | null; reps: number | null }[];
  bests: ExerciseBests;
};

export type SessionPrep = {
  routineId: string | null;
  routineName: string | null;
  exercises: SessionPrepExercise[];
};

export type WorkoutSessionPayload = {
  routineName: string | null;
  durationSeconds: number;
  exercises: { name: string; sets: { weightKg: number | null; reps: number | null }[] }[];
};

export type WorkoutSessionPR = {
  exercise: string;
  kind: "weight" | "volume" | "reps";
  detail: string;
};

export type WorkoutSessionSummary = {
  workoutId: string;
  durationSeconds: number;
  totalSets: number;
  totalVolume: number;
  prs: WorkoutSessionPR[];
};

/** Clave canónica de peso para repsAtWeight (16.5 -> "16.5"). Misma fn en prep y server. */
export function weightKey(weightKg: number | null): string {
  return weightKg == null ? "0" : String(weightKg);
}

export async function getExerciseBests(
  userId: string,
  names: string[],
  beforeDate?: Date
): Promise<Record<string, ExerciseBests>> {
  const wanted = new Set(names.map(normalizeName));
  const workouts = await db.workout.findMany({
    where: {
      userId,
      type: "GYM",
      ...(beforeDate ? { date: { lt: beforeDate } } : {}),
    },
    include: { exercises: { include: { sets: true } } },
  });

  const out: Record<string, ExerciseBests> = {};
  for (const n of names) {
    out[normalizeName(n)] = { maxWeightKg: null, maxSessionVolume: null, repsAtWeight: {} };
  }

  for (const w of workouts) {
    for (const ex of w.exercises) {
      const key = normalizeName(ex.name);
      if (!wanted.has(key)) continue;
      const b = out[key];
      let sessionVol = 0;
      for (const s of ex.sets) {
        const wk = s.weightKg ?? null;
        const reps = s.reps ?? null;
        if (wk != null && (b.maxWeightKg == null || wk > b.maxWeightKg)) b.maxWeightKg = wk;
        if (wk != null && reps != null) {
          sessionVol += wk * reps;
          const k = weightKey(wk);
          if (b.repsAtWeight[k] == null || reps > b.repsAtWeight[k]) b.repsAtWeight[k] = reps;
        }
      }
      if (sessionVol > 0 && (b.maxSessionVolume == null || sessionVol > b.maxSessionVolume)) {
        b.maxSessionVolume = sessionVol;
      }
    }
  }
  return out;
}

export async function getSessionPrep(
  userId: string,
  routineId: string | null
): Promise<SessionPrep> {
  if (!routineId) return { routineId: null, routineName: null, exercises: [] };

  const routines = await getRoutines(userId);
  const routine = routines.find((r) => r.id === routineId) ?? null;
  if (!routine) return { routineId: null, routineName: null, exercises: [] };

  const last = await findLastRoutineSession(userId, routine.name);
  const perf = buildExercisePerformance(routine, last); // {name, plannedSets, repsRange, lastSets, top}
  const bests = await getExerciseBests(userId, routine.exercises.map((e) => e.name));

  return {
    routineId: routine.id,
    routineName: routine.name,
    exercises: perf.map((p) => ({
      name: p.name,
      plannedSets: p.plannedSets,
      repsRange: p.repsRange,
      lastSets: p.lastSets,
      bests: bests[normalizeName(p.name)] ?? { maxWeightKg: null, maxSessionVolume: null, repsAtWeight: {} },
    })),
  };
}

export async function saveWorkoutSession(
  userId: string,
  payload: WorkoutSessionPayload
): Promise<WorkoutSessionSummary> {
  // 1. Filtrar series vacías
  const exercises = payload.exercises
    .map((e) => ({
      name: e.name.trim(),
      sets: e.sets.filter((s) => s.weightKg != null || s.reps != null),
    }))
    .filter((e) => e.name && e.sets.length > 0);

  if (exercises.length === 0) {
    throw new Error("No hay series con datos para guardar.");
  }

  // 2. Bests históricos ANTES de insertar (no contar la sesión de hoy)
  const bests = await getExerciseBests(userId, exercises.map((e) => e.name), startOfDay(new Date()));

  // 3. Crear/reutilizar sesión GYM de hoy etiquetada con la rutina
  const workout = await startGymWorkout(userId, payload.routineName ?? undefined);

  // 4. Insertar ejercicios + series. Si el workout de hoy ya tenía un ejercicio
  //    con el mismo nombre (ej: una sesión previa o el Quick Log NLP), se
  //    agregan las series a ese ejercicio en vez de duplicar la tarjeta.
  const existingByName = new Map(
    workout.exercises.map((e) => [normalizeName(e.name), e])
  );
  for (const ex of exercises) {
    const sets = ex.sets.map((s) => ({ reps: s.reps ?? null, weightKg: s.weightKg ?? null }));
    const existing = existingByName.get(normalizeName(ex.name));
    if (existing) {
      const startNumber = existing.sets.length;
      await Promise.all(
        sets.map((s, i) =>
          db.workoutSet.create({
            data: {
              exerciseId: existing.id,
              setNumber: startNumber + i + 1,
              reps: s.reps ?? undefined,
              weightKg: s.weightKg ?? undefined,
            },
          })
        )
      );
    } else {
      await addExerciseSets(workout.id, ex.name, sets);
    }
  }

  // 5. Duración
  const durationMinutes = Math.max(1, Math.round(payload.durationSeconds / 60));
  await db.workout.update({ where: { id: workout.id }, data: { durationMinutes: Math.min(durationMinutes, 300) } });

  // 6. PRs y totales
  const prs: WorkoutSessionPR[] = [];
  let totalSets = 0;
  let totalVolume = 0;
  for (const ex of exercises) {
    const b = bests[normalizeName(ex.name)] ?? { maxWeightKg: null, maxSessionVolume: null, repsAtWeight: {} };
    const top = exerciseTopSet(ex.sets);
    const vol = exerciseVolume(ex.sets);
    totalSets += ex.sets.length;
    totalVolume += vol;

    if (top?.weightKg != null && (b.maxWeightKg == null || top.weightKg > b.maxWeightKg)) {
      prs.push({ exercise: ex.name, kind: "weight", detail: `${top.weightKg}kg` });
    }
    if (vol > 0 && (b.maxSessionVolume == null || vol > b.maxSessionVolume)) {
      prs.push({ exercise: ex.name, kind: "volume", detail: `${Math.round(vol)} vol` });
    }
    for (const s of ex.sets) {
      if (s.weightKg != null && s.reps != null) {
        const prev = b.repsAtWeight[weightKey(s.weightKg)];
        if (prev == null || s.reps > prev) {
          prs.push({ exercise: ex.name, kind: "reps", detail: `${s.reps} reps @ ${s.weightKg}kg` });
          break; // un PR de reps por ejercicio alcanza
        }
      }
    }
  }

  return {
    workoutId: workout.id,
    durationSeconds: payload.durationSeconds,
    totalSets,
    totalVolume: Math.round(totalVolume),
    prs,
  };
}

/**
 * Trae una rutina con los últimos pesos/reps registrados en la última sesión
 * de esa misma rutina. Para el comando "tráeme push A".
 */
export async function getRoutineWithLastPerformance(
  userId: string,
  query: string
): Promise<RoutineLastPerformance | null> {
  const routines = await getRoutines(userId);
  const routine = matchRoutineByName(routines, query);
  if (!routine) return null;

  const last = await findLastRoutineSession(userId, routine.name);
  return {
    routineName: routine.name,
    lastDate: last?.date ?? null,
    exercises: buildExercisePerformance(routine, last),
  };
}

export type RoutineExerciseWithLast = GymRoutineWithExercises["exercises"][number] & {
  last: { weightKg: number | null; reps: number | null } | null;
};

export type RoutineWithLastPerformance = Omit<GymRoutineWithExercises, "exercises"> & {
  lastDate: Date | null;
  exercises: RoutineExerciseWithLast[];
};

/** Enriquece una rutina con el último peso/reps (mejor serie) por ejercicio. */
export async function enrichRoutineWithLastPerformance(
  userId: string,
  routine: GymRoutineWithExercises
): Promise<RoutineWithLastPerformance> {
  const last = await findLastRoutineSession(userId, routine.name);
  const lastMap = new Map<string, ExerciseWithSets>();
  if (last) for (const ex of last.exercises) lastMap.set(normalizeName(ex.name), ex);

  return {
    ...routine,
    lastDate: last?.date ?? null,
    exercises: routine.exercises.map((ex) => {
      const match = lastMap.get(normalizeName(ex.name));
      return { ...ex, last: match ? exerciseTopSet(match.sets) : null };
    }),
  };
}

/**
 * Todas las rutinas del usuario, con el último peso/reps (mejor serie) por
 * ejercicio según la última sesión de esa rutina. Para mostrar en la web.
 */
export async function getRoutinesWithLastPerformance(
  userId: string
): Promise<RoutineWithLastPerformance[]> {
  const routines = await getRoutines(userId);
  return Promise.all(routines.map((r) => enrichRoutineWithLastPerformance(userId, r)));
}

/** Rutina del día con el último peso/reps por ejercicio (o null si no hay rutina hoy). */
export async function getTodayGymRoutineWithLastPerformance(
  userId: string
): Promise<RoutineWithLastPerformance | null> {
  const routine = await getTodayGymRoutine(userId);
  if (!routine) return null;
  return enrichRoutineWithLastPerformance(userId, routine);
}

export type RoutineSessionComparison = {
  routineName: string | null;
  prevDate: Date | null;
  exercises: {
    name: string;
    today: { weightKg: number | null; reps: number | null; volume: number };
    prev: { weightKg: number | null; reps: number | null; volume: number } | null;
    deltaWeight: number | null;
    deltaVolume: number | null;
  }[];
};

/**
 * Registra una sesión de rutina desde texto libre y la compara con la última
 * sesión de la MISMA rutina (por título). Devuelve el progreso por ejercicio.
 */
export async function logRoutineSession(
  userId: string,
  routineName: string | null,
  text: string
): Promise<RoutineSessionComparison> {
  const parsed = await parseExercisesFromText(text);
  if (parsed.length === 0) {
    throw new Error(
      "No pude interpretar los ejercicios. Probá: 'Push A: press plano 100kg 3x8, sentadilla 80kg 3x10'"
    );
  }

  // Capturar la sesión previa de esta rutina ANTES de tocar la de hoy
  const prev = routineName
    ? await findLastRoutineSession(userId, routineName, startOfDay(new Date()))
    : null;
  const prevMap = new Map<string, ExerciseWithSets>();
  if (prev) for (const ex of prev.exercises) prevMap.set(normalizeName(ex.name), ex);

  // Crear/etiquetar la sesión de hoy y registrar ejercicios
  const workout = await startGymWorkout(userId, routineName ?? undefined);
  for (const ex of parsed) {
    await addExerciseSets(workout.id, ex.name, ex.sets);
  }

  // Duración estimada (~5 min por serie)
  const totalSets = parsed.reduce((sum, ex) => sum + ex.sets.length, 0);
  const estimated = (workout.durationMinutes ?? 0) + totalSets * 5;
  if (estimated > (workout.durationMinutes ?? 0)) {
    await db.workout.update({
      where: { id: workout.id },
      data: { durationMinutes: Math.min(estimated, 150) },
    });
  }

  const exercises = parsed.map((ex) => {
    const todaySets = ex.sets.map((s) => ({
      weightKg: s.weightKg ?? null,
      reps: s.reps ?? null,
    }));
    const todayTop = exerciseTopSet(todaySets);
    const todayVol = exerciseVolume(todaySets);

    const prevEx = prevMap.get(normalizeName(ex.name));
    const prevTop = prevEx ? exerciseTopSet(prevEx.sets) : null;
    const prevVol = prevEx ? exerciseVolume(prevEx.sets) : null;

    const deltaWeight =
      todayTop?.weightKg != null && prevTop?.weightKg != null
        ? round1(todayTop.weightKg - prevTop.weightKg)
        : null;
    const deltaVolume = prevVol != null ? Math.round(todayVol - prevVol) : null;

    return {
      name: ex.name,
      today: {
        weightKg: todayTop?.weightKg ?? null,
        reps: todayTop?.reps ?? null,
        volume: Math.round(todayVol),
      },
      prev: prevEx
        ? {
            weightKg: prevTop?.weightKg ?? null,
            reps: prevTop?.reps ?? null,
            volume: Math.round(prevVol ?? 0),
          }
        : null,
      deltaWeight,
      deltaVolume,
    };
  });

  return { routineName, prevDate: prev?.date ?? null, exercises };
}

// -------------------------------------------------------
// CRUD de rutinas
// -------------------------------------------------------

export async function createRoutine(
  userId: string,
  data: CreateRoutineInput
): Promise<GymRoutineWithExercises> {
  const routine = await db.gymRoutine.create({
    data: {
      userId,
      name: data.name,
      days: data.days,
      exercises: {
        create: data.exercises.map((ex, idx) => ({
          name: ex.name,
          order: ex.order ?? idx,
          sets: ex.sets ?? 3,
          repsRange: ex.repsRange ?? null,
          notes: ex.notes ?? null,
        })),
      },
    },
    include: { exercises: { orderBy: { order: "asc" } } },
  });
  return mapRoutine(routine);
}

export async function updateRoutine(
  id: string,
  data: Partial<CreateRoutineInput>
): Promise<GymRoutineWithExercises> {
  if (data.exercises !== undefined) {
    await db.gymRoutineExercise.deleteMany({ where: { routineId: id } });
    if (data.exercises.length > 0) {
      await db.gymRoutineExercise.createMany({
        data: data.exercises.map((ex, idx) => ({
          routineId: id,
          name: ex.name,
          order: ex.order ?? idx,
          sets: ex.sets ?? 3,
          repsRange: ex.repsRange ?? null,
          notes: ex.notes ?? null,
        })),
      });
    }
  }

  const routine = await db.gymRoutine.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.days !== undefined && { days: data.days }),
    },
    include: { exercises: { orderBy: { order: "asc" } } },
  });
  return mapRoutine(routine);
}

export async function deleteRoutine(id: string): Promise<void> {
  await db.gymRoutine.delete({ where: { id } });
}

export async function updateWorkout(
  id: string,
  data: Partial<Pick<LogActivityInput, "durationMinutes" | "distanceKm" | "notes" | "calories">>
): Promise<WorkoutWithExercises> {
  const workout = await db.workout.update({
    where: { id },
    data: {
      ...(data.durationMinutes !== undefined && {
        durationMinutes: data.durationMinutes,
      }),
      ...(data.distanceKm !== undefined && { distanceKm: data.distanceKm }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.calories !== undefined && { calories: data.calories }),
    },
    include: {
      exercises: {
        orderBy: { order: "asc" },
        include: { sets: { orderBy: { setNumber: "asc" } } },
      },
    },
  });
  return mapWorkout(workout);
}

export async function deleteWorkout(id: string): Promise<void> {
  await db.workout.delete({ where: { id } });
}

// -------------------------------------------------------
// Sync con Garmin
// -------------------------------------------------------

/** Upsert de workout desde una actividad de Garmin */
export async function upsertWorkoutFromGarmin(
  userId: string,
  activity: import("@/lib/garmin").GarminActivityData
): Promise<void> {
  const durationMinutes = Math.round(activity.durationSeconds / 60);
  const distanceKm = activity.distanceMeters ? activity.distanceMeters / 1000 : null;

  // Métricas hardware: Garmin es fuente de verdad → se escriben siempre.
  const garminFields = {
    durationMinutes,
    ...(distanceKm !== null && { distanceKm }),
    ...(activity.calories !== null && { calories: activity.calories }),
    avgHr: activity.avgHr,
    maxHr: activity.maxHr,
    elevationGainM: activity.elevationGainM,
    avgSpeedMps: activity.avgSpeedMps,
    maxSpeedMps: activity.maxSpeedMps,
    movingSeconds: activity.movingSeconds,
    cadence: activity.cadence,
    locationName: activity.locationName,
    ...(activity.steps !== null && { steps: activity.steps }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    garminMetrics: (activity.metrics ?? undefined) as any,
  };

  const existing = await db.workout.findFirst({
    where: { garminActivityId: activity.garminActivityId },
  });

  if (existing) {
    await db.workout.update({
      where: { id: existing.id },
      data: garminFields as Parameters<typeof db.workout.update>[0]["data"],
    });
  } else {
    await db.workout.create({
      data: {
        userId,
        date: activity.date,
        type: activity.type,
        garminActivityId: activity.garminActivityId,
        title: activity.title,
        source: "GARMIN",
        ...garminFields,
      } as Parameters<typeof db.workout.create>[0]["data"],
    });
  }
}

// -------------------------------------------------------
// Agregaciones por tipo de actividad y stats de gym
// -------------------------------------------------------

export type ActivityTypeSummary = {
  weekDistanceKm: number;
  weekCount: number;
  weekDurationMin: number;
};

const startOfWeek = (d: Date): Date => {
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7; // lunes=0
  x.setDate(x.getDate() - day);
  return x;
};

/** Resumen de la semana actual para un tipo de actividad. */
export async function getActivityWeekSummary(
  userId: string,
  type: LogActivityInput["type"]
): Promise<ActivityTypeSummary> {
  const from = startOfWeek(new Date());
  const rows = await db.workout.findMany({
    where: { userId, type, date: { gte: from } },
  });
  return {
    weekDistanceKm: rows.reduce((s, w) => s + (w.distanceKm ?? 0), 0),
    weekCount: rows.length,
    weekDurationMin: rows.reduce((s, w) => s + (w.durationMinutes ?? 0), 0),
  };
}

/** Última actividad registrada de un tipo (con exercises para gym). */
export async function getLastActivityOfType(
  userId: string,
  type: LogActivityInput["type"]
): Promise<WorkoutWithExercises | null> {
  const w = await db.workout.findFirst({
    where: { userId, type },
    orderBy: { date: "desc" },
    include: { exercises: { include: { sets: true }, orderBy: { order: "asc" } } },
  });
  return (w as unknown as WorkoutWithExercises) ?? null;
}

/** Historial de un tipo (N más recientes). */
export async function getActivityHistory(
  userId: string,
  type: LogActivityInput["type"],
  limit = 20
): Promise<WorkoutWithExercises[]> {
  const rows = await db.workout.findMany({
    where: { userId, type },
    orderBy: { date: "desc" },
    take: limit,
    include: { exercises: { include: { sets: true }, orderBy: { order: "asc" } } },
  });
  return rows as unknown as WorkoutWithExercises[];
}

export type GymStats = {
  weekSessions: number;
  totalVolumeKg: number;   // volumen de la última sesión
  weekVolumeKg: number;    // volumen acumulado de la semana
};

/** Stats de gym recreadas para la página de Gym. PRs se difieren (YAGNI). */
export async function getGymStats(userId: string): Promise<GymStats> {
  const from = startOfWeek(new Date());
  const sessions = await db.workout.findMany({
    where: { userId, type: "GYM", date: { gte: from } },
    orderBy: { date: "desc" },
    include: { exercises: { include: { sets: true } } },
  });
  const volOf = (w: (typeof sessions)[number]) =>
    w.exercises.reduce(
      (s, e) => s + e.sets.reduce((ss, set) => ss + (set.weightKg ?? 0) * (set.reps ?? 0), 0),
      0
    );
  return {
    weekSessions: sessions.length,
    totalVolumeKg: sessions.length ? Math.round(volOf(sessions[0])) : 0,
    weekVolumeKg: Math.round(sessions.reduce((s, w) => s + volOf(w), 0)),
  };
}

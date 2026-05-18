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
  const workouts = await getTodayWorkouts(userId);
  if (workouts.length === 0) return null;

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
  };
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
 */
export async function startGymWorkout(
  userId: string
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

  if (existing) return mapWorkout(existing);

  const workout = await db.workout.create({
    data: {
      userId,
      date: new Date(),
      type: "GYM",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...({ source: "MANUAL" } as any),
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
  activity: {
    garminActivityId: string;
    date: Date;
    type: "GYM" | "RUNNING" | "SWIMMING" | "WALKING" | "CYCLING" | "OTHER";
    title: string;
    durationSeconds: number;
    distanceMeters: number | null;
    calories: number | null;
    steps: number | null;
  }
): Promise<void> {
  const durationMinutes = Math.round(activity.durationSeconds / 60);
  const distanceKm =
    activity.distanceMeters ? activity.distanceMeters / 1000 : null;

  const existing = await db.workout.findFirst({
    where: { garminActivityId: activity.garminActivityId },
  });

  if (existing) {
    await db.workout.update({
      where: { id: existing.id },
      data: {
        durationMinutes,
        ...(distanceKm !== null && { distanceKm }),
        ...(activity.calories !== null && { calories: activity.calories }),
      },
    });
  } else {
    await db.workout.create({
      data: {
        userId,
        date: activity.date,
        type: activity.type,
        durationMinutes,
        ...(distanceKm !== null && { distanceKm }),
        ...(activity.calories !== null && { calories: activity.calories }),
        garminActivityId: activity.garminActivityId,
        // Campos Sesión 4 (disponibles tras db:push)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...({ title: activity.title, source: "GARMIN", steps: activity.steps } as any),
      } as Parameters<typeof db.workout.create>[0]["data"],
    });
  }
}

// ============================================================
// Lógica de Scoring — lib/scoring.ts
// Sesión 2 — Dashboard + Scoring
//
// Criterios por módulo:
//   Sleep     /100  →  duración + calidad Garmin
//   Fitness   /100  →  workout completado + tipo
//   Nutrition /100  →  comidas registradas + agua
//   Projects  /100  →  progreso en proyectos + tareas
//   Ideas     /100  →  idea capturada (binario)
//
// Global = promedio de los módulos con datos (excluye nulls)
// ============================================================

import { db } from "@/lib/db";
import { average } from "@/lib/utils";
import type { DailyScoreData, ScoreDetails } from "@/lib/types";

// -------------------------------------------------------
// Tipos internos
// -------------------------------------------------------

export type ModuleScoreResult = {
  score: number | null;
  met: string[];
  missed: string[];
};

export type FullScoreResult = {
  sleep: ModuleScoreResult;
  fitness: ModuleScoreResult;
  nutrition: ModuleScoreResult;
  projects: ModuleScoreResult;
  global: number;
};

// -------------------------------------------------------
// Helpers de fecha
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

// -------------------------------------------------------
// Score de SUEÑO — Criterios actualizados Sesión 3
//
// Total: 100 puntos (3 bloques)
//
// Bloque Registro  (30 pts):
//   +30  bedTime + wakeTime registrados
//   +15  solo bedTime (registro parcial)
//
// Bloque Duración  (40 pts):
//   +40  duración ideal: 7–9h
//   +20  duración aceptable: 6–7h ó 9–10h
//   +0   fuera de rango o sin dato
//
// Bloque Calidad   (30 pts — dos modos):
//   Sin Garmin: hora de acostarse
//     +30  bedTime ≤ 23:30
//     +20  bedTime ≤ 00:30
//     +10  bedTime ≤ 01:00
//   Con Garmin: score de calidad
//     proporcional: (garminScore / 100) * 30
//
// Comportamiento null: si no hay ningún registro, retorna null (sin datos)
// -------------------------------------------------------

async function calcSleepScore(
  userId: string,
  date: Date
): Promise<ModuleScoreResult> {
  const met: string[] = [];
  const missed: string[] = [];

  const log = await db.sleepLog.findUnique({
    where: {
      userId_date: {
        userId,
        date: startOfDay(date),
      },
    },
  });

  if (!log) {
    return { score: null, met: [], missed: ["No se registró el sueño"] };
  }

  let score = 0;

  // === Bloque Registro (30 pts) ===
  if (log.wakeTime) {
    score += 30;
    met.push("Sueño registrado completo");
  } else {
    score += 15;
    met.push("Hora de dormir registrada (falta hora de despertar)");
    missed.push("No se registró la hora de despertar");
  }

  // === Bloque Duración (40 pts) ===
  const minutes = log.durationMinutes;
  if (minutes !== null) {
    const hours = minutes / 60;
    const hoursRounded = Math.round(hours * 10) / 10;

    if (hours >= 7 && hours <= 9) {
      score += 40;
      met.push(`Duración ideal: ${hoursRounded}h ✓`);
    } else if ((hours >= 6 && hours < 7) || (hours > 9 && hours <= 10)) {
      score += 20;
      met.push(`Duración aceptable: ${hoursRounded}h`);
      missed.push(
        hours < 7
          ? `Objetivo: al menos 7h (dormiste ${hoursRounded}h)`
          : `Objetivo: máximo 9h (dormiste ${hoursRounded}h)`
      );
    } else {
      missed.push(
        hours < 6
          ? `Duración insuficiente: ${hoursRounded}h (mínimo recomendado: 6h)`
          : `Duración excesiva: ${hoursRounded}h (máximo recomendado: 10h)`
      );
    }
  } else if (log.wakeTime) {
    // Tiene ambos tiempos pero no se calculó la duración (edge case)
    const ms = log.wakeTime.getTime() - log.bedTime.getTime();
    const computedHours = ms / (1000 * 60 * 60);
    if (computedHours >= 7 && computedHours <= 9) {
      score += 40;
      met.push(`Duración ideal: ${Math.round(computedHours * 10) / 10}h ✓`);
    }
  } else {
    missed.push("Sin hora de despertar — no se puede calcular la duración");
  }

  // === Bloque Calidad (30 pts) ===
  if (log.garminScore !== null) {
    // Con Garmin: proporcional al score de calidad
    const garminContrib = Math.round((log.garminScore / 100) * 30);
    score += garminContrib;
    met.push(`Calidad Garmin: ${log.garminScore}/100`);
    if (log.garminScore < 60) {
      missed.push(`Calidad de sueño baja (${log.garminScore}/100)`);
    }
  } else {
    // Sin Garmin: evaluar hora de acostarse
    const bedHour =
      log.bedTime.getHours() + log.bedTime.getMinutes() / 60;
    // Normalizar: si bedHour < 12 (ej: 00:30, 01:00) → es "pasada medianoche"
    const normalizedBedHour =
      bedHour < 12 ? bedHour + 24 : bedHour; // ej: 00:30 → 24.5, 23:30 → 23.5

    if (normalizedBedHour <= 23.5) {
      // Antes de las 23:30
      score += 30;
      met.push(`Buen horario de dormir: ${formatBedTime(log.bedTime)}`);
    } else if (normalizedBedHour <= 24.5) {
      // Entre 23:30 y 00:30
      score += 20;
      met.push(`Horario aceptable: ${formatBedTime(log.bedTime)}`);
      missed.push("Intentá dormir antes de las 23:30");
    } else if (normalizedBedHour <= 25) {
      // Entre 00:30 y 01:00
      score += 10;
      missed.push(`Hora de dormir tardía: ${formatBedTime(log.bedTime)} (ideal: antes de las 23:30)`);
    } else {
      // Después de la 1 AM
      missed.push(`Hora de dormir muy tarde: ${formatBedTime(log.bedTime)} (ideal: antes de las 23:30)`);
    }

    missed.push("Conectá Garmin para obtener el score de calidad del sueño");
  }

  return { score: Math.min(score, 100), met, missed };
}

/**
 * Función exportada para que el agente de sueño pueda calcular el score
 * sin tener que cargar el módulo de scoring completo.
 */
export async function calcSleepScoreForDate(
  userId: string,
  date: Date
): Promise<ModuleScoreResult> {
  return calcSleepScore(userId, date);
}

function formatBedTime(bedTime: Date): string {
  return bedTime.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// -------------------------------------------------------
// Score de FITNESS — Criterios actualizados Sesión 4
//
// Total: 100 puntos (4 bloques)
//
// Bloque Base     (40 pts): cualquier actividad registrada
// Bloque Gym      (20 pts): tipo GYM registrado
// Bloque Duración (20 pts): duración total ≥ 45 min
// Bloque Cardio   (20 pts): RUNNING / SWIMMING / CYCLING
//
// Comportamiento null vs 0:
//   null → sin datos y no es día de gym configurado
//   0    → era día de gym configurado y no se registró nada
// -------------------------------------------------------

function getDayName(date: Date): string {
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

async function calcFitnessScore(
  userId: string,
  date: Date
): Promise<ModuleScoreResult> {
  const met: string[] = [];
  const missed: string[] = [];

  const [workouts, settings] = await Promise.all([
    db.workout.findMany({
      where: { userId, date: { gte: startOfDay(date), lte: endOfDay(date) } },
    }),
    db.userSettings.findUnique({ where: { userId } }),
  ]);

  const dayName = getDayName(date);
  const isGymDay = (settings?.gymDays ?? []).includes(dayName);

  if (workouts.length === 0) {
    // Si era día de gym configurado → score 0 (objetivo fallido)
    // Si no → null (módulo sin datos, excluido del promedio)
    if (isGymDay && (settings?.gymDays?.length ?? 0) > 0) {
      return {
        score: 0,
        met: [],
        missed: ["Hoy era día de gym — sin actividad registrada"],
      };
    }
    return {
      score: null,
      met: [],
      missed: ["Sin actividad física registrada"],
    };
  }

  let score = 0;

  // Base: hizo algo (40 pts)
  score += 40;
  met.push(
    `${workouts.length} actividad${workouts.length > 1 ? "es" : ""} registrada${workouts.length > 1 ? "s" : ""}`
  );

  // Gym (20 pts)
  const hasGym = workouts.some((w) => w.type === "GYM");
  if (hasGym) {
    score += 20;
    met.push("Fue al gym ✓");
  } else if (isGymDay) {
    missed.push("Hoy era día de gym (sin registro de gym)");
  } else {
    missed.push("Sin gym hoy");
  }

  // Duración total ≥ 45 min (20 pts)
  const totalMinutes = workouts.reduce(
    (sum, w) => sum + (w.durationMinutes ?? 0),
    0
  );
  if (totalMinutes >= 45) {
    score += 20;
    met.push(`Duración total: ${totalMinutes} min ✓`);
  } else if (totalMinutes > 0) {
    missed.push(`Duración: ${totalMinutes} min (objetivo: ≥ 45 min)`);
  } else {
    missed.push("Sin duración registrada");
  }

  // Actividad cardiovascular (20 pts)
  const hasCardio = workouts.some((w) =>
    ["RUNNING", "SWIMMING", "CYCLING"].includes(w.type)
  );
  if (hasCardio) {
    score += 20;
    met.push("Actividad cardiovascular ✓");
  } else {
    missed.push("Sin actividad cardiovascular");
  }

  return { score: Math.min(score, 100), met, missed };
}

/**
 * Función exportada para que el agente de fitness pueda calcular el score
 * sin cargar el módulo de scoring completo.
 */
export async function calcFitnessScoreForDate(
  userId: string,
  date: Date
): Promise<ModuleScoreResult> {
  return calcFitnessScore(userId, date);
}

// -------------------------------------------------------
// Score de NUTRICIÓN
// Criterios:
//   +20  Registró desayuno
//   +30  Registró almuerzo
//   +30  Registró cena
//   +20  Cumplió meta de agua (settings.dailyWaterGoalThermos)
// -------------------------------------------------------

async function calcNutritionScore(
  userId: string,
  date: Date
): Promise<ModuleScoreResult> {
  const met: string[] = [];
  const missed: string[] = [];

  const [meals, waterLogs, settings] = await Promise.all([
    db.meal.findMany({
      where: {
        userId,
        date: startOfDay(date),
      },
    }),
    db.waterLog.findMany({
      where: {
        userId,
        date: startOfDay(date),
      },
    }),
    db.userSettings.findUnique({ where: { userId } }),
  ]);

  if (meals.length === 0 && waterLogs.length === 0) {
    return {
      score: null,
      met: [],
      missed: ["No se registraron comidas ni agua"],
    };
  }

  let score = 0;
  const mealTypes = meals.map((m) => m.mealType);
  const waterGoal = settings?.dailyWaterGoalThermos ?? 1.0;
  const totalWater = waterLogs.reduce((acc, w) => acc + w.thermos, 0);

  if (mealTypes.includes("BREAKFAST")) {
    score += 20;
    met.push("Desayuno registrado");
  } else {
    missed.push("Sin desayuno registrado");
  }

  if (mealTypes.includes("LUNCH")) {
    score += 30;
    met.push("Almuerzo registrado");
  } else {
    missed.push("Sin almuerzo registrado");
  }

  if (mealTypes.includes("DINNER")) {
    score += 30;
    met.push("Cena registrada");
  } else {
    missed.push("Sin cena registrada");
  }

  if (totalWater >= waterGoal) {
    score += 20;
    met.push(
      `Hidratación: ${totalWater.toFixed(1)}/${waterGoal.toFixed(1)} termos ✓`
    );
  } else {
    missed.push(
      `Hidratación: ${totalWater.toFixed(1)}/${waterGoal.toFixed(1)} termos`
    );
  }

  return { score: Math.min(score, 100), met, missed };
}

// -------------------------------------------------------
// Score de PROYECTOS
// Criterios:
//   +30  Tiene al menos 1 proyecto en IN_PROGRESS
//   +40  Completó al menos 1 tarea hoy
//   +30  Avanzó en algún proyecto hoy (updatedAt reciente)
// -------------------------------------------------------

async function calcProjectsScore(
  userId: string,
  date: Date
): Promise<ModuleScoreResult> {
  const met: string[] = [];
  const missed: string[] = [];

  const [activeProjects, tasksCompletedToday, projectsUpdatedToday] =
    await Promise.all([
      db.project.findMany({
        where: { userId, status: "IN_PROGRESS" },
        select: { id: true, title: true },
      }),
      db.projectTask.findMany({
        where: {
          done: true,
          project: { userId },
          updatedAt: {
            gte: startOfDay(date),
            lte: endOfDay(date),
          },
        },
        select: { id: true, title: true },
      }),
      db.project.findMany({
        where: {
          userId,
          updatedAt: {
            gte: startOfDay(date),
            lte: endOfDay(date),
          },
        },
        select: { id: true, title: true },
      }),
    ]);

  if (
    activeProjects.length === 0 &&
    tasksCompletedToday.length === 0 &&
    projectsUpdatedToday.length === 0
  ) {
    return {
      score: null,
      met: [],
      missed: [
        "Sin proyectos activos ni avances registrados",
      ],
    };
  }

  let score = 0;

  if (activeProjects.length > 0) {
    score += 30;
    met.push(
      `${activeProjects.length} proyecto${activeProjects.length > 1 ? "s" : ""} en progreso`
    );
  } else {
    missed.push("Sin proyectos en progreso");
  }

  if (tasksCompletedToday.length > 0) {
    score += 40;
    met.push(
      `${tasksCompletedToday.length} tarea${tasksCompletedToday.length > 1 ? "s" : ""} completada${tasksCompletedToday.length > 1 ? "s" : ""} hoy`
    );
  } else {
    missed.push("Sin tareas completadas hoy");
  }

  if (projectsUpdatedToday.length > 0) {
    score += 30;
    met.push(
      `Avance en: ${projectsUpdatedToday
        .slice(0, 2)
        .map((p) => p.title)
        .join(", ")}`
    );
  } else {
    missed.push("Sin actualizaciones de proyectos hoy");
  }

  return { score: Math.min(score, 100), met, missed };
}

// -------------------------------------------------------
// Función principal: calcular score completo de un día
// -------------------------------------------------------

export async function calculateFullScore(
  userId: string,
  date: Date
): Promise<FullScoreResult> {
  // Global = promedio de Sueño, Fitness, Nutrición y Proyectos (Ideas excluida)
  const [sleep, fitness, nutrition, projects] = await Promise.all([
    calcSleepScore(userId, date),
    calcFitnessScore(userId, date),
    calcNutritionScore(userId, date),
    calcProjectsScore(userId, date),
  ]);

  const global = average([
    sleep.score,
    fitness.score,
    nutrition.score,
    projects.score,
  ]);

  return { sleep, fitness, nutrition, projects, global };
}

// -------------------------------------------------------
// Guardar score calculado en la DB (upsert)
// -------------------------------------------------------

export async function saveScore(
  userId: string,
  date: Date,
  result: FullScoreResult
): Promise<void> {
  const details: ScoreDetails = {
    sleep: { met: result.sleep.met, missed: result.sleep.missed },
    fitness: { met: result.fitness.met, missed: result.fitness.missed },
    nutrition: { met: result.nutrition.met, missed: result.nutrition.missed },
    projects: { met: result.projects.met, missed: result.projects.missed },
  };

  await db.dailyScore.upsert({
    where: {
      userId_date: {
        userId,
        date: startOfDay(date),
      },
    },
    update: {
      sleepScore: result.sleep.score,
      fitnessScore: result.fitness.score,
      nutritionScore: result.nutrition.score,
      projectsScore: result.projects.score,
      globalScore: result.global,
      details,
    },
    create: {
      userId,
      date: startOfDay(date),
      sleepScore: result.sleep.score,
      fitnessScore: result.fitness.score,
      nutritionScore: result.nutrition.score,
      projectsScore: result.projects.score,
      globalScore: result.global,
      details,
    },
  });
}

// -------------------------------------------------------
// Leer score de un día desde la DB (sin recalcular)
// -------------------------------------------------------

export async function getStoredScore(
  userId: string,
  date: Date
): Promise<DailyScoreData | null> {
  const score = await db.dailyScore.findUnique({
    where: {
      userId_date: {
        userId,
        date: startOfDay(date),
      },
    },
  });

  if (!score) return null;

  return {
    sleep: score.sleepScore,
    fitness: score.fitnessScore,
    nutrition: score.nutritionScore,
    projects: score.projectsScore,
    global: score.globalScore ?? 0,
    date: score.date,
    details: (score.details as DailyScoreData["details"]) ?? undefined,
  };
}

// -------------------------------------------------------
// Leer histórico de scores (para gráficos)
// -------------------------------------------------------

export type HistoricalScoreEntry = {
  date: string; // ISO string, para Recharts
  global: number | null;
  sleep: number | null;
  fitness: number | null;
  nutrition: number | null;
  projects: number | null;
};

export async function getScoreHistory(
  userId: string,
  from: Date,
  to: Date
): Promise<HistoricalScoreEntry[]> {
  const scores = await db.dailyScore.findMany({
    where: {
      userId,
      date: {
        gte: startOfDay(from),
        lte: endOfDay(to),
      },
    },
    orderBy: { date: "asc" },
  });

  return scores.map((s) => ({
    date: s.date.toISOString().split("T")[0],
    global: s.globalScore,
    sleep: s.sleepScore,
    fitness: s.fitnessScore,
    nutrition: s.nutritionScore,
    projects: s.projectsScore,
  }));
}

// -------------------------------------------------------
// Generar datos mock para demostración visual
// (se usa cuando no hay datos reales en la DB)
// -------------------------------------------------------

export function generateMockHistory(days: number): HistoricalScoreEntry[] {
  const entries: HistoricalScoreEntry[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];

    // Generar valores semirandom pero con tendencia (seed por fecha)
    const seed = d.getDate() + d.getMonth() * 31;
    const rand = (base: number, variance: number) =>
      Math.max(0, Math.min(100, Math.round(base + (((seed * 7 + variance) % 30) - 15))));

    const sleep = rand(72, 1);
    const fitness = d.getDay() % 2 === 0 ? null : rand(80, 2);
    const nutrition = rand(65, 3);
    const projects = rand(55, 4);

    const validScores = [sleep, fitness, nutrition, projects].filter(
      (v): v is number => v !== null
    );
    const global =
      validScores.length > 0
        ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
        : null;

    entries.push({ date: dateStr, global, sleep, fitness, nutrition, projects });
  }

  return entries;
}

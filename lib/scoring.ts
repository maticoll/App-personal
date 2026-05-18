// ============================================================
// Lógica de Scoring — lib/scoring.ts
//
// Criterios por módulo (basados en UserGoals del usuario):
//   Sleep     /100  →  duración vs objetivo + calidad Garmin
//   Fitness   /100  →  workout completado + duración vs objetivo
//   Nutrition /100  →  macros reales vs objetivos
//   Projects  /100  →  tareas completadas vs objetivo semanal
//   Finances  /100  →  gastos vs presupuesto + ahorro vs objetivo
//
// Global = promedio PONDERADO según UserGoals.weight* (excluye nulls)
// ============================================================

import { db } from "@/lib/db";
import { average } from "@/lib/utils";
import { getGoals, normalizeWeights, calcWeightedGlobal } from "@/lib/goals";
import type { DailyScoreData, ScoreDetails } from "@/lib/types";
import type { UserGoals } from "@prisma/client";

// -------------------------------------------------------
// Tipos internos
// -------------------------------------------------------

export type ModuleScoreResult = {
  score: number | null;
  met: string[];
  missed: string[];
};

// FullScoreResult se define más abajo junto a calcFinancesScore (incluye finances)

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
// Score de SUEÑO — Basado en UserGoals del usuario
//
// Total: 100 puntos (3 bloques)
//
// Bloque Registro  (30 pts):
//   +30  bedTime + wakeTime registrados
//   +15  solo bedTime (registro parcial)
//
// Bloque Duración  (40 pts) — proporcional al objetivo:
//   Usa goals.sleepTargetHours como meta
//   +40  ≥ 95% del objetivo (ej: meta 8h → ≥ 7.6h)
//   +28  ≥ 85% del objetivo
//   +16  ≥ 75% del objetivo
//   +0   < 75%
//
// Bloque Calidad   (30 pts — dos modos):
//   Sin Garmin: hora vs goals.sleepTargetBedTime
//     +30  ≤ bedTime objetivo
//     +20  ≤ bedTime objetivo + 30min
//     +10  ≤ bedTime objetivo + 60min
//   Con Garmin: proporcional al garminScore
//
// Comportamiento null: sin registro → null (excluido del promedio)
// -------------------------------------------------------

async function calcSleepScore(
  userId: string,
  date: Date,
  goals?: UserGoals
): Promise<ModuleScoreResult> {
  const met: string[] = [];
  const missed: string[] = [];

  const [log, userGoals] = await Promise.all([
    db.sleepLog.findUnique({
      where: { userId_date: { userId, date: startOfDay(date) } },
    }),
    goals ?? getGoals(userId),
  ]);

  if (!log) {
    return { score: null, met: [], missed: ["No se registró el sueño"] };
  }

  let score = 0;
  const targetHours = userGoals.sleepTargetHours;

  // === Bloque Registro (30 pts) ===
  if (log.wakeTime) {
    score += 30;
    met.push("Sueño registrado completo");
  } else {
    score += 15;
    met.push("Hora de dormir registrada (falta hora de despertar)");
    missed.push("No se registró la hora de despertar");
  }

  // === Bloque Duración (40 pts) — proporcional al objetivo ===
  let actualHours: number | null = null;
  if (log.durationMinutes !== null) {
    actualHours = log.durationMinutes / 60;
  } else if (log.wakeTime) {
    actualHours = (log.wakeTime.getTime() - log.bedTime.getTime()) / (1000 * 60 * 60);
  }

  if (actualHours !== null) {
    const hoursRounded = Math.round(actualHours * 10) / 10;
    const ratio = actualHours / targetHours;

    if (ratio >= 0.95) {
      score += 40;
      met.push(`Duración: ${hoursRounded}h (objetivo: ${targetHours}h) ✓`);
    } else if (ratio >= 0.85) {
      score += 28;
      met.push(`Duración: ${hoursRounded}h (objetivo: ${targetHours}h)`);
      missed.push(`Cerca del objetivo — faltan ${Math.round((targetHours - actualHours) * 60)}min`);
    } else if (ratio >= 0.75) {
      score += 16;
      missed.push(`Duración baja: ${hoursRounded}h (objetivo: ${targetHours}h)`);
    } else {
      missed.push(`Duración insuficiente: ${hoursRounded}h (objetivo: ${targetHours}h)`);
    }
  } else {
    missed.push("Sin hora de despertar — no se puede calcular la duración");
  }

  // === Bloque Calidad (30 pts) ===
  if (log.garminScore !== null) {
    const garminContrib = Math.round((log.garminScore / 100) * 30);
    score += garminContrib;
    met.push(`Calidad Garmin: ${log.garminScore}/100`);
    if (log.garminScore < 60) {
      missed.push(`Calidad de sueño baja (${log.garminScore}/100)`);
    }
  } else {
    // Sin Garmin: comparar hora de acostarse vs objetivo
    const [targetH, targetM] = userGoals.sleepTargetBedTime.split(":").map(Number);
    const targetBedDecimal = targetH < 12 ? targetH + 24 : targetH; // normalizar noche
    const targetBedNorm = targetBedDecimal + targetM / 60;

    const bedHour = log.bedTime.getHours() + log.bedTime.getMinutes() / 60;
    const normalizedBedHour = bedHour < 12 ? bedHour + 24 : bedHour;

    if (normalizedBedHour <= targetBedNorm) {
      score += 30;
      met.push(`Hora de dormir: ${formatBedTime(log.bedTime)} (meta: ${userGoals.sleepTargetBedTime}) ✓`);
    } else if (normalizedBedHour <= targetBedNorm + 0.5) {
      score += 20;
      met.push(`Hora de dormir: ${formatBedTime(log.bedTime)}`);
      missed.push(`Intentá dormir antes de las ${userGoals.sleepTargetBedTime}`);
    } else if (normalizedBedHour <= targetBedNorm + 1) {
      score += 10;
      missed.push(`Hora tardía: ${formatBedTime(log.bedTime)} (meta: ${userGoals.sleepTargetBedTime})`);
    } else {
      missed.push(`Hora muy tardía: ${formatBedTime(log.bedTime)} (meta: ${userGoals.sleepTargetBedTime})`);
    }

    missed.push("Conectá Garmin para el score de calidad del sueño");
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
// Score de FITNESS — Basado en UserGoals del usuario
//
// Total: 100 puntos (4 bloques)
//
// Bloque Base     (40 pts): cualquier actividad registrada
// Bloque Gym      (20 pts): tipo GYM registrado
// Bloque Duración (20 pts): vs goals.fitnessTargetGymDuration
// Bloque Cardio   (20 pts): RUNNING / SWIMMING / CYCLING
//
// Comportamiento null vs 0:
//   null → sin datos y no es día de gym configurado
//   0    → era día de gym configurado y no se registró nada
// -------------------------------------------------------

function getDayName(date: Date): string {
  const days = ["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"];
  return days[date.getDay()];
}

async function calcFitnessScore(
  userId: string,
  date: Date,
  goals?: UserGoals
): Promise<ModuleScoreResult> {
  const met: string[] = [];
  const missed: string[] = [];

  const [workouts, settings, userGoals] = await Promise.all([
    db.workout.findMany({
      where: { userId, date: { gte: startOfDay(date), lte: endOfDay(date) } },
    }),
    db.userSettings.findUnique({ where: { userId } }),
    goals ?? getGoals(userId),
  ]);

  const dayName = getDayName(date);
  const isGymDay = (settings?.gymDays ?? []).includes(dayName);
  const targetDuration = userGoals.fitnessTargetGymDuration;

  if (workouts.length === 0) {
    if (isGymDay && (settings?.gymDays?.length ?? 0) > 0) {
      return { score: 0, met: [], missed: ["Hoy era día de gym — sin actividad registrada"] };
    }
    return { score: null, met: [], missed: ["Sin actividad física registrada"] };
  }

  let score = 0;

  // Base: hizo algo (40 pts)
  score += 40;
  met.push(`${workouts.length} actividad${workouts.length > 1 ? "es" : ""} registrada${workouts.length > 1 ? "s" : ""}`);

  // Gym (20 pts)
  const hasGym = workouts.some((w) => w.type === "GYM");
  if (hasGym) {
    score += 20;
    met.push("Fue al gym ✓");
  } else if (isGymDay) {
    missed.push("Hoy era día de gym (sin registro de gym)");
  }

  // Duración vs objetivo (20 pts)
  const totalMinutes = workouts.reduce((sum, w) => sum + (w.durationMinutes ?? 0), 0);
  if (totalMinutes >= targetDuration) {
    score += 20;
    met.push(`Duración: ${totalMinutes}min (objetivo: ${targetDuration}min) ✓`);
  } else if (totalMinutes >= targetDuration * 0.75) {
    score += 10;
    met.push(`Duración: ${totalMinutes}min (objetivo: ${targetDuration}min)`);
    missed.push(`Faltan ${targetDuration - totalMinutes}min para el objetivo`);
  } else if (totalMinutes > 0) {
    missed.push(`Duración baja: ${totalMinutes}min (objetivo: ${targetDuration}min)`);
  } else {
    missed.push("Sin duración registrada");
  }

  // Actividad cardiovascular (20 pts)
  const hasCardio = workouts.some((w) => ["RUNNING", "SWIMMING", "CYCLING"].includes(w.type));
  if (hasCardio) {
    score += 20;
    met.push("Actividad cardiovascular ✓");
  } else {
    missed.push("Sin actividad cardiovascular");
  }

  return { score: Math.min(score, 100), met, missed };
}

export async function calcFitnessScoreForDate(
  userId: string,
  date: Date
): Promise<ModuleScoreResult> {
  return calcFitnessScore(userId, date);
}

// -------------------------------------------------------
// Score de NUTRICIÓN — Basado en macros reales vs UserGoals
//
// Total: 100 puntos (3 bloques)
//
// Bloque Registro (20 pts):
//   +20  Al menos 2 comidas principales registradas
//   +10  Al menos 1 comida registrada
//
// Bloque Macros (60 pts) — proporcional al objetivo:
//   Proteína (25 pts): ratio real/objetivo
//   Calorías (20 pts): penaliza exceso Y déficit
//   Grasa    (15 pts): ratio real/objetivo
//
//   Si no hay macros calculadas (sin IA) → fallback a scoring
//   por tipos de comida registrados (desayuno/almuerzo/cena)
//
// Bloque Agua (20 pts): termos vs settings.dailyWaterGoalThermos
// -------------------------------------------------------

async function calcNutritionScore(
  userId: string,
  date: Date,
  goals?: UserGoals
): Promise<ModuleScoreResult> {
  const met: string[] = [];
  const missed: string[] = [];

  const [meals, waterLogs, settings, userGoals] = await Promise.all([
    db.meal.findMany({ where: { userId, date: startOfDay(date) } }),
    db.waterLog.findMany({ where: { userId, date: startOfDay(date) } }),
    db.userSettings.findUnique({ where: { userId } }),
    goals ?? getGoals(userId),
  ]);

  if (meals.length === 0 && waterLogs.length === 0) {
    return { score: null, met: [], missed: ["No se registraron comidas ni agua"] };
  }

  let score = 0;
  const mealTypes = meals.map((m) => m.mealType);
  const waterGoal = settings?.dailyWaterGoalThermos ?? 1.0;
  const totalWater = waterLogs.reduce((acc, w) => acc + w.thermos, 0);

  // === Bloque Registro (20 pts) ===
  const mainMeals = ["BREAKFAST", "LUNCH", "DINNER"].filter((t) => mealTypes.includes(t as never));
  if (mainMeals.length >= 2) {
    score += 20;
    met.push(`${mainMeals.length} comidas principales registradas`);
  } else if (mainMeals.length === 1) {
    score += 10;
    met.push("1 comida principal registrada");
    missed.push("Registrá al menos 2 comidas principales para el puntaje completo");
  } else {
    missed.push("Solo snacks registrados — sin comidas principales");
  }

  // === Bloque Macros (60 pts) ===
  const totalProtein  = meals.reduce((s, m) => s + (m.proteinG  ?? 0), 0);
  const totalCalories = meals.reduce((s, m) => s + (m.calories  ?? 0), 0);
  const totalFat      = meals.reduce((s, m) => s + (m.fatG      ?? 0), 0);
  const hasMacros = totalProtein > 0 || totalCalories > 0;

  if (hasMacros) {
    // Proteína (25 pts) — proporcional, cap en 100%
    const proteinRatio = Math.min(totalProtein / userGoals.nutritionTargetProtein, 1);
    const proteinPts = Math.round(proteinRatio * 25);
    score += proteinPts;
    if (proteinRatio >= 0.9) {
      met.push(`Proteína: ${Math.round(totalProtein)}g / ${userGoals.nutritionTargetProtein}g ✓`);
    } else {
      missed.push(`Proteína baja: ${Math.round(totalProtein)}g (objetivo: ${userGoals.nutritionTargetProtein}g)`);
    }

    // Calorías (20 pts) — penaliza déficit y exceso
    const calRatio = totalCalories / userGoals.nutritionTargetCalories;
    let calPts = 0;
    if (calRatio >= 0.9 && calRatio <= 1.1) {
      calPts = 20;
      met.push(`Calorías: ${Math.round(totalCalories)}kcal (objetivo: ${userGoals.nutritionTargetCalories}kcal) ✓`);
    } else if (calRatio >= 0.8 && calRatio <= 1.2) {
      calPts = 12;
      met.push(`Calorías: ${Math.round(totalCalories)}kcal (objetivo: ${userGoals.nutritionTargetCalories}kcal)`);
    } else if (calRatio > 1.2) {
      calPts = 5;
      missed.push(`Exceso calórico: ${Math.round(totalCalories)}kcal (objetivo: ${userGoals.nutritionTargetCalories}kcal)`);
    } else {
      missed.push(`Déficit calórico: ${Math.round(totalCalories)}kcal (objetivo: ${userGoals.nutritionTargetCalories}kcal)`);
    }
    score += calPts;

    // Grasa (15 pts) — proporcional, cap en 100%
    if (totalFat > 0) {
      const fatRatio = Math.min(totalFat / userGoals.nutritionTargetFat, 1.2);
      const fatPts = fatRatio <= 1.1 ? Math.round(Math.min(fatRatio, 1) * 15) : 8;
      score += fatPts;
      if (fatRatio >= 0.85 && fatRatio <= 1.1) {
        met.push(`Grasas: ${Math.round(totalFat)}g (objetivo: ${userGoals.nutritionTargetFat}g) ✓`);
      } else {
        missed.push(`Grasas: ${Math.round(totalFat)}g (objetivo: ${userGoals.nutritionTargetFat}g)`);
      }
    } else {
      missed.push("Sin datos de grasas — registrá comidas con IA para calcular macros");
    }
  } else {
    // Fallback sin macros: scoring por tipos (desayuno/almuerzo/cena)
    if (mealTypes.includes("BREAKFAST")) { score += 15; met.push("Desayuno registrado"); }
    else missed.push("Sin desayuno");
    if (mealTypes.includes("LUNCH"))     { score += 25; met.push("Almuerzo registrado"); }
    else missed.push("Sin almuerzo");
    if (mealTypes.includes("DINNER"))    { score += 20; met.push("Cena registrada"); }
    else missed.push("Sin cena");
    missed.push("Activá el cálculo de macros con IA para un score más preciso");
  }

  // === Bloque Agua (20 pts) ===
  if (totalWater >= waterGoal) {
    score += 20;
    met.push(`Hidratación: ${totalWater.toFixed(1)}/${waterGoal.toFixed(1)} termos ✓`);
  } else {
    missed.push(`Hidratación: ${totalWater.toFixed(1)}/${waterGoal.toFixed(1)} termos`);
  }

  return { score: Math.min(score, 100), met, missed };
}

export async function calcNutritionScoreForDate(
  userId: string,
  date: Date
): Promise<ModuleScoreResult> {
  return calcNutritionScore(userId, date);
}

// -------------------------------------------------------
// Score de PROYECTOS — Criterios actualizados Sesión 6
//
// Actividad (60 pts):
//   +40  Al menos 1 tarea completada hoy
//   +20  2 o más tareas completadas hoy (bonus)
//
// Estado (40 pts):
//   +20  Tiene al menos 1 proyecto IN_PROGRESS
//   +20  Sin deadlines vencidos (proyectos no DONE/ARCHIVED con deadline < now)
//
// Null: sin proyectos creados
// 0–40: hay proyectos pero sin actividad de tareas hoy (se evalúa igual el estado)
// -------------------------------------------------------

async function calcProjectsScore(
  userId: string,
  date: Date
): Promise<ModuleScoreResult> {
  const met: string[] = [];
  const missed: string[] = [];
  const now = new Date();

  const [totalProjects, tasksCompletedToday, activeProjects, overdueProjects] =
    await Promise.all([
      db.project.count({ where: { userId } }),
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
      db.project.count({
        where: { userId, status: "IN_PROGRESS" },
      }),
      db.project.count({
        where: {
          userId,
          deadline: { lt: now },
          status: { notIn: ["DONE", "ARCHIVED"] },
        },
      }),
    ]);

  // Null si no hay ningún proyecto
  if (totalProjects === 0) {
    return { score: null, met: [], missed: ["Sin proyectos creados"] };
  }

  // Sin actividad de tareas hoy — evaluar solo estado (0-40 pts)
  if (tasksCompletedToday.length === 0) {
    const stateScore = activeProjects > 0 ? 20 : 0;
    const deadlineScore = overdueProjects === 0 ? 20 : 0;

    if (activeProjects > 0) {
      met.push(
        `${activeProjects} proyecto${activeProjects > 1 ? "s" : ""} en progreso`
      );
    } else {
      missed.push("Sin proyectos en progreso");
    }

    if (overdueProjects === 0) {
      met.push("Sin deadlines vencidos");
    } else {
      missed.push(
        `${overdueProjects} proyecto${overdueProjects > 1 ? "s" : ""} con deadline vencido`
      );
    }

    missed.push("Sin tareas completadas hoy");

    return { score: stateScore + deadlineScore, met, missed };
  }

  let score = 0;

  // === Actividad (60 pts) ===
  score += 40;
  met.push(
    `${tasksCompletedToday.length} tarea${tasksCompletedToday.length > 1 ? "s" : ""} completada${tasksCompletedToday.length > 1 ? "s" : ""} hoy`
  );

  if (tasksCompletedToday.length >= 2) {
    score += 20;
    met.push("Gran productividad: 2+ tareas ✓");
  } else {
    missed.push("Completá 2 o más tareas para el bonus de productividad");
  }

  // === Estado de proyectos (40 pts) ===
  if (activeProjects > 0) {
    score += 20;
    met.push(
      `${activeProjects} proyecto${activeProjects > 1 ? "s" : ""} en progreso`
    );
  } else {
    missed.push("Sin proyectos en progreso");
  }

  if (overdueProjects === 0) {
    score += 20;
    met.push("Sin deadlines vencidos ✓");
  } else {
    missed.push(
      `${overdueProjects} proyecto${overdueProjects > 1 ? "s" : ""} con deadline vencido`
    );
  }

  return { score: Math.min(score, 100), met, missed };
}

/**
 * Función exportada para que el agente de proyectos pueda calcular el score
 * sin cargar el módulo de scoring completo.
 */
export async function calcProjectsScoreForDate(
  userId: string,
  date: Date
): Promise<ModuleScoreResult> {
  return calcProjectsScore(userId, date);
}

// -------------------------------------------------------
// Score de FINANZAS — Basado en UserGoals del usuario
//
// Total: 100 puntos (2 bloques)
//
// Bloque Presupuesto (60 pts):
//   Ratio gasto_mes / presupuesto_mes
//   +60  ≤ 90% del presupuesto
//   +40  ≤ 100% del presupuesto
//   +20  ≤ 110% del presupuesto
//   +0   > 110%
//
// Bloque Ahorro (40 pts):
//   Ratio ahorro_proyectado / objetivo_ahorro
//   +40  ≥ 100% del objetivo
//   +25  ≥ 80% del objetivo
//   +10  ≥ 60% del objetivo
//   +0   < 60%
//
// Null: sin API de finanzas configurada o sin datos del mes
// -------------------------------------------------------

async function calcFinancesScore(
  userId: string,
  date: Date,
  goals?: UserGoals
): Promise<ModuleScoreResult> {
  const met: string[] = [];
  const missed: string[] = [];

  const userGoals = goals ?? await getGoals(userId);

  // Obtener datos de finanzas vía lib/finances
  try {
    const { getMonthlyReport } = await import("@/lib/finances");
    const report = await getMonthlyReport(userId);

    if (!report) {
      return { score: null, met: [], missed: ["Sin datos de finanzas este mes"] };
    }

    let score = 0;
    const { totalExpenses, totalIncome } = report.monthly;
    const budget  = userGoals.financesMonthlyBudget;
    const savings = userGoals.financesMonthlyTarget;

    // Bloque Presupuesto (60 pts)
    const spendRatio = totalExpenses / budget;
    if (spendRatio <= 0.9) {
      score += 60;
      met.push(`Gastos: $${Math.round(totalExpenses)} / $${budget} ✓ (${Math.round(spendRatio * 100)}%)`);
    } else if (spendRatio <= 1.0) {
      score += 40;
      met.push(`Gastos: $${Math.round(totalExpenses)} / $${budget} (${Math.round(spendRatio * 100)}%)`);
      missed.push("Cerca del límite de presupuesto");
    } else if (spendRatio <= 1.1) {
      score += 20;
      missed.push(`Presupuesto excedido: $${Math.round(totalExpenses)} / $${budget} (${Math.round(spendRatio * 100)}%)`);
    } else {
      missed.push(`Presupuesto muy excedido: $${Math.round(totalExpenses)} / $${budget} (${Math.round(spendRatio * 100)}%)`);
    }

    // Bloque Ahorro (40 pts) — proyección al fin de mes
    const today = date.getDate();
    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const projectedSavings = (totalIncome - totalExpenses) * (daysInMonth / today);
    const savingsRatio = projectedSavings / savings;

    if (savingsRatio >= 1.0) {
      score += 40;
      met.push(`Ahorro proyectado: $${Math.round(projectedSavings)} (objetivo: $${savings}) ✓`);
    } else if (savingsRatio >= 0.8) {
      score += 25;
      met.push(`Ahorro proyectado: $${Math.round(projectedSavings)} (objetivo: $${savings})`);
      missed.push("Cerca del objetivo de ahorro");
    } else if (savingsRatio >= 0.6) {
      score += 10;
      missed.push(`Ahorro bajo: $${Math.round(projectedSavings)} proyectado (objetivo: $${savings})`);
    } else {
      missed.push(`Ahorro muy por debajo del objetivo (proyectado: $${Math.round(projectedSavings)} / $${savings})`);
    }

    return { score: Math.min(score, 100), met, missed };
  } catch {
    return { score: null, met: [], missed: ["Sin conexión con la app de finanzas"] };
  }
}

export async function calcFinancesScoreForDate(
  userId: string,
  date: Date
): Promise<ModuleScoreResult> {
  return calcFinancesScore(userId, date);
}

// -------------------------------------------------------
// Tipo extendido de resultado con finanzas
// -------------------------------------------------------

export type FullScoreResult = {
  sleep:     ModuleScoreResult;
  fitness:   ModuleScoreResult;
  nutrition: ModuleScoreResult;
  projects:  ModuleScoreResult;
  finances:  ModuleScoreResult;
  global:    number;
};

// -------------------------------------------------------
// Función principal: calcular score completo de un día
// -------------------------------------------------------

export async function calculateFullScore(
  userId: string,
  date: Date
): Promise<FullScoreResult> {
  // Cargar objetivos UNA sola vez y pasarlos a todos los módulos
  const goals = await getGoals(userId);
  const weights = normalizeWeights(goals);

  const [sleep, fitness, nutrition, projects, finances] = await Promise.all([
    calcSleepScore(userId, date, goals),
    calcFitnessScore(userId, date, goals),
    calcNutritionScore(userId, date, goals),
    calcProjectsScore(userId, date),
    calcFinancesScore(userId, date, goals),
  ]);

  // Score global = promedio ponderado (excluye módulos null)
  const global = calcWeightedGlobal(
    { sleep: sleep.score, fitness: fitness.score, nutrition: nutrition.score, finances: finances.score, projects: projects.score },
    weights
  );

  return { sleep, fitness, nutrition, projects, finances, global };
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
    sleep:     { met: result.sleep.met,     missed: result.sleep.missed },
    fitness:   { met: result.fitness.met,   missed: result.fitness.missed },
    nutrition: { met: result.nutrition.met, missed: result.nutrition.missed },
    projects:  { met: result.projects.met,  missed: result.projects.missed },
    finances:  { met: result.finances.met,  missed: result.finances.missed },
  };

  await db.dailyScore.upsert({
    where: { userId_date: { userId, date: startOfDay(date) } },
    update: {
      sleepScore:     result.sleep.score,
      fitnessScore:   result.fitness.score,
      nutritionScore: result.nutrition.score,
      projectsScore:  result.projects.score,
      financesScore:  result.finances.score,
      globalScore:    result.global,
      details,
    },
    create: {
      userId,
      date: startOfDay(date),
      sleepScore:     result.sleep.score,
      fitnessScore:   result.fitness.score,
      nutritionScore: result.nutrition.score,
      projectsScore:  result.projects.score,
      financesScore:  result.finances.score,
      globalScore:    result.global,
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
// Actividad de ideas para dashboard informativo (no entra al score global)
// Retorna cuántas ideas se capturaron en la fecha dada
// -------------------------------------------------------

export async function getIdeasActivityForDate(
  userId: string,
  date: Date
): Promise<number> {
  return db.idea.count({
    where: {
      userId,
      createdAt: {
        gte: startOfDay(date),
        lte: endOfDay(date),
      },
    },
  });
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

// ============================================================
// lib/nutrition.ts — Módulo de Nutrición
// Sesión 5 — Nutrición + Ideas
// ============================================================

import { db } from "@/lib/db";
import type { MealType } from "@prisma/client";

// -------------------------------------------------------
// Tipos
// -------------------------------------------------------

export type MealWithMeta = {
  id: string;
  date: Date;
  mealType: MealType;
  description: string;
  notes: string | null;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  dietAlignmentScore: number | null;
  createdAt: Date;
};

export type NutritionSummary = {
  meals: MealWithMeta[];
  totalWaterThermos: number;
  waterGoalThermos: number;
  totalCalories: number | null;
  totalProteinG: number | null;
  totalCarbsG: number | null;
  totalFatG: number | null;
  hasAllMainMeals: boolean;
};

export type ParsedMacros = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  dietAlignmentScore: number;
};

export type WeeklyNutritionStats = {
  avgCalories: number | null;
  avgWaterThermos: number;
  daysWithAllMeals: number;
  totalMealsLogged: number;
};

export type DietInfo = {
  id: string;
  content: string;
  updatedAt: Date;
} | null;

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
// Obtener resumen nutricional del día
// -------------------------------------------------------

export async function getTodayNutritionSummary(
  userId: string,
  date: Date = new Date()
): Promise<NutritionSummary> {
  const [meals, waterLogs, settings] = await Promise.all([
    db.meal.findMany({
      where: { userId, date: startOfDay(date) },
      orderBy: { createdAt: "asc" },
    }),
    db.waterLog.findMany({
      where: { userId, date: startOfDay(date) },
    }),
    db.userSettings.findUnique({ where: { userId } }),
  ]);

  const totalWaterThermos = waterLogs.reduce((acc, w) => acc + w.thermos, 0);
  const waterGoalThermos = settings?.dailyWaterGoalThermos ?? 1.0;

  const mealsWithMacros = meals.map((m) => ({
    id: m.id,
    date: m.date,
    mealType: m.mealType,
    description: m.description,
    notes: m.notes,
    calories: m.calories,
    proteinG: m.proteinG,
    carbsG: m.carbsG,
    fatG: m.fatG,
    dietAlignmentScore: m.dietAlignmentScore,
    createdAt: m.createdAt,
  }));

  const mealsWithCalories = meals.filter((m) => m.calories !== null);
  const totalCalories =
    mealsWithCalories.length > 0
      ? mealsWithCalories.reduce((acc, m) => acc + (m.calories ?? 0), 0)
      : null;
  const totalProteinG =
    meals.some((m) => m.proteinG !== null)
      ? meals.reduce((acc, m) => acc + (m.proteinG ?? 0), 0)
      : null;
  const totalCarbsG =
    meals.some((m) => m.carbsG !== null)
      ? meals.reduce((acc, m) => acc + (m.carbsG ?? 0), 0)
      : null;
  const totalFatG =
    meals.some((m) => m.fatG !== null)
      ? meals.reduce((acc, m) => acc + (m.fatG ?? 0), 0)
      : null;

  const mealTypes = meals.map((m) => m.mealType);
  const hasAllMainMeals =
    mealTypes.includes("BREAKFAST") &&
    mealTypes.includes("LUNCH") &&
    mealTypes.includes("DINNER");

  return {
    meals: mealsWithMacros,
    totalWaterThermos,
    waterGoalThermos,
    totalCalories,
    totalProteinG,
    totalCarbsG,
    totalFatG,
    hasAllMainMeals,
  };
}

// -------------------------------------------------------
// Historial de comidas (N días)
// -------------------------------------------------------

export type DayNutrition = {
  date: Date;
  meals: MealWithMeta[];
  totalWaterThermos: number;
  waterGoalThermos: number;
  totalCalories: number | null;
};

export async function getMealHistory(
  userId: string,
  days: number = 14
): Promise<DayNutrition[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const [meals, waterLogs, settings] = await Promise.all([
    db.meal.findMany({
      where: {
        userId,
        date: { gte: since },
      },
      orderBy: { date: "desc" },
    }),
    db.waterLog.findMany({
      where: { userId, date: { gte: since } },
    }),
    db.userSettings.findUnique({ where: { userId } }),
  ]);

  const waterGoalThermos = settings?.dailyWaterGoalThermos ?? 1.0;

  // Agrupar por fecha
  const dayMap = new Map<string, DayNutrition>();

  for (const meal of meals) {
    const key = meal.date.toISOString().split("T")[0];
    if (!dayMap.has(key)) {
      dayMap.set(key, {
        date: meal.date,
        meals: [],
        totalWaterThermos: 0,
        waterGoalThermos,
        totalCalories: null,
      });
    }
    const day = dayMap.get(key)!;
    day.meals.push({
      id: meal.id,
      date: meal.date,
      mealType: meal.mealType,
      description: meal.description,
      notes: meal.notes,
      calories: meal.calories,
      proteinG: meal.proteinG,
      carbsG: meal.carbsG,
      fatG: meal.fatG,
      dietAlignmentScore: meal.dietAlignmentScore,
      createdAt: meal.createdAt,
    });
  }

  for (const wl of waterLogs) {
    const key = wl.date.toISOString().split("T")[0];
    if (dayMap.has(key)) {
      dayMap.get(key)!.totalWaterThermos += wl.thermos;
    }
  }

  // Calcular calorías totales por día
  for (const day of dayMap.values()) {
    const withCal = day.meals.filter((m) => m.calories !== null);
    if (withCal.length > 0) {
      day.totalCalories = withCal.reduce((acc, m) => acc + (m.calories ?? 0), 0);
    }
  }

  return Array.from(dayMap.values()).sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  );
}

// -------------------------------------------------------
// Dieta del usuario
// -------------------------------------------------------

export async function getUserDiet(userId: string): Promise<DietInfo> {
  const diet = await db.userDiet.findUnique({ where: { userId } });
  if (!diet) return null;
  return { id: diet.id, content: diet.content, updatedAt: diet.updatedAt };
}

export async function updateUserDiet(
  userId: string,
  content: string
): Promise<DietInfo> {
  const diet = await db.userDiet.upsert({
    where: { userId },
    create: { userId, content },
    update: { content },
  });
  return { id: diet.id, content: diet.content, updatedAt: diet.updatedAt };
}

// -------------------------------------------------------
// Calcular macros + alineación con dieta usando Claude API
// -------------------------------------------------------

async function callClaudeForMacros(
  description: string,
  mealType: string,
  dietContent: string | null
): Promise<ParsedMacros> {
  const dietContext = dietContent
    ? `La dieta habitual del usuario es:\n${dietContent}\n\n`
    : "";

  const prompt = `${dietContext}El usuario registró la siguiente comida (${mealType}): "${description}"

Devolvé ÚNICAMENTE un objeto JSON con exactamente estas claves, sin texto adicional:
{
  "calories": número entero de calorías estimadas,
  "proteinG": gramos de proteína (número con hasta 1 decimal),
  "carbsG": gramos de carbohidratos (número con hasta 1 decimal),
  "fatG": gramos de grasa (número con hasta 1 decimal),
  "dietAlignmentScore": score del 0 al 100 que indica cuánto se alinea esta comida con la dieta del usuario (100 = perfecta alineación, 0 = no se alinea en absoluto${!dietContent ? ", usar 75 si no hay dieta configurada" : ""})
}

Estimá los macros basándote en porciones típicas argentinas. Sé conservador con las calorías.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.content[0].text.trim();

  // Extraer JSON aunque venga con texto alrededor
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in Claude response");

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    calories: Math.round(parsed.calories ?? 0),
    proteinG: parseFloat((parsed.proteinG ?? 0).toFixed(1)),
    carbsG: parseFloat((parsed.carbsG ?? 0).toFixed(1)),
    fatG: parseFloat((parsed.fatG ?? 0).toFixed(1)),
    dietAlignmentScore: Math.min(100, Math.max(0, Math.round(parsed.dietAlignmentScore ?? 75))),
  };
}

// -------------------------------------------------------
// Registrar comida con NLP (Claude calcula macros)
// -------------------------------------------------------

export async function logMealNLP(
  userId: string,
  description: string,
  mealType: MealType,
  date: Date = new Date()
): Promise<MealWithMeta> {
  // Obtener dieta del usuario para contexto
  const diet = await db.userDiet.findUnique({ where: { userId } });

  let macros: ParsedMacros | null = null;
  try {
    macros = await callClaudeForMacros(description, mealType, diet?.content ?? null);
  } catch (err) {
    console.error("[nutrition] Error calculando macros:", err);
    // Continuar sin macros si falla Claude
  }

  const meal = await db.meal.create({
    data: {
      userId,
      date: startOfDay(date),
      mealType,
      description,
      calories: macros?.calories ?? null,
      proteinG: macros?.proteinG ?? null,
      carbsG: macros?.carbsG ?? null,
      fatG: macros?.fatG ?? null,
      dietAlignmentScore: macros?.dietAlignmentScore ?? null,
    },
  });

  return {
    id: meal.id,
    date: meal.date,
    mealType: meal.mealType,
    description: meal.description,
    notes: meal.notes,
    calories: meal.calories,
    proteinG: meal.proteinG,
    carbsG: meal.carbsG,
    fatG: meal.fatG,
    dietAlignmentScore: meal.dietAlignmentScore,
    createdAt: meal.createdAt,
  };
}

// -------------------------------------------------------
// Registrar agua (+1 termo o fracción)
// -------------------------------------------------------

export async function logWater(
  userId: string,
  thermos: number = 1.0,
  date: Date = new Date()
): Promise<{ totalThermos: number; goal: number }> {
  await db.waterLog.create({
    data: { userId, date: startOfDay(date), thermos },
  });

  const [waterLogs, settings] = await Promise.all([
    db.waterLog.findMany({
      where: { userId, date: startOfDay(date) },
    }),
    db.userSettings.findUnique({ where: { userId } }),
  ]);

  const totalThermos = waterLogs.reduce((acc, w) => acc + w.thermos, 0);
  const goal = settings?.dailyWaterGoalThermos ?? 1.0;

  return { totalThermos, goal };
}

// -------------------------------------------------------
// Eliminar comida (verificando ownership)
// -------------------------------------------------------

export async function deleteMeal(userId: string, mealId: string): Promise<void> {
  const meal = await db.meal.findUnique({ where: { id: mealId } });
  if (!meal || meal.userId !== userId) {
    throw new Error("Comida no encontrada o sin permiso");
  }
  await db.meal.delete({ where: { id: mealId } });
}

// -------------------------------------------------------
// Stats semanales
// -------------------------------------------------------

export async function getWeeklyNutritionStats(
  userId: string
): Promise<WeeklyNutritionStats> {
  const since = new Date();
  since.setDate(since.getDate() - 7);
  since.setHours(0, 0, 0, 0);

  const [meals, waterLogs] = await Promise.all([
    db.meal.findMany({
      where: { userId, date: { gte: since } },
    }),
    db.waterLog.findMany({
      where: { userId, date: { gte: since } },
    }),
  ]);

  // Calorías promedio (solo días con datos)
  const dayCaloriesMap = new Map<string, number>();
  for (const meal of meals.filter((m) => m.calories !== null)) {
    const key = meal.date.toISOString().split("T")[0];
    dayCaloriesMap.set(key, (dayCaloriesMap.get(key) ?? 0) + (meal.calories ?? 0));
  }
  const avgCalories =
    dayCaloriesMap.size > 0
      ? Math.round(
          Array.from(dayCaloriesMap.values()).reduce((a, b) => a + b, 0) /
            dayCaloriesMap.size
        )
      : null;

  // Agua promedio
  const dayWaterMap = new Map<string, number>();
  for (const wl of waterLogs) {
    const key = wl.date.toISOString().split("T")[0];
    dayWaterMap.set(key, (dayWaterMap.get(key) ?? 0) + wl.thermos);
  }
  const avgWaterThermos =
    dayWaterMap.size > 0
      ? parseFloat(
          (
            Array.from(dayWaterMap.values()).reduce((a, b) => a + b, 0) /
            7
          ).toFixed(1)
        )
      : 0;

  // Días con las 3 comidas principales
  const dayMealTypesMap = new Map<string, Set<string>>();
  for (const meal of meals) {
    const key = meal.date.toISOString().split("T")[0];
    if (!dayMealTypesMap.has(key)) dayMealTypesMap.set(key, new Set());
    dayMealTypesMap.get(key)!.add(meal.mealType);
  }
  const daysWithAllMeals = Array.from(dayMealTypesMap.values()).filter(
    (types) =>
      types.has("BREAKFAST") && types.has("LUNCH") && types.has("DINNER")
  ).length;

  return {
    avgCalories,
    avgWaterThermos,
    daysWithAllMeals,
    totalMealsLogged: meals.length,
  };
}

// -------------------------------------------------------
// Texto compacto para Morning Summary (Sesión 8)
// -------------------------------------------------------

export async function getNutritionSummaryText(
  userId: string,
  date: Date = new Date()
): Promise<string> {
  const summary = await getTodayNutritionSummary(userId, date);
  const mealNames = summary.meals.map((m) => {
    const labels: Record<MealType, string> = {
      BREAKFAST: "desayuno",
      LUNCH: "almuerzo",
      DINNER: "cena",
      SNACK: "snack",
      OTHER: "comida",
    };
    return labels[m.mealType];
  });

  const lines: string[] = [];
  if (mealNames.length > 0) {
    lines.push(`🥗 Comidas: ${mealNames.join(", ")}`);
  } else {
    lines.push("🥗 Sin comidas registradas");
  }

  lines.push(
    `💧 Agua: ${summary.totalWaterThermos.toFixed(1)}/${summary.waterGoalThermos.toFixed(1)} termos`
  );

  if (summary.totalCalories !== null) {
    lines.push(`🔥 Calorías: ~${Math.round(summary.totalCalories)} kcal`);
  }

  return lines.join("\n");
}

// -------------------------------------------------------
// Texto del recordatorio de hidratación (para cron/WhatsApp)
// -------------------------------------------------------

export async function getWaterReminderText(userId: string): Promise<string | null> {
  const [waterLogs, settings] = await Promise.all([
    db.waterLog.findMany({
      where: { userId, date: startOfDay(new Date()) },
    }),
    db.userSettings.findUnique({ where: { userId } }),
  ]);

  const totalThermos = waterLogs.reduce((acc, w) => acc + w.thermos, 0);
  const goal = settings?.dailyWaterGoalThermos ?? 1.0;

  if (totalThermos >= goal) return null; // Ya cumplió, no enviar recordatorio

  const remaining = (goal - totalThermos).toFixed(1);
  return `💧 Recordatorio de hidratación: llevás ${totalThermos.toFixed(1)}/${goal.toFixed(1)} termos hoy. Te faltan ${remaining} termos para cumplir la meta.`;
}

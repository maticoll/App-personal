// ============================================================
// lib/goals.ts — Objetivos del usuario
//
// CRUD de UserGoals + helpers de pesos del score global.
// Cuando se actualizan los objetivos, notifica a todos los
// agentes y envía confirmación por WhatsApp solo cuando
// todos responden OK (Promise.allSettled).
// ============================================================

import { db } from "@/lib/db";
import type { UserGoals } from "@prisma/client";

// -------------------------------------------------------
// Tipos
// -------------------------------------------------------

export type GoalsInput = Partial<Omit<UserGoals, "id" | "userId" | "createdAt" | "updatedAt">>;

export type WeightedModules = {
  sleep: number;
  fitness: number;
  nutrition: number;
  finances: number;
  projects: number;
};

export type NormalizedWeights = WeightedModules; // porcentajes 0–1

// -------------------------------------------------------
// Obtener objetivos (crea con defaults si no existen)
// -------------------------------------------------------

export async function getGoals(userId: string): Promise<UserGoals> {
  const existing = await db.userGoals.findUnique({ where: { userId } });
  if (existing) return existing;

  // Primera vez: crear con defaults
  return db.userGoals.create({ data: { userId } });
}

// -------------------------------------------------------
// Guardar / actualizar objetivos
// -------------------------------------------------------

export async function upsertGoals(
  userId: string,
  input: GoalsInput
): Promise<UserGoals> {
  return db.userGoals.upsert({
    where: { userId },
    update: { ...input, updatedAt: new Date() },
    create: { userId, ...input },
  });
}

// -------------------------------------------------------
// Normalizar pesos a porcentajes (suma = 1.0)
// -------------------------------------------------------

export function normalizeWeights(goals: UserGoals): NormalizedWeights {
  const total =
    goals.weightSleep +
    goals.weightFitness +
    goals.weightNutrition +
    goals.weightFinances +
    goals.weightProjects;

  if (total === 0) {
    // Fallback: todos iguales
    return { sleep: 0.2, fitness: 0.2, nutrition: 0.2, finances: 0.2, projects: 0.2 };
  }

  return {
    sleep:     goals.weightSleep     / total,
    fitness:   goals.weightFitness   / total,
    nutrition: goals.weightNutrition / total,
    finances:  goals.weightFinances  / total,
    projects:  goals.weightProjects  / total,
  };
}

// -------------------------------------------------------
// Score global ponderado
// Recibe scores nulos (módulo sin datos = excluido del promedio)
// -------------------------------------------------------

export function calcWeightedGlobal(
  scores: { sleep: number | null; fitness: number | null; nutrition: number | null; finances: number | null; projects: number | null },
  weights: NormalizedWeights
): number {
  let weightedSum = 0;
  let activeWeight = 0;

  const entries: [keyof typeof scores, keyof NormalizedWeights][] = [
    ["sleep", "sleep"],
    ["fitness", "fitness"],
    ["nutrition", "nutrition"],
    ["finances", "finances"],
    ["projects", "projects"],
  ];

  for (const [scoreKey, weightKey] of entries) {
    const score = scores[scoreKey];
    if (score !== null) {
      weightedSum += score * weights[weightKey];
      activeWeight += weights[weightKey];
    }
  }

  if (activeWeight === 0) return 0;
  return Math.round(weightedSum / activeWeight);
}

// -------------------------------------------------------
// Notificar a todos los agentes que los objetivos cambiaron
// Espera a que todos respondan antes de confirmar por WA
// -------------------------------------------------------

export type AgentUpdateResult = {
  agent: string;
  ok: boolean;
  error?: string;
};

export async function notifyAgentsGoalsUpdated(
  userId: string,
  goals: UserGoals
): Promise<AgentUpdateResult[]> {
  // Import diferido para evitar circulares
  const { sleepAgent }      = await import("@/agents/sleep");
  const { fitnessAgent }    = await import("@/agents/fitness");
  const { nutritionAgent }  = await import("@/agents/nutrition");
  const { financesAgent }   = await import("@/agents/finances");
  const { projectsAgent }   = await import("@/agents/projects");

  const agents = [
    { name: "sleep",     fn: () => sleepAgent.onGoalsUpdate(userId, goals) },
    { name: "fitness",   fn: () => fitnessAgent.onGoalsUpdate(userId, goals) },
    { name: "nutrition", fn: () => nutritionAgent.onGoalsUpdate(userId, goals) },
    { name: "finances",  fn: () => financesAgent.onGoalsUpdate(userId, goals) },
    { name: "projects",  fn: () => projectsAgent.onGoalsUpdate(userId, goals) },
  ];

  const results = await Promise.allSettled(agents.map((a) => a.fn()));

  return results.map((result, i) => ({
    agent: agents[i].name,
    ok:    result.status === "fulfilled",
    error: result.status === "rejected" ? String(result.reason) : undefined,
  }));
}

// -------------------------------------------------------
// Texto de resumen de objetivos para el mensaje de WA
// -------------------------------------------------------

export function goalsUpdateSummary(goals: UserGoals): string {
  const lines = [
    `😴 Sueño: ${goals.sleepTargetHours}h · dormir ${goals.sleepTargetBedTime} · despertar ${goals.sleepTargetWakeTime}`,
    `💪 Fitness: ${goals.fitnessTargetWeight ? `meta ${goals.fitnessTargetWeight}kg · ` : ""}gym ${goals.fitnessTargetGymDuration}min · cardio ${goals.fitnessTargetCardioWeekly}min/sem`,
    `🥗 Nutrición: ${goals.nutritionTargetCalories}kcal · ${goals.nutritionTargetProtein}g prot · ${goals.nutritionTargetCarbs}g carbs · ${goals.nutritionTargetFat}g grasas`,
    `💰 Finanzas: ahorro $${goals.financesMonthlyTarget}/mes · límite $${goals.financesMonthlyBudget}/mes`,
    `📋 Proyectos: ${goals.projectsTargetTasksPerWeek} tareas/semana`,
  ];
  return lines.join("\n");
}

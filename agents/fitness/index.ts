// ============================================================
// Agente de Fitness
// Responsabilidades:
//   - Registrar entrenamientos en lenguaje natural
//   - Gestionar rutinas de gym
//   - Smart habits: detección y reagendado
//   - Sync con Garmin Connect API
//   - Calcular score de fitness
// ============================================================

import type { AgentInput, AgentOutput } from "@/lib/types";
import {
  parseAndLogExerciseNLP,
  logActivity,
  startGymWorkout,
  getWorkoutHistory,
  getTodayWorkouts,
  getTodayFitnessSummary,
  checkSmartHabitDeviation,
  upsertWorkoutFromGarmin,
} from "@/lib/fitness";
import { checkGarminStatus, fetchGarminActivities } from "@/lib/garmin";
import { calcFitnessScoreForDate } from "@/lib/scoring";
import { detectIntentAI } from "@/lib/nlp";
import { getGoals } from "@/lib/goals";
import { buildFitnessPrompt } from "@/agents/prompts";

// ─── Parser de actividad cardio desde texto ──────────────────────────────────

function parseCardioFromText(text: string): {
  type: "RUNNING" | "SWIMMING" | "WALKING" | "CYCLING" | "OTHER";
  durationMinutes?: number;
  distanceKm?: number;
} {
  let type: "RUNNING" | "SWIMMING" | "WALKING" | "CYCLING" | "OTHER" = "OTHER";

  if (/corr[íi]|run|running|trote/i.test(text)) type = "RUNNING";
  else if (/nadar|nadé|natación|piscina/i.test(text)) type = "SWIMMING";
  else if (/bici|ciclismo/i.test(text)) type = "CYCLING";
  else if (/caminé|caminata|caminando/i.test(text)) type = "WALKING";

  // Duración — busca "Xmin", "X minutos", "X min"
  const durMatch = text.match(/(\d+)\s*(?:min|minuto)/i);
  const durationMinutes = durMatch ? parseInt(durMatch[1]) : undefined;

  // Distancia — busca "Xkm", "X kilómetros", "X,X km"
  const distMatch = text.match(/(\d+(?:[.,]\d+)?)\s*km/i);
  const distanceKm = distMatch
    ? parseFloat(distMatch[1].replace(",", "."))
    : undefined;

  return { type, durationMinutes, distanceKm };
}

// ─── Textos de respuesta ─────────────────────────────────────────────────────

function gymStartedText(routineName?: string): string {
  if (routineName) return `✅ Sesión de gym iniciada: *${routineName}*. ¡A darle!`;
  return `✅ Sesión de gym registrada. ¡A darle!`;
}

function cardioLoggedText(
  type: string,
  durationMinutes?: number,
  distanceKm?: number
): string {
  const labels: Record<string, string> = {
    RUNNING: "Carrera",
    SWIMMING: "Natación",
    CYCLING: "Ciclismo",
    WALKING: "Caminata",
    OTHER: "Actividad",
  };
  const label = labels[type] ?? type;
  const parts: string[] = [];
  if (durationMinutes) parts.push(`${durationMinutes} min`);
  if (distanceKm) parts.push(`${distanceKm} km`);
  const detail = parts.length ? ` (${parts.join(" · ")})` : "";
  return `✅ ${label} registrada${detail}. ¡Bien hecho!`;
}

// ─── getFitnessSummaryText ────────────────────────────────────────────────────
// Usado por el Morning Summary (Sesión 8)

export async function getFitnessSummaryText(userId: string): Promise<string> {
  const summary = await getTodayFitnessSummary(userId);
  if (!summary || summary.workouts.length === 0) return "Sin actividad registrada hoy.";

  const parts: string[] = [];
  if (summary.didGym) parts.push("sesión de gym");
  const cardio = summary.workouts.filter(w => w.type !== "GYM");
  if (cardio.length > 0) parts.push(`${cardio.length} sesión cardio`);
  if (summary.totalActivityMinutes > 0) parts.push(`${summary.totalActivityMinutes} min totales`);

  return `🏋️ Fitness: ${parts.join(", ")}.`;
}

// ─── Agente principal ─────────────────────────────────────────────────────────

export const fitnessAgent = {
  name: "fitness",
  description: "Registra y analiza datos de fitness",

  async process(input: AgentInput): Promise<AgentOutput> {
    const { userId, message } = input;
    const text = message.toLowerCase();

    // Cargar objetivos para contexto del agente
    const goals = await getGoals(userId).catch(() => null);
    const systemPrompt = goals ? buildFitnessPrompt(goals) : undefined;
    void systemPrompt; // usado por detectIntentAI si se refactoriza a NLP

    try {
      // Sync Garmin
      if (/sync|sincronizar|garmin/i.test(text)) {
        const status = await checkGarminStatus(userId);
        if (!status.connected) return { success: true, message: "Garmin no está conectado. Configurá las credenciales en Ajustes." };
        const activities = await fetchGarminActivities(userId, new Date().toISOString().split('T')[0]);
        const synced = activities.length;
        return { success: true, message: synced > 0 ? `✅ ${synced} actividad${synced > 1 ? "es" : ""} importada${synced > 1 ? "s" : ""} de Garmin.` : "No hay actividades nuevas en Garmin para hoy." };
      }

      // Gym start
      if (/empecé gym|fui al gym|gym hoy|empiezo gym|arrancé gym|entren[éo] en el gym/i.test(text)) {
        await startGymWorkout(userId);
        return { success: true, message: gymStartedText() };
      }

      // Cardio log
      if (/corr[íi]|nadar|nadé|bici|caminé|caminata|run|cardio/i.test(text)) {
        const { type, durationMinutes, distanceKm } = parseCardioFromText(message);
        await logActivity(userId, { type, durationMinutes, distanceKm, date: new Date() });
        return { success: true, message: cardioLoggedText(type, durationMinutes, distanceKm) };
      }

      // Exercise NLP (series, pesos)
      if (/series|reps|repeticiones|kg|press|sentadilla|curl|peso/i.test(text)) {
        const result = await parseAndLogExerciseNLP(userId, message);
        return { success: true, message: result.message };
      }

      // Query
      const summary = await getTodayFitnessSummary(userId);
      if (!summary || summary.workouts.length === 0) {
        return { success: true, message: "No hay actividad registrada hoy. ¿Fuiste al gym o hiciste cardio?" };
      }
      const parts: string[] = [];
      if (summary.didGym) parts.push("sesión de gym");
      const cardio = summary.workouts.filter((w: any) => w.type !== "GYM");
      if (cardio.length > 0) parts.push(`${cardio.length} actividad${cardio.length > 1 ? "es" : ""} cardio`);
      if (summary.totalActivityMinutes > 0) parts.push(`${summary.totalActivityMinutes} min totales`);
      return { success: true, message: `Hoy: ${parts.join(", ")}.` };

    } catch {
      return { success: false, message: "Error procesando tu mensaje de fitness." };
    }
  },

  async onGoalsUpdate(_userId: string, _goals: import("@prisma/client").UserGoals): Promise<{ ok: boolean }> {
    return { ok: true };
  },
};

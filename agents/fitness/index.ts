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
  getRoutines,
  getTodayGymRoutine,
  matchRoutineByName,
  getRoutineWithLastPerformance,
  logRoutineSession,
  type RoutineLastPerformance,
  type RoutineSessionComparison,
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
  if (!summary) return "Sin actividad registrada hoy.";

  const parts: string[] = [];
  if (summary.didGym) parts.push("sesión de gym");
  const cardio = summary.workouts.filter(w => w.type !== "GYM");
  if (cardio.length > 0) parts.push(`${cardio.length} sesión cardio`);
  if (summary.totalActivityMinutes > 0) parts.push(`${summary.totalActivityMinutes} min totales`);
  if (summary.steps != null) {
    parts.push(`${summary.steps.toLocaleString("es-UY")} pasos${summary.stepsGoal ? ` (meta ${summary.stepsGoal.toLocaleString("es-UY")})` : ""}`);
  }

  if (parts.length === 0) return "Sin actividad registrada hoy.";
  return `🏋️ Fitness: ${parts.join(", ")}.`;
}

// ─── Rutinas: detección y formateo ────────────────────────────────────────────

function fmtDateShort(date: Date): string {
  return date.toLocaleDateString("es-UY", {
    day: "numeric",
    month: "short",
    timeZone: "America/Montevideo",
  });
}

/** ¿El mensaje tiene datos de ejercicio (pesos/reps/series)? */
function hasExerciseData(text: string): boolean {
  return (
    /\d/.test(text) &&
    /(kg|reps?|repetic|series|serie|\d\s*x\s*\d|x\s*\d)/i.test(text)
  );
}

/** ¿El usuario pide que le traigan/preparen una rutina? */
function wantsBringRoutine(text: string): boolean {
  return /(tra[eé]me|tr[aá]eme|dame|pas[aá]me|mostr|prepar|carg[aá]|quiero (hacer|ver|empezar)|qu[eé] toca|toca hoy)/i.test(
    text
  );
}

/** Formatea un número de peso sin decimales innecesarios (70, no 70.0; 16.5 ok). */
function fmtWeight(n: number | null): string {
  if (n == null) return "—";
  return Number.isInteger(n) ? String(n) : String(n);
}

/**
 * Formato estructurado de una rutina con los pesos de la última sesión:
 *
 *   PULL B
 *   Jalón al pecho agarre neutro 3x8-12
 *   70x12
 *   70x10
 *   70x9
 *
 *   Remo con barra 3x8-10
 *   ...
 */
function formatRoutinePerf(perf: RoutineLastPerformance): string {
  const blocks = perf.exercises.map((ex) => {
    const header = ex.repsRange
      ? `${ex.name} ${ex.plannedSets}x${ex.repsRange}`
      : `${ex.name} ${ex.plannedSets} series`;
    const setLines = ex.lastSets.map((s) => {
      const r = s.reps != null ? s.reps : "—";
      return `${fmtWeight(s.weightKg)}x${r}`;
    });
    return [header, ...setLines].join("\n");
  });

  let out = perf.routineName.toUpperCase() + "\n" + blocks.join("\n\n");
  if (!perf.lastDate) {
    out += "\n\n(Sin registros previos — hoy marcás la primera referencia.)";
  }
  return out;
}

function formatRoutineComparison(cmp: RoutineSessionComparison): string {
  const title = cmp.routineName ?? "Sesión de gym";
  const lines: string[] = [];

  if (cmp.prevDate) {
    lines.push(`💪 ${title} registrada. Progreso vs ${fmtDateShort(cmp.prevDate)}:`);
  } else {
    lines.push(`💪 ${title} registrada. Es tu primera sesión de esta rutina (queda de referencia).`);
  }

  for (const ex of cmp.exercises) {
    const wToday = ex.today.weightKg != null ? `${ex.today.weightKg}kg` : "";
    const rToday = ex.today.reps != null ? ` ×${ex.today.reps}` : "";
    const todayStr = `${wToday}${rToday}`.trim() || "registrado";

    let delta = "";
    if (!ex.prev) {
      delta = " (nuevo)";
    } else if (ex.deltaWeight != null && ex.deltaWeight > 0) {
      delta = ` (subiste ${ex.deltaWeight}kg) ⬆️`;
    } else if (ex.deltaWeight != null && ex.deltaWeight < 0) {
      delta = ` (bajaste ${Math.abs(ex.deltaWeight)}kg) ⬇️`;
    } else if (ex.deltaVolume != null && ex.deltaVolume > 0) {
      delta = ` (más volumen: +${ex.deltaVolume}) ⬆️`;
    } else if (ex.deltaVolume != null && ex.deltaVolume < 0) {
      delta = ` (menos volumen: ${ex.deltaVolume}) ⬇️`;
    } else if (ex.prev) {
      delta = " (igual)";
    }

    lines.push(`• ${ex.name}: ${todayStr}${delta}`);
  }

  return lines.join("\n");
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
      // ── Rutinas por nombre (traer / registrar con comparación) ──────────────
      // Tiene prioridad sobre el log genérico de ejercicios.
      const routines = await getRoutines(userId).catch(() => []);
      const matchedRoutine = matchRoutineByName(routines, message);

      if (matchedRoutine && hasExerciseData(text)) {
        // El usuario mandó la rutina hecha → registrar + comparar con la última
        const cmp = await logRoutineSession(userId, matchedRoutine.name, message);
        return { success: true, message: formatRoutineComparison(cmp) };
      }

      if (matchedRoutine && (wantsBringRoutine(text) || !hasExerciseData(text))) {
        // "tráeme push A" → traer la rutina con los últimos pesos (formato exacto)
        const perf = await getRoutineWithLastPerformance(userId, matchedRoutine.name);
        if (perf) {
          return { success: true, message: formatRoutinePerf(perf), data: { verbatim: true } };
        }
      }

      // "tráeme la rutina de hoy" (sin nombrarla explícitamente)
      if (!matchedRoutine && wantsBringRoutine(text) && /rutina|entren|toca/i.test(text)) {
        const today = await getTodayGymRoutine(userId);
        if (today) {
          const perf = await getRoutineWithLastPerformance(userId, today.name);
          if (perf) {
            return { success: true, message: formatRoutinePerf(perf), data: { verbatim: true } };
          }
        }
      }

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
      if (!summary) {
        return { success: true, message: "No hay actividad registrada hoy. ¿Fuiste al gym o hiciste cardio?" };
      }
      const parts: string[] = [];
      if (summary.didGym) parts.push("sesión de gym");
      const cardio = summary.workouts.filter((w: any) => w.type !== "GYM");
      if (cardio.length > 0) parts.push(`${cardio.length} actividad${cardio.length > 1 ? "es" : ""} cardio`);
      if (summary.totalActivityMinutes > 0) parts.push(`${summary.totalActivityMinutes} min totales`);
      if (summary.steps != null) {
        parts.push(`${summary.steps.toLocaleString("es-UY")} pasos${summary.stepsGoal ? ` (meta ${summary.stepsGoal.toLocaleString("es-UY")})` : ""}`);
      }
      if (parts.length === 0) {
        return { success: true, message: "No hay actividad registrada hoy. ¿Fuiste al gym o hiciste cardio?" };
      }
      return { success: true, message: `Hoy: ${parts.join(", ")}.` };

    } catch {
      return { success: false, message: "Error procesando tu mensaje de fitness." };
    }
  },

  async onGoalsUpdate(_userId: string, _goals: import("@prisma/client").UserGoals): Promise<{ ok: boolean }> {
    return { ok: true };
  },
};

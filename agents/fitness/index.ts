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

// ─── Tipos de intención ───────────────────────────────────────────────────────

type FitnessIntent =
  | "gym_start"       // "fui al gym", "hice gym"
  | "gym_log"         // "press plano 100kg 4x3", "hice curl 12kg 3 series"
  | "cardio_log"      // "corrí 5km 30min", "nadé 40 min"
  | "query"           // "¿cuánto hice esta semana?", "¿mi score?"
  | "sync_garmin"     // "sincronizar garmin"
  | "unknown";

function detectIntent(text: string): FitnessIntent {
  const lower = text.toLowerCase();

  // Garmin sync
  if (/garmin|sincroniz|sync/i.test(lower)) return "sync_garmin";

  // Query
  if (/cuánto|cuanto|score|historial|semana|esta semana|resumen|qué hice|que hice/i.test(lower))
    return "query";

  // Cardio patterns
  if (
    /corr[íi]|run|running|nadar|nadé|natación|bici|ciclismo|caminé|caminata|trote/i.test(lower)
  )
    return "cardio_log";

  // Gym start (no specific exercise)
  if (/fui al gym|hice gym|empecé gym|empecé el gym|fui a gym/i.test(lower))
    return "gym_start";

  // Gym log — has numbers + exercise terms
  if (
    /\d/.test(lower) &&
    /(kg|rep|serie|press|curl|sentadil|squat|peso|barra|mancuerna|pull|push|bench|rdl|hip thrust|deadlift|extension|elevacion|remo)/i.test(
      lower
    )
  )
    return "gym_log";

  // Fallback — if mentions gym
  if (/gym|gimnasio/i.test(lower)) return "gym_start";

  return "unknown";
}

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
  if (!summary || !summary.hasWorkouts) return "Sin actividad registrada hoy.";

  const parts: string[] = [];
  if (summary.gymSessions > 0) parts.push(`${summary.gymSessions} sesión de gym`);
  if (summary.cardioSessions > 0) parts.push(`${summary.cardioSessions} sesión cardio`);
  if (summary.totalMinutes > 0) parts.push(`${summary.totalMinutes} min totales`);

  return `🏋️ Fitness: ${parts.join(", ")}.`;
}

// ─── Agente principal ─────────────────────────────────────────────────────────

export const fitnessAgent = {
  name: "fitness",
  description: "Registra y analiza datos de fitness",

  async process(input: AgentInput): Promise<AgentOutput> {
    const { userId, text } = input;
    const intent = detectIntent(text);

    switch (intent) {
      // ── Iniciar sesión de gym ──
      case "gym_start": {
        try {
          const workout = await startGymWorkout(userId);
          return {
            success: true,
            message: gymStartedText(workout.title ?? undefined),
          };
        } catch {
          return { success: false, message: "Error al registrar la sesión de gym." };
        }
      }

      // ── Loguear ejercicio con NLP ──
      case "gym_log": {
        try {
          const result = await parseAndLogExerciseNLP(userId, text);
          return {
            success: true,
            message: result.message ?? "✅ Ejercicio registrado.",
          };
        } catch (err) {
          return {
            success: false,
            message:
              err instanceof Error
                ? err.message
                : "No pude interpretar el ejercicio. Intentá con: 'press plano 100kg 4 reps 3 series'",
          };
        }
      }

      // ── Registrar cardio ──
      case "cardio_log": {
        try {
          const { type, durationMinutes, distanceKm } = parseCardioFromText(text);
          await logActivity(userId, { type, durationMinutes, distanceKm });
          return {
            success: true,
            message: cardioLoggedText(type, durationMinutes, distanceKm),
          };
        } catch {
          return { success: false, message: "Error al registrar la actividad." };
        }
      }

      // ── Query / resumen ──
      case "query": {
        try {
          const [todayWorkouts, history] = await Promise.all([
            getTodayWorkouts(userId),
            getWorkoutHistory(userId, 7),
          ]);

          const totalThisWeek = history.length;
          const gymDays = history.filter((w) => w.type === "GYM").length;
          const totalMinutes = history.reduce(
            (sum, w) => sum + (w.durationMinutes ?? 0),
            0
          );

          let msg = `📊 *Resumen fitness (7 días)*\n`;
          msg += `• ${totalThisWeek} entrenamientos\n`;
          if (gymDays > 0) msg += `• ${gymDays} días de gym\n`;
          if (totalMinutes > 0) msg += `• ${totalMinutes} min de actividad total\n`;

          if (todayWorkouts.length > 0) {
            const todayLabel = todayWorkouts.map((w) => w.type).join(", ");
            msg += `\nHoy: ${todayLabel} ✅`;
          } else {
            msg += `\nHoy: sin actividad registrada`;
          }

          return { success: true, message: msg };
        } catch {
          return { success: false, message: "Error al obtener el resumen de fitness." };
        }
      }

      // ── Sync Garmin ──
      case "sync_garmin": {
        try {
          const garminStatus = await checkGarminStatus(userId);
          if (!garminStatus.connected) {
            return {
              success: false,
              message:
                "Garmin no está conectado. Configurá las credenciales en Ajustes.",
            };
          }

          const today = new Date();
          const activities = await fetchGarminActivities(userId, today);
          let synced = 0;

          for (const activity of activities) {
            await upsertWorkoutFromGarmin(userId, activity);
            synced++;
          }

          return {
            success: true,
            message:
              synced > 0
                ? `✅ Garmin sincronizado: ${synced} actividad${synced !== 1 ? "es" : ""} importada${synced !== 1 ? "s" : ""}.`
                : "Garmin sincronizado. Sin actividades nuevas hoy.",
          };
        } catch {
          return {
            success: false,
            message: "Error al sincronizar con Garmin.",
          };
        }
      }

      // ── Unknown ──
      default:
        return {
          success: false,
          message:
            "No entendí tu mensaje de fitness. Podés decir: 'fui al gym', 'press plano 100kg 3x4', 'corrí 5km 30min', o 'resumen de la semana'.",
        };
    }
  },

  // ─── Sync completo de Garmin (llamado por el cron job) ──────────────────────
  async syncGarmin(userId: string, date?: Date): Promise<void> {
    const targetDate = date ?? new Date();
    const activities = await fetchGarminActivities(userId, targetDate);
    for (const activity of activities) {
      await upsertWorkoutFromGarmin(userId, activity);
    }
  },

  // ─── Smart habits check ──────────────────────────────────────────────────────
  async checkSmartHabits(userId: string): Promise<AgentOutput | null> {
    const status = await checkSmartHabitDeviation(userId);
    if (!status.shouldNotify) return null;

    return {
      success: true,
      message: status.message ?? "Parece que te perdiste el gym de hoy.",
      // TODO: Sesión 7 — Calendar para proponer nuevo horario
    };
  },

  // ─── Score de fitness ─────────────────────────────────────────────────────────
  async calculateScore(userId: string, date: Date): Promise<number | null> {
    return calcFitnessScoreForDate(userId, date);
  },

  // ─── Texto de resumen para Morning Summary (Sesión 8) ────────────────────────
  async getSummaryText(userId: string): Promise<string> {
    return getFitnessSummaryText(userId);
  },
};

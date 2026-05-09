// ============================================================
// Agente de Scoring
// Sesión 2 — Implementación completa
//
// Responsabilidades:
//   - Calcular score diario por categoría (/100)
//   - Calcular score global (promedio de módulos con datos)
//   - Proveer histórico: diario, semanal, mensual
//   - Alimentar el dashboard con datos de scoring
// ============================================================

import type { AgentInput, AgentOutput, DailyScoreData } from "@/lib/types";
import {
  calculateFullScore,
  saveScore,
  getStoredScore,
  getScoreHistory,
  type HistoricalScoreEntry,
} from "@/lib/scoring";

export const scoringAgent = {
  name: "scoring",
  description: "Calcula y gestiona el scoring diario",

  // -------------------------------------------------------
  // Proceso conversacional (WhatsApp — TODO: Sesión 8)
  // -------------------------------------------------------

  async process(input: AgentInput): Promise<AgentOutput> {
    const userId = input.userId;
    const today = new Date();

    // Si el mensaje es "score", "scoring" o "puntaje"
    const msg = input.message.toLowerCase();
    if (msg.includes("score") || msg.includes("scoring") || msg.includes("puntaje")) {
      try {
        const result = await calculateFullScore(userId, today);
        await saveScore(userId, today, result);

        const lines = [
          `📊 *Score de hoy: ${result.global}/100*`,
          "",
          result.sleep.score !== null ? `🌙 Sueño: ${result.sleep.score}/100` : "🌙 Sueño: sin datos",
          result.fitness.score !== null ? `💪 Fitness: ${result.fitness.score}/100` : "💪 Fitness: sin datos",
          result.nutrition.score !== null ? `🥗 Nutrición: ${result.nutrition.score}/100` : "🥗 Nutrición: sin datos",
          result.projects.score !== null ? `📁 Proyectos: ${result.projects.score}/100` : "📁 Proyectos: sin datos",
        ];

        return {
          success: true,
          message: lines.join("\n"),
          data: result,
        };
      } catch (error) {
        return {
          success: false,
          message: "No pude calcular el score. Intentá de nuevo en un momento.",
          error: String(error),
        };
      }
    }

    return {
      success: false,
      message: "No entendí tu consulta de scoring.",
    };
  },

  // -------------------------------------------------------
  // Calcular score completo de un día (y guardarlo en DB)
  // -------------------------------------------------------

  async calculateDailyScore(userId: string, date: Date): Promise<DailyScoreData> {
    const result = await calculateFullScore(userId, date);
    await saveScore(userId, date, result);

    return {
      sleep: result.sleep.score,
      fitness: result.fitness.score,
      nutrition: result.nutrition.score,
      projects: result.projects.score,
      global: result.global,
      date,
      details: {
        sleep: { met: result.sleep.met, missed: result.sleep.missed },
        fitness: { met: result.fitness.met, missed: result.fitness.missed },
        nutrition: { met: result.nutrition.met, missed: result.nutrition.missed },
        projects: { met: result.projects.met, missed: result.projects.missed },
      },
    };
  },

  // -------------------------------------------------------
  // Leer score guardado del día (sin recalcular)
  // -------------------------------------------------------

  async getTodayScore(userId: string): Promise<DailyScoreData | null> {
    return getStoredScore(userId, new Date());
  },

  // -------------------------------------------------------
  // Obtener histórico (para dashboard y WhatsApp)
  // -------------------------------------------------------

  async getHistorical(
    userId: string,
    period: "daily" | "weekly" | "monthly",
    from: Date,
    to: Date
  ): Promise<HistoricalScoreEntry[]> {
    return getScoreHistory(userId, from, to);
  },

  // -------------------------------------------------------
  // Recalcular todos los scores pendientes de la semana
  // (útil para corregir datos retroactivamente)
  // -------------------------------------------------------

  async recalculateWeek(userId: string): Promise<void> {
    const today = new Date();
    const promises: Promise<unknown>[] = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      promises.push(
        calculateFullScore(userId, d).then((result) =>
          saveScore(userId, d, result)
        )
      );
    }

    await Promise.all(promises);
  },

  // -------------------------------------------------------
  // Generar texto del score para el Morning Summary (Sesión 8)
  // -------------------------------------------------------

  async getSummaryText(userId: string, date: Date): Promise<string> {
    const score = await getStoredScore(userId, date);
    if (!score) return "Sin score registrado ayer.";

    const emoji =
      score.global >= 80
        ? "🔥"
        : score.global >= 60
        ? "✅"
        : score.global >= 40
        ? "🟡"
        : "🟠";

    const lines = [
      `${emoji} *Score de ayer: ${score.global}/100*`,
      score.sleep !== null ? `  🌙 Sueño: ${score.sleep}` : "  🌙 Sueño: sin datos",
      score.fitness !== null ? `  💪 Fitness: ${score.fitness}` : "  💪 Fitness: sin datos",
      score.nutrition !== null ? `  🥗 Nutrición: ${score.nutrition}` : "  🥗 Nutrición: sin datos",
      score.projects !== null ? `  📁 Proyectos: ${score.projects}` : "  📁 Proyectos: sin datos",
    ];

    return lines.join("\n");
  },
};

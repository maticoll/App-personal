// ============================================================
// Agente de Scoring
// Sesion 2 — Implementacion completa
// ============================================================

import type { AgentInput, AgentOutput, DailyScoreData } from "@/lib/types";
import { detectIntentAI } from "@/lib/nlp";
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

  async process(input: AgentInput): Promise<AgentOutput> {
    const { userId, message } = input;
    const today = new Date();

    const intent = await detectIntentAI(
      "Eres el agente de scoring de una app personal.",
      {
        today: "El usuario pregunta por su score, puntaje o rendimiento de hoy",
        yesterday: "El usuario pregunta por su score o puntaje de ayer",
        week: "El usuario pregunta por su score o rendimiento de la semana",
        recalculate: "El usuario quiere recalcular o actualizar el score",
        unknown: "Otro mensaje no relacionado al scoring",
      },
      message
    );

    if (intent === "unknown") {
      return { success: false, message: "No entendi tu consulta de scoring." };
    }

    try {
      let targetDate = today;
      if (intent === "yesterday") {
        targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - 1);
      }

      const result = await calculateFullScore(userId, targetDate);
      await saveScore(userId, targetDate, result);

      const label = intent === "yesterday" ? "ayer" : "hoy";
      const lines = [
        "📊 Score de " + label + ": " + result.global + "/100",
        "",
        result.sleep.score !== null ? "🌙 Sueno: " + result.sleep.score + "/100" : "🌙 Sueno: sin datos",
        result.fitness.score !== null ? "💪 Fitness: " + result.fitness.score + "/100" : "💪 Fitness: sin datos",
        result.nutrition.score !== null ? "🥗 Nutricion: " + result.nutrition.score + "/100" : "🥗 Nutricion: sin datos",
        result.projects.score !== null ? "📁 Proyectos: " + result.projects.score + "/100" : "📁 Proyectos: sin datos",
        result.finances.score !== null ? "💰 Finanzas: " + result.finances.score + "/100" : "💰 Finanzas: sin datos",
      ];

      if (intent === "week") {
        const summaryText = await this.getSummaryText(userId, today);
        return { success: true, message: summaryText, data: result };
      }

      return { success: true, message: lines.join("\n"), data: result };
    } catch (error) {
      return {
        success: false,
        message: "No pude calcular el score. Intenta de nuevo en un momento.",
        error: String(error),
      };
    }
  },

  async calculateDailyScore(userId: string, date: Date): Promise<DailyScoreData> {
    const result = await calculateFullScore(userId, date);
    await saveScore(userId, date, result);

    return {
      sleep: result.sleep.score,
      fitness: result.fitness.score,
      nutrition: result.nutrition.score,
      projects: result.projects.score,
      finances: result.finances.score,
      global: result.global,
      date,
      details: {
        sleep: { met: result.sleep.met, missed: result.sleep.missed },
        fitness: { met: result.fitness.met, missed: result.fitness.missed },
        nutrition: { met: result.nutrition.met, missed: result.nutrition.missed },
        projects: { met: result.projects.met, missed: result.projects.missed },
        finances: { met: result.finances.met, missed: result.finances.missed },
      },
    };
  },

  async getTodayScore(userId: string): Promise<DailyScoreData | null> {
    return getStoredScore(userId, new Date());
  },

  async getHistorical(
    userId: string,
    period: "daily" | "weekly" | "monthly",
    from: Date,
    to: Date
  ): Promise<HistoricalScoreEntry[]> {
    return getScoreHistory(userId, from, to);
  },

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

  async getSummaryText(userId: string, date: Date): Promise<string> {
    const score = await getStoredScore(userId, date);
    if (!score) return "Sin score registrado ayer.";

    const emoji =
      score.global >= 80 ? "🔥"
      : score.global >= 60 ? "✅"
      : score.global >= 40 ? "🟡"
      : "🟠";

    const lines = [
      `${emoji} *Score de ayer: ${score.global}/100*`,
      score.sleep !== null ? `  🌙 Sueno: ${score.sleep}` : "  🌙 Sueno: sin datos",
      score.fitness !== null ? `  💪 Fitness: ${score.fitness}` : "  💪 Fitness: sin datos",
      score.nutrition !== null ? `  🥗 Nutricion: ${score.nutrition}` : "  🥗 Nutricion: sin datos",
      score.projects !== null ? `  📁 Proyectos: ${score.projects}` : "  📁 Proyectos: sin datos",
      score.finances !== null ? `  💰 Finanzas: ${score.finances}` : "  💰 Finanzas: sin datos",
    ];

    return lines.join("\n");
  },
};

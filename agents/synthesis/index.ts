// ============================================================
// Agente de Síntesis — agents/synthesis/index.ts
//
// El Synthesis agent es el único capaz de ver todos los módulos
// a la vez y detectar conexiones que los agentes especialistas
// no pueden ver (ej: "cuando dormís <6h, tus gastos de delivery
// suben un 40%").
//
// Es llamado por:
//   - El cron de Morning Summary (para el insight del día)
//   - El orquestrador cuando detecta una pregunta cross-domain
//   - El API route /api/synthesis/insights (para el dashboard)
// ============================================================

import { db } from "@/lib/db";
import { getGoals } from "@/lib/goals";
import { buildSynthesisPrompt } from "@/agents/prompts";
import { getStoredScore } from "@/lib/scoring";
import { callClaude } from "@/lib/claude";

// ── Tipos ──────────────────────────────────────────────────

export type SynthesisInput = {
  userId: string;
  windowDays?: number; // Cuántos días de historia analizar (default: 7)
};

export type CrossModuleInsight = {
  pattern: string;          // Descripción del patrón detectado
  modules: string[];        // Módulos involucrados
  recommendation: string;   // Acción concreta recomendada
  confidence: "high" | "medium" | "low";
};

export type SynthesisOutput = {
  insights: CrossModuleInsight[];
  summary: string;          // Texto listo para WhatsApp/dashboard
  dataWindow: {
    from: Date;
    to: Date;
    daysWithData: number;
  };
};

// ── Helpers de carga de datos ──────────────────────────────

async function loadMultiModuleData(userId: string, windowDays: number) {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - windowDays);
  from.setHours(0, 0, 0, 0);

  // Cargar datos de todos los módulos en paralelo
  const [sleepLogs, workouts, meals, waterLogs, scores, projects] = await Promise.allSettled([
    db.sleepLog.findMany({
      where: { userId, date: { gte: from, lte: today } },
      orderBy: { date: "asc" },
    }),
    db.workout.findMany({
      where: { userId, date: { gte: from, lte: today } },
      orderBy: { date: "asc" },
    }),
    db.meal.findMany({
      where: { userId, date: { gte: from, lte: today } },
      orderBy: { date: "asc" },
    }),
    db.waterLog.findMany({
      where: { userId, date: { gte: from, lte: today } },
    }),
    db.dailyScore.findMany({
      where: { userId, date: { gte: from, lte: today } },
      orderBy: { date: "asc" },
    }),
    db.project.findMany({
      where: { userId },
      include: {
        tasks: { where: { updatedAt: { gte: from } } },
      },
    }),
  ]);

  return {
    sleepLogs: sleepLogs.status === "fulfilled" ? sleepLogs.value : [],
    workouts:  workouts.status === "fulfilled" ? workouts.value : [],
    meals:     meals.status === "fulfilled" ? meals.value : [],
    waterLogs: waterLogs.status === "fulfilled" ? waterLogs.value : [],
    scores:    scores.status === "fulfilled" ? scores.value : [],
    projects:  projects.status === "fulfilled" ? projects.value : [],
    from,
    to: today,
  };
}

// ── Construcción del contexto para Claude ──────────────────

function buildDataSummary(data: Awaited<ReturnType<typeof loadMultiModuleData>>): string {
  const lines: string[] = [];

  lines.push(`PERÍODO ANALIZADO: ${data.from.toLocaleDateString("es-UY")} → ${data.to.toLocaleDateString("es-UY")}`);
  lines.push("");

  // Sueño
  if (data.sleepLogs.length > 0) {
    lines.push("SUEÑO:");
    for (const log of data.sleepLogs) {
      const dateStr = log.date.toLocaleDateString("es-UY");
      const dur = log.durationMinutes ? `${(log.durationMinutes / 60).toFixed(1)}h` : "sin datos";
      const score = log.garminScore ? ` (calidad: ${log.garminScore}/100)` : "";
      lines.push(`  ${dateStr}: ${dur}${score}`);
    }
    lines.push("");
  }

  // Fitness
  if (data.workouts.length > 0) {
    lines.push("WORKOUTS:");
    // Agrupar por fecha
    const byDate: Record<string, typeof data.workouts> = {};
    for (const w of data.workouts) {
      const key = w.date.toLocaleDateString("es-UY");
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(w);
    }
    for (const [date, ws] of Object.entries(byDate)) {
      const types = ws.map((w: any) => w.type).join(", ");
      const totalMin = ws.reduce((acc: any, w: any) => acc + (w.durationMinutes ?? 0), 0);
      lines.push(`  ${date}: ${types} (${totalMin}min total)`);
    }
    lines.push("");
  }

  // Nutrición
  if (data.meals.length > 0) {
    lines.push("NUTRICIÓN:");
    const byDate: Record<string, typeof data.meals> = {};
    for (const m of data.meals) {
      const key = m.date.toLocaleDateString("es-UY");
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(m);
    }
    for (const [date, ms] of Object.entries(byDate)) {
      const totalCal = ms.reduce((acc: any, m: any) => acc + (m.calories ?? 0), 0);
      const calStr = totalCal > 0 ? ` (~${totalCal}kcal)` : "";
      lines.push(`  ${date}: ${ms.length} comidas${calStr}`);
    }
    lines.push("");
  }

  // Scores diarios
  if (data.scores.length > 0) {
    lines.push("SCORES DIARIOS:");
    for (const s of data.scores) {
      const dateStr = s.date.toLocaleDateString("es-UY");
      const parts = [
        `global: ${s.globalScore}`,
        s.sleepScore !== null ? `sueño: ${s.sleepScore}` : null,
        s.fitnessScore !== null ? `fitness: ${s.fitnessScore}` : null,
        s.nutritionScore !== null ? `nutrición: ${s.nutritionScore}` : null,
        s.projectsScore !== null ? `proyectos: ${s.projectsScore}` : null,
      ].filter(Boolean).join(", ");
      lines.push(`  ${dateStr}: ${parts}`);
    }
    lines.push("");
  }

  // Proyectos
  if (data.projects.length > 0) {
    const inProgress = data.projects.filter((p: any) => p.status === "IN_PROGRESS");
    const recentTasks = data.projects.flatMap((p: any) => p.tasks).length;
    lines.push("PROYECTOS:");
    lines.push(`  En progreso: ${inProgress.length}`);
    lines.push(`  Tareas actualizadas en el período: ${recentTasks}`);
    lines.push("");
  }

  return lines.join("\n");
}

// ── Llamada a Claude para síntesis ──────────────────────────

async function callSynthesisAI(
  systemPrompt: string,
  dataSummary: string
): Promise<string> {
  const userContent =
    `Estos son los datos de Corea de los últimos días:\n\n${dataSummary}\n\n` +
    `Analizá los datos y generá:\n` +
    `1. Máximo 3 patrones o conexiones interesantes que detectés entre módulos\n` +
    `2. Una recomendación concreta y accionable basada en esos patrones\n\n` +
    `Respondé en español rioplatense. Sé específico con los datos. No generalices.\n` +
    `Formato: párrafos cortos, sin markdown, sin asteriscos.`;

  const result = await callClaude({
    model: "claude-sonnet-4-6",
    maxTokens: 400,
    system: systemPrompt,
    messages: [{ role: "user", content: userContent }],
  });

  return result ?? "No se pudo generar el análisis.";
}

// ── API pública del agente ─────────────────────────────────

export const synthesisAgent = {
  name: "synthesis",
  description: "Analiza datos cross-módulo y detecta patrones e insights",

  /**
   * Genera un análisis de síntesis para los últimos N días.
   * Llamado por: morning summary, dashboard, WhatsApp explícito.
   */
  async analyze(input: SynthesisInput): Promise<SynthesisOutput> {
    const { userId, windowDays = 7 } = input;

    const [goals, data] = await Promise.all([
      getGoals(userId).catch(() => null),
      loadMultiModuleData(userId, windowDays),
    ]);

    const systemPrompt = goals
      ? buildSynthesisPrompt(goals)
      : "Sos el agente de síntesis de una app personal. Analizás datos de salud, fitness, nutrición y finanzas.";

    const dataSummary = buildDataSummary(data);
    const daysWithData = new Set([
      ...data.sleepLogs.map((l: any) => l.date.toDateString()),
      ...data.workouts.map((w: any) => w.date.toDateString()),
      ...data.scores.map((s: any) => s.date.toDateString()),
    ]).size;

    // Si hay menos de 3 días de datos, el análisis no tiene sentido
    if (daysWithData < 3) {
      return {
        insights: [],
        summary: `Necesito al menos 3 días de datos para detectar patrones. Hasta ahora tengo ${daysWithData} día${daysWithData !== 1 ? "s" : ""}.`,
        dataWindow: { from: data.from, to: data.to, daysWithData },
      };
    }

    const aiSummary = await callSynthesisAI(systemPrompt, dataSummary);

    return {
      insights: [], // Para una futura versión estructurada con JSON output
      summary: aiSummary,
      dataWindow: { from: data.from, to: data.to, daysWithData },
    };
  },

  /**
   * Versión corta para el Morning Summary — máximo 2-3 líneas.
   */
  async getDailyInsight(userId: string): Promise<string | null> {
    try {
      const result = await this.analyze({ userId, windowDays: 7 });
      if (!result.summary || result.dataWindow.daysWithData < 3) return null;

      // Truncar a las primeras 2-3 oraciones para WhatsApp
      const sentences = result.summary.split(/(?<=[.!?])\s+/);
      const short = sentences.slice(0, 2).join(" ");
      return short.length > 20 ? short : null;
    } catch {
      return null;
    }
  },

  /**
   * Texto completo para WhatsApp cuando el usuario pide análisis explícito.
   */
  async getSynthesisText(userId: string, days = 7): Promise<string> {
    const result = await this.analyze({ userId, windowDays: days });
    return result.summary;
  },
};

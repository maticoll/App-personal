// ============================================================
// Agente de Sueño — agents/sleep/index.ts
// Sesión 3 — Implementación completa
//
// Responsabilidades:
//   - Procesar mensajes de WhatsApp relacionados al sueño
//   - Interpretar intenciones: dormir, despertar, consulta, sync, flexible
//   - Registrar en DB y calcular score
//   - Generar respuestas en lenguaje natural
//
// Flujo de trabajo:
//   Input (AgentInput) → detectar intención → acción → Output (AgentOutput)
//
// Ejemplos de mensajes procesados:
//   "me voy a dormir"           → logBedTime(ahora)
//   "me dormí a las 11"         → logBedTime(23:00)
//   "me desperté"               → logWakeTime(ahora)
//   "me desperté a las 7"       → logWakeTime(07:00)
//   "hoy salgo, te aviso"       → logBedTime(flexible=true)
//   "sync" / "sincronizar"      → syncGarmin(7 días)
//   "cuánto dormí ayer?"        → querySleep(ayer)
// ============================================================

import type { AgentInput, AgentOutput } from "@/lib/types";
import {
  logBedTime,
  logWakeTime,
  getTodaySleep,
  getPendingSleepLog,
  getWeeklyStats,
  upsertSleepLog,
} from "@/lib/sleep";
import {
  syncGarminSleepRange,
  checkGarminStatus,
} from "@/lib/garmin";
import { formatDuration, formatTime } from "@/lib/utils";
import { detectIntentAI, detectPeriod } from "@/lib/nlp";

// --- Agente principal ---

export const sleepAgent = {
  name: "sleep",
  description:
    "Registra y analiza datos de sueño. Maneja: dormirse, despertarse, consultas y sync Garmin.",

  /**
   * Callback invocado cuando el usuario actualiza sus objetivos en Settings.
   * Recalcula el scoring umbral y retorna ok si todo está bien.
   */
  async onGoalsUpdate(userId: string, goals: import("@prisma/client").UserGoals): Promise<{ ok: boolean }> {
    // El agente de sueño no necesita procesamiento especial al actualizar objetivos.
    // Los nuevos umbrales se aplican automáticamente en el próximo cálculo de score
    // porque calcSleepScore lee los goals frescos de DB.
    // Si en el futuro el agente cachea algo, recalcularlo acá.
    return { ok: true };
  },

  /**
   * Punto de entrada principal — llamado por el orquestrador.
   * Detecta la intención y ejecuta la acción correspondiente.
   */
  async process(input: AgentInput): Promise<AgentOutput> {
    const intentKey = await detectIntentAI(
      "Eres el agente de registro de sueno de una app personal.",
      {
        bed: "El usuario indica que se va a dormir, que se durmio, o que es hora de dormir (puede incluir una hora)",
        wake: "El usuario indica que se desperto o se levanto (puede incluir una hora)",
        query: "El usuario pregunta por cuanto durmio, su calidad de sueno, estadisticas o historial",
        sync: "El usuario quiere sincronizar datos con Garmin",
        flexible: "El usuario avisa que hoy sale tarde, no hay hora fija, o que ya te avisa despues",
        unknown: "Otro mensaje no relacionado al sueno",
      },
      input.message
    );

    if (intentKey === "bed" || intentKey === "flexible") {
      const time = extractTime(input.message);
      return this.handleBedTime(input.userId, time, intentKey === "flexible");
    }
    if (intentKey === "wake") {
      const time = extractTime(input.message);
      return this.handleWakeTime(input.userId, time);
    }
    if (intentKey === "query") {
      const period = detectPeriod(input.message);
      return this.handleQuery(input.userId, period);
    }
    if (intentKey === "sync") {
      return this.handleSync(input.userId);
    }
    return {
      success: false,
      message: "No entendi tu mensaje sobre el sueno. Podes decirme: me voy a dormir, me desperte, cuanto dormi, o sync.",
    };
  },

  // --- Handlers ---

  async handleBedTime(
    userId: string,
    time?: Date,
    flexible = false
  ): Promise<AgentOutput> {
    try {
      const bedTime = time ?? new Date();

      if (flexible) {
        // Flujo flexible: el usuario no tiene hora fija hoy
        const log = await logBedTime(userId, bedTime, { flexible: true });
        return {
          success: true,
          message:
            "✅ Entendido, hoy no hay hora fija. Te aviso cuando me digas que te despertaste para registrar el sueño 🌙",
          data: { log },
        };
      }

      const log = await logBedTime(userId, bedTime);
      const timeStr = formatTime(bedTime);

      return {
        success: true,
        message:
          `🌙 Anotado! Te fuiste a dormir a las *${timeStr}*.\n` +
          `Cuando te despiertes, mandame "me desperté" para registrar el sueño completo. Que descanses! 😴`,
        data: { log },
      };
    } catch (err) {
      return {
        success: false,
        message: "No pude registrar tu hora de dormir. Intentá de nuevo.",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },

  async handleWakeTime(userId: string, time?: Date): Promise<AgentOutput> {
    try {
      const wakeTime = time ?? new Date();
      const log = await logWakeTime(userId, wakeTime);

      const duration = log.durationMinutes;
      const timeStr = formatTime(wakeTime);

      let message = `☀️ Buenos días! Me anotaste que te despertaste a las *${timeStr}*.\n`;

      if (duration) {
        const h = duration / 60;
        message += `Dormiste *${formatDuration(duration)}*`;

        if (h >= 7 && h <= 9) {
          message += " — excelente, en el rango ideal! 🔥";
        } else if (h >= 6 && h <= 10) {
          message += " — aceptable, pero intentá apuntar a 7–9h.";
        } else if (h < 6) {
          message += " — poco, tratá de descansar más esta noche 😴";
        } else {
          message += " — bastante, tu cuerpo lo necesitaba.";
        }
      }

      return {
        success: true,
        message,
        data: { log },
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      // Si no hay registro previo de dormir, sugerir registrarlo
      if (errorMsg.includes("No hay registro")) {
        return {
          success: false,
          message:
            "⚠️ No encontré registro de cuándo te fuiste a dormir anoche. " +
            'Podés registrarlo manualmente en la app con la hora real.',
        };
      }
      return {
        success: false,
        message: "No pude registrar tu hora de despertar.",
        error: errorMsg,
      };
    }
  },

  async handleQuery(
    userId: string,
    period: "today" | "yesterday" | "week"
  ): Promise<AgentOutput> {
    try {
      if (period === "week") {
        const stats = await getWeeklyStats(userId);
        let message = "📊 *Tu sueño esta semana:*\n\n";

        if (stats.avgDurationMinutes) {
          message += `• Promedio: *${formatDuration(stats.avgDurationMinutes)}*\n`;
        }
        message += `• Días en rango ideal (7–9h): *${stats.daysInIdealRange}/7*\n`;
        if (stats.avgGarminScore) {
          message += `• Calidad Garmin promedio: *${stats.avgGarminScore}/100*\n`;
        }
        if (stats.streak > 1) {
          message += `• Racha de registro: *${stats.streak} días* 🔥\n`;
        }

        return { success: true, message, data: { stats } };
      }

      const log =
        period === "today" ? await getTodaySleep(userId) : await getSleepYesterday(userId);

      if (!log) {
        return {
          success: true,
          message:
            period === "today"
              ? "No tengo registro de tu sueño de esta noche todavía."
              : "No tengo registro de tu sueño de anoche. ¿Querés registrarlo ahora?",
        };
      }

      let message =
        period === "today" ? "🌙 *Tu sueño de anoche:*\n" : "📋 *Tu sueño de antes de ayer:*\n";

      if (log.durationMinutes) {
        message += `• Duración: *${formatDuration(log.durationMinutes)}*\n`;
      }
      message += `• Dormiste a las: *${formatTime(log.bedTime)}*\n`;
      if (log.wakeTime) {
        message += `• Te despertaste a las: *${formatTime(log.wakeTime)}*\n`;
      }
      if (log.garminScore !== null) {
        message += `• Calidad Garmin: *${log.garminScore}/100*\n`;
      }

      return { success: true, message, data: { log } };
    } catch (err) {
      return {
        success: false,
        message: "No pude consultar los datos de sueño.",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },

  async handleSync(userId: string): Promise<AgentOutput> {
    const status = await checkGarminStatus(userId);

    if (!status.connected) {
      return {
        success: false,
        message:
          "⚠️ Garmin no está configurado. Para conectarlo, " +
          "agregá GARMIN_EMAIL y GARMIN_PASSWORD en las variables de entorno de la app.",
      };
    }

    try {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 7);

      const result = await syncGarminSleepRange(userId, from, to);

      if (result.synced === 0) {
        return {
          success: true,
          message: "✅ Sync con Garmin completado. Ya tenés todos los datos al día.",
          data: result,
        };
      }

      return {
        success: true,
        message:
          `✅ Sync con Garmin completado!\n` +
          `• ${result.synced} noche${result.synced > 1 ? "s" : ""} importada${result.synced > 1 ? "s" : ""}\n` +
          (result.errors > 0 ? `• ${result.errors} error${result.errors > 1 ? "es" : ""}\n` : ""),
        data: result,
      };
    } catch (err) {
      return {
        success: false,
        message:
          "❌ Error al sincronizar con Garmin. Verificá que las credenciales son correctas.",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },

  /**
   * Sync directo (llamado por el cron job o el orchestrator).
   */
  async syncGarmin(userId: string): Promise<void> {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 2);
    await syncGarminSleepRange(userId, from, to);
  },

  /**
   * Calcular score de sueño del día (usado por el agente de scoring).
   * Retorna 0–100, o null si no hay datos.
   */
  async calculateScore(userId: string, date: Date): Promise<number | null> {
    const { calcSleepScoreForDate } = await import("@/lib/scoring");
    const result = await calcSleepScoreForDate(userId, date);
    return result.score;
  },

  /**
   * Texto para el morning summary (Sesión 8).
   */
  async getSleepSummaryText(userId: string): Promise<string> {
    const log = await getTodaySleep(userId);
    if (!log) return "Sin datos de sueño registrados.";

    const parts: string[] = [];
    if (log.durationMinutes) {
      parts.push(`Dormiste ${formatDuration(log.durationMinutes)}`);
    }
    if (log.garminScore !== null) {
      parts.push(`calidad Garmin: ${log.garminScore}/100`);
    }
    if (log.bedTime && log.wakeTime) {
      parts.push(
        `(${formatTime(log.bedTime)} → ${formatTime(log.wakeTime)})`
      );
    }

    return parts.join(", ");
  },

  /**
   * Texto de notificación de bedtime para el orquestrador.
   */
  async getBedTimeReminderText(userId: string): Promise<string | null> {
    const { db } = await import("@/lib/db");
    const settings = await db.userSettings.findUnique({ where: { userId } });
    if (!settings?.expectedSleepTime) return null;

    // Verificar que no se haya dormido ya
    const hasPending = await getPendingSleepLog(userId);
    const hasTodaySleep = await getTodaySleep(userId);
    if (hasPending || hasTodaySleep) return null;

    return `🌙 Son las ${settings.expectedSleepTime}, hora de dormir! No te olvides de registrarlo cuando vayas a la cama.`;
  },
};

/**
 * Extraer hora de un mensaje de texto.
 * Soporta: "a las 11", "a las 23:30", "a las 7 y media", etc.
 */
function extractTime(msg: string): Date | undefined {
  // Patrón: "a las HH:MM" o "a las H"
  const patterns = [
    /a las (\d{1,2}):(\d{2})/,
    /a las (\d{1,2}) y media/,
    /a las (\d{1,2})/,
    /(\d{1,2}):(\d{2})\s*(am|pm|hs|h)?/i,
  ];

  for (const pattern of patterns) {
    const match = msg.match(pattern);
    if (match) {
      const hours = parseInt(match[1]);
      const minutes = match[2]
        ? match[0].includes("y media")
          ? 30
          : parseInt(match[2])
        : 0;

      const now = new Date();
      const result = new Date(now);
      result.setHours(hours, minutes, 0, 0);

      // Si la hora es del pasado (por mucho), asumimos que es de hoy
      return result;
    }
  }

  return undefined;
}

// --- Helper para consultar el sueño de ayer ---
async function getSleepYesterday(userId: string) {
  const { db } = await import("@/lib/db");
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const log = await db.sleepLog.findUnique({
    where: { userId_date: { userId, date: yesterday } },
  });

  if (!log) return null;

  return {
    id: log.id,
    date: log.date,
    bedTime: log.bedTime,
    wakeTime: log.wakeTime,
    durationMinutes: log.durationMinutes,
    garminScore: log.garminScore,
    deepSleepMinutes: log.deepSleepMinutes,
    lightSleepMinutes: log.lightSleepMinutes,
    remSleepMinutes: log.remSleepMinutes,
    awakeMinutes: log.awakeMinutes,
    stressScore: log.stressScore,
    spo2Avg: log.spo2Avg,
    respirationAvg: log.respirationAvg,
    bodyBatteryChange: log.bodyBatteryChange,
    notes: log.notes,
    flexible: log.flexible,
  };
}

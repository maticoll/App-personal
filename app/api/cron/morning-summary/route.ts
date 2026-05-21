// ============================================================
// GET /api/cron/morning-summary
// Cron diario — envia el resumen matutino por WhatsApp
// Schedule: 30 10 * * * (= 7:30 AM Uruguay, UTC-3)
// Proteccion: Authorization: Bearer $CRON_SECRET
//
// Contenido del mensaje:
//   1. Saludo con nombre
//   2. Versiculo biblico del dia (bible-api.com, rv1960)
//   3. Score de ayer por modulo + global
//   4. Resumen de sueno de anoche
//   5. Hidratacion de ayer
//   6. Cierre motivacional (Claude Haiku)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron";
import { sendTextMessage, sendTemplateMessage } from "@/lib/whatsapp";
import { db } from "@/lib/db";
import { scoringAgent } from "@/agents/scoring";
import { sleepAgent } from "@/agents/sleep";
import { synthesisAgent } from "@/agents/synthesis";
import { getNutritionSummaryText } from "@/lib/nutrition";
import { getTodayEventsText } from "@/lib/calendar";
import { logger } from "@/lib/logger";

// -------------------------------------------------------
// Tipos para la Bible API
// -------------------------------------------------------

type BibleApiResponse = {
  reference: string;
  text: string;
  translation_id?: string;
};

// -------------------------------------------------------
// fetchVerse
// Obtiene un versiculo aleatorio de bible-api.com (rv1960)
// Devuelve null si falla para omitir la seccion silenciosamente
// -------------------------------------------------------

async function fetchVerse(): Promise<{ reference: string; text: string } | null> {
  try {
    const res = await fetch(
      "https://bible-api.com/?random=verse&translation=rv1960",
      { next: { revalidate: 0 } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as BibleApiResponse;
    const text = data.text?.trim().replace(/\n/g, " ") ?? "";
    const reference = data.reference ?? "";
    if (!text || !reference) return null;
    return { reference, text };
  } catch {
    return null;
  }
}

// -------------------------------------------------------
// generateMotivation
// Genera una linea motivacional corta con Claude Haiku
// Si falla, usa un fallback estatico
// -------------------------------------------------------

async function generateMotivation(globalScore: number | null): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return "Que tengas un gran dia hoy!";

  const scoreContext =
    globalScore !== null
      ? "El score de ayer fue " + globalScore + "/100."
      : "No hay score registrado ayer.";

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 60,
        messages: [
          {
            role: "user",
            content:
              "Genera UNA sola linea motivacional en espanol, amigable y directa, para el inicio del dia. " +
              scoreContext +
              " Sin asteriscos, sin markdown, sin comillas. Maximo 15 palabras.",
          },
        ],
      }),
    });

    if (!res.ok) return "Que tengas un gran dia hoy!";
    const data = (await res.json()) as {
      content: Array<{ type: string; text: string }>;
    };
    const line = data.content?.[0]?.text?.trim() ?? "";
    return line || "Que tengas un gran dia hoy!";
  } catch {
    return "Que tengas un gran dia hoy!";
  }
}

// -------------------------------------------------------
// buildMessage
// Ensambla el mensaje final a partir de todas las secciones
// Omite silenciosamente secciones sin datos
// Maximo ~20 lineas
// -------------------------------------------------------

type MessageParts = {
  userName: string;
  verse: { reference: string; text: string } | null;
  scoreText: string | null;
  globalScore: number | null;
  sleepText: string | null;
  nutritionText: string | null;
  agendaText: string | null;
  insightText: string | null;
  motivation: string;
};

function buildMessage(parts: MessageParts): string {
  const lines: string[] = [];

  // 1. Saludo con nombre dinámico
  lines.push(`Buenos dias ${parts.userName}! ☀️`);
  lines.push("");

  // 2. Versiculo biblico
  if (parts.verse) {
    lines.push("📖 " + parts.verse.reference);
    lines.push('"' + parts.verse.text + '"');
    lines.push("");
  }

  // 3. Score de ayer
  if (parts.scoreText) {
    // Limpiar asteriscos de markdown del scoringAgent (** no valido en WA)
    const cleanScore = parts.scoreText.replace(/\*\*/g, "").replace(/\*/g, "");
    lines.push(cleanScore);
    lines.push("");
  }

  // 4. Sueno de anoche (omitir si no hay datos)
  if (parts.sleepText && !parts.sleepText.toLowerCase().startsWith("sin datos")) {
    lines.push("🌙 Sueno: " + parts.sleepText);
  }

  // 5. Nutricion / hidratacion de ayer (omitir si todo está en cero)
  if (parts.nutritionText && !parts.nutritionText.includes("Sin comidas registradas")) {
    lines.push(parts.nutritionText);
  }

  // 6. Agenda de hoy
  if (parts.agendaText) {
    lines.push("");
    lines.push(parts.agendaText);
  }

  // 7. Insight de síntesis (patrones cross-módulo)
  if (parts.insightText) {
    lines.push("");
    lines.push("🔍 " + parts.insightText);
  }

  // Separador antes del cierre si hay contenido antes
  if (parts.sleepText || parts.nutritionText || parts.agendaText || parts.insightText) {
    lines.push("");
  }

  // 8. Cierre motivacional
  lines.push("💬 " + parts.motivation);

  return lines.join("\n");
}

// -------------------------------------------------------
// GET handler
// -------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!verifyCronSecret(req)) {
    logger.warn("cron/morning-summary", { event: "unauthorized" });
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const start = Date.now();
  logger.info("cron/morning-summary", { event: "start" });

  try {
    // --- 1. Buscar todos los usuarios con WhatsApp configurado y notificaciones activas ---
    const activeSettings = await db.userSettings.findMany({
      where: {
        whatsappNumber: { not: null },
        notificationsEnabled: true,
      },
      select: { userId: true, whatsappNumber: true },
    });

    if (activeSettings.length === 0) {
      logger.info("cron/morning-summary", { event: "no_recipients" });
      return NextResponse.json({ ok: true, message: "No hay usuarios con WhatsApp activo" });
    }

    // --- 2. Fecha de ayer (calculada una sola vez) ---
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const dateLabel = yesterday.toLocaleDateString("es-UY", {
      day: "numeric",
      month: "long",
      timeZone: "America/Montevideo",
    });

    // --- 3. Enviar a cada usuario ---
    const results: Array<{ userId: string; to: string; ok: boolean; error?: string }> = [];

    for (const s of activeSettings) {
      const toNumber = s.whatsappNumber!;
      try {
        // Cargar nombre del usuario
        const userRecord = await db.user.findUnique({
          where: { id: s.userId },
          select: { name: true },
        });
        // Usar solo el primer nombre, fallback a "vos"
        const userName = userRecord?.name?.split(" ")[0] ?? "vos";

        // Recopilar secciones en paralelo para este usuario
        const [verse, scoreText, sleepText, nutritionText, agendaText, insightText] =
          await Promise.allSettled([
            fetchVerse(),
            scoringAgent.getSummaryText(s.userId, yesterday),
            sleepAgent.getSleepSummaryText(s.userId),
            getNutritionSummaryText(s.userId, yesterday),
            getTodayEventsText(s.userId),
            synthesisAgent.getDailyInsight(s.userId),
          ]);

        const verseValue     = verse.status       === "fulfilled" ? verse.value       : null;
        const scoreValue     = scoreText.status   === "fulfilled" ? scoreText.value   : null;
        const sleepValue     = sleepText.status   === "fulfilled" ? sleepText.value   : null;
        const nutritionValue = nutritionText.status === "fulfilled" ? nutritionText.value : null;
        const agendaValue    = agendaText.status  === "fulfilled" ? agendaText.value  : null;
        const insightValue   = insightText.status === "fulfilled" ? insightText.value : null;

        let globalScore: number | null = null;
        if (scoreValue) {
          const match = scoreValue.match(/(\d+)\/100/);
          if (match) globalScore = parseInt(match[1], 10);
        }

        const motivation = await generateMotivation(globalScore);

        const message = buildMessage({
          userName,
          verse: verseValue,
          scoreText: scoreValue,
          globalScore,
          sleepText: sleepValue,
          nutritionText: nutritionValue,
          agendaText: agendaValue,
          insightText: insightValue,
          motivation,
        });

        // Template para abrir ventana 24hs + mensaje completo
        await sendTemplateMessage(toNumber, "servicios", [
          { type: "text", text: dateLabel },
        ]);
        await sendTextMessage(toNumber, message);

        logger.info("cron/morning-summary", {
          event: "sent",
          to: toNumber,
          userId: s.userId,
          userName,
          globalScore,
          lines: message.split("\n").length,
        });

        results.push({ userId: s.userId, to: toNumber, ok: true });
      } catch (userError) {
        logger.error("cron/morning-summary", {
          event: "user_error",
          userId: s.userId,
          to: toNumber,
          error: String(userError),
        });
        results.push({ userId: s.userId, to: toNumber, ok: false, error: String(userError) });
      }
    }

    const sent = results.filter((r) => r.ok).length;
    logger.info("cron/morning-summary", {
      event: "done",
      sent,
      total: results.length,
      durationMs: Date.now() - start,
    });

    return NextResponse.json({
      ok: true,
      message: `Morning summary enviado a ${sent}/${results.length} usuarios`,
      results,
    });
  } catch (error) {
    logger.error("cron/morning-summary", { event: "error", error: String(error), durationMs: Date.now() - start });
    return NextResponse.json(
      { ok: false, error: "Error enviando morning summary" },
      { status: 500 }
    );
  }
}

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

  // 1. Saludo
  lines.push("Buenos dias Corea! ☀️");
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

  // 4. Sueno de anoche
  if (parts.sleepText && parts.sleepText !== "Sin datos de sueno registrados.") {
    lines.push("🌙 Sueno: " + parts.sleepText);
  }

  // 5. Nutricion / hidratacion de ayer
  if (parts.nutritionText) {
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
    // --- 1. Resolver usuario destinatario ---
    const allowedEmail = process.env.ALLOWED_EMAIL;
    if (!allowedEmail) {
      return NextResponse.json(
        { ok: false, error: "ALLOWED_EMAIL no configurado" },
        { status: 500 }
      );
    }

    const user = await db.user.findFirst({
      where: { email: allowedEmail },
      select: { id: true, name: true },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Usuario no encontrado para " + allowedEmail },
        { status: 404 }
      );
    }

    const settings = await db.userSettings.findUnique({
      where: { userId: user.id },
      select: { whatsappNumber: true },
    });

    const toNumber = settings?.whatsappNumber ?? null;
    if (!toNumber) {
      console.warn("[morning-summary] No hay whatsappNumber para userId=" + user.id);
      return NextResponse.json(
        { ok: false, error: "whatsappNumber no configurado para el usuario" },
        { status: 404 }
      );
    }

    // --- 2. Calcular fecha de ayer ---
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    // --- 3. Recopilar todas las secciones en paralelo ---
    const [verse, scoreText, sleepText, nutritionText, agendaText, insightText] =
      await Promise.allSettled([
        fetchVerse(),
        scoringAgent.getSummaryText(user.id, yesterday),
        sleepAgent.getSleepSummaryText(user.id),
        getNutritionSummaryText(user.id, yesterday),
        getTodayEventsText(user.id),
        synthesisAgent.getDailyInsight(user.id),
      ]);

    // Extraer valores con fallback null en caso de rechazo
    const verseValue =
      verse.status === "fulfilled" ? verse.value : null;
    const scoreValue =
      scoreText.status === "fulfilled" ? scoreText.value : null;
    const sleepValue =
      sleepText.status === "fulfilled" ? sleepText.value : null;
    const nutritionValue =
      nutritionText.status === "fulfilled" ? nutritionText.value : null;
    const agendaValue =
      agendaText.status === "fulfilled" ? agendaText.value : null;
    const insightValue =
      insightText.status === "fulfilled" ? insightText.value : null;

    // Extraer score global del texto para pasar a la motivacion
    let globalScore: number | null = null;
    if (scoreValue) {
      const match = scoreValue.match(/(\d+)\/100/);
      if (match) globalScore = parseInt(match[1], 10);
    }

    // --- 4. Generar motivacion con Claude Haiku ---
    const motivation = await generateMotivation(globalScore);

    // --- 5. Ensamblar mensaje ---
    const message = buildMessage({
      verse: verseValue,
      scoreText: scoreValue,
      globalScore,
      sleepText: sleepValue,
      nutritionText: nutritionValue,
      agendaText: agendaValue,
      insightText: insightValue,
      motivation,
    });

    // --- 6. Enviar por WhatsApp ---
    // Primero: template aprobado para abrir ventana de 24hs ({{1}} = fecha de ayer)
    const dateLabel = yesterday.toLocaleDateString("es-UY", {
      day: "numeric",
      month: "long",
      timeZone: "America/Montevideo",
    });
    await sendTemplateMessage(toNumber, "morning_summary", [
      { type: "text", text: dateLabel },
    ]);
    // Segundo: mensaje completo como texto libre (gratis dentro de la ventana abierta)
    await sendTextMessage(toNumber, message);

    logger.info("cron/morning-summary", {
      event: "sent",
      to: toNumber,
      userId: user.id,
      globalScore,
      hasSleep: !!sleepValue,
      hasNutrition: !!nutritionValue,
      hasAgenda: !!agendaValue,
      hasInsight: !!insightValue,
      lines: message.split("\n").length,
      durationMs: Date.now() - start,
    });

    return NextResponse.json({
      ok: true,
      message: "Morning summary enviado",
      to: toNumber,
      lines: message.split("\n").length,
    });
  } catch (error) {
    logger.error("cron/morning-summary", { event: "error", error: String(error), durationMs: Date.now() - start });
    return NextResponse.json(
      { ok: false, error: "Error enviando morning summary" },
      { status: 500 }
    );
  }
}

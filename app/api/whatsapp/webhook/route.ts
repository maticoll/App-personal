// /api/whatsapp/webhook
//
// GET  - Verificacion del webhook por Meta (challenge handshake)
// POST - Recepcion de mensajes entrantes de WhatsApp

import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import {
  parseIncomingWebhook,
  sendTextMessage,
  sendTypingIndicator,
  downloadAudio,
  transcribeAudio,
  verifyWebhookSignature,
} from "@/lib/whatsapp";
import { orchestrate } from "@/lib/orchestrator";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

// ----------------------------------------------------------------
// GET - Verificacion del webhook (Meta challenge)
// ----------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken && challenge) {
    logger.info("whatsapp/webhook", { event: "verification_ok" });
    return new NextResponse(challenge, { status: 200 });
  }

  logger.warn("whatsapp/webhook", {
    event: "verification_failed",
    mode,
    token,
  });
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// ----------------------------------------------------------------
// POST - Recibir mensajes entrantes
// Meta requiere respuesta 200 en menos de 5 segundos.
// Procesamiento real se hace con after() (Next.js background task).
// ----------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Leer el cuerpo como texto crudo para poder validar la firma HMAC
  // (req.json() re-serializa y el hash dejaría de coincidir).
  const rawBody = await req.text();

  const signature = req.headers.get("x-hub-signature-256");
  if (!verifyWebhookSignature(rawBody, signature)) {
    logger.warn("whatsapp/webhook", { event: "invalid_signature" });
    // Devolvemos 200 igualmente para no filtrar a un atacante si la firma es
    // válida o no, pero NO procesamos el mensaje.
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  let body: unknown = null;
  try {
    body = JSON.parse(rawBody);
  } catch {
    body = null;
  }

  after(() => processIncomingMessage(body));
  return NextResponse.json({ ok: true }, { status: 200 });
}

// ----------------------------------------------------------------
// processIncomingMessage
// Pipeline completo: parse -> lookup user -> guardar INBOUND ->
//   transcribir audio si aplica -> orchestrate -> responder -> PROCESSED
// ----------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processIncomingMessage(body: any): Promise<void> {
  // Fuera del try para poder avisar al usuario y marcar FAILED en el catch
  let from: string | null = null;
  let inboundMsgId: string | null = null;

  try {
    // 1. Parsear payload de Meta
    const parsed = parseIncomingWebhook(body);
    if (!parsed) return;

    const { messageId, type, text, audioId, timestamp, forwarded } = parsed;
    from = parsed.from;
    logger.info("whatsapp/webhook", {
      event: "message_received",
      type,
      timestamp,
      forwarded,
    });

    // 2. Marcar como leido + mostrar "escribiendo…" (best-effort).
    //    El indicador se borra solo al enviar la respuesta o tras 25s.
    void sendTypingIndicator(messageId);

    // 2b. Audio reenviado: transcribir y devolver texto directamente
    if (forwarded && type === "audio" && audioId) {
      try {
        logger.info("whatsapp/webhook", {
          event: "forwarded_audio_transcription_start",
          audioId,
        });
        const audioBuffer = await downloadAudio(audioId);
        const transcription = await transcribeAudio(audioBuffer);
        logger.info("whatsapp/webhook", {
          event: "forwarded_audio_transcription_ok",
        });
        await sendTextMessage(
          from,
          transcription || "No pude transcribir el audio.",
        );
      } catch (err) {
        logger.error("whatsapp/webhook", {
          event: "forwarded_audio_transcription_error",
          error: String(err),
        });
        await sendTextMessage(
          from,
          "No pude transcribir el audio reenviado. Intenta de nuevo.",
        );
      }
      return;
    }

    // 3. Resolver userId — buscar por numero en UserSettings
    //    Buscamos con y sin "+" para que no importe como lo guardo el usuario.
    let userId: string | null = null;

    const fromNormalized = from.replace(/^\+/, "");
    const fromWithPlus = "+" + fromNormalized;

    const settings = await db.userSettings.findFirst({
      where: { whatsappNumber: { in: [fromNormalized, fromWithPlus] } },
      select: { userId: true },
    });

    if (settings) {
      userId = settings.userId;
    }

    if (!userId) {
      logger.warn("whatsapp/webhook", { event: "user_not_found", from });
      await sendTextMessage(
        from,
        "Lo siento, tu numero no esta vinculado a ninguna cuenta.",
      );
      return;
    }

    // 4. Transcribir audio si aplica
    let messageText: string | undefined = text;
    const isAudio = type === "audio";

    if (isAudio && audioId) {
      try {
        logger.info("whatsapp/webhook", {
          event: "audio_transcription_start",
          audioId,
        });
        const audioBuffer = await downloadAudio(audioId);
        messageText = await transcribeAudio(audioBuffer);
        logger.info("whatsapp/webhook", {
          event: "audio_transcription_ok",
          userMessage: messageText,
        });
      } catch (err) {
        logger.error("whatsapp/webhook", {
          event: "audio_transcription_error",
          error: String(err),
        });
        await sendTextMessage(
          from,
          "No pude procesar el audio. Podes escribirlo?",
        );
        return;
      }
    }

    if (!messageText) {
      await sendTextMessage(
        from,
        "Recibi tu mensaje pero no pude leerlo. Podes enviarlo como texto?",
      );
      return;
    }

    // 5. Guardar mensaje INBOUND en DB
    let waMsg = await db.whatsAppMessage.create({
      data: {
        userId,
        direction: "INBOUND",
        content: messageText,
        status: "PENDING",
        waMessageId: messageId,
      },
    });
    inboundMsgId = waMsg.id;

    // 6. Orquestar: detectar modulo y derivar al agente
    const orchestrateStart = Date.now();
    const response = await orchestrate(userId, messageText);
    logger.info("whatsapp/webhook", {
      event: "conversation",
      userMessage: messageText,
      agentResponse: response,
      durationMs: Date.now() - orchestrateStart,
    });

    // 7. Enviar respuesta al usuario
    await sendTextMessage(from, response);

    // 8. Guardar mensaje OUTBOUND
    await db.whatsAppMessage.create({
      data: {
        userId,
        direction: "OUTBOUND",
        content: response,
        status: "PROCESSED",
        processedAt: new Date(),
      },
    });

    // 9. Actualizar mensaje INBOUND como PROCESSED
    waMsg = await db.whatsAppMessage.update({
      where: { id: waMsg.id },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
      },
    });

    logger.info("whatsapp/webhook", {
      event: "message_processed_ok",
      msgId: waMsg.id,
    });
  } catch (err) {
    logger.error("whatsapp/webhook", {
      event: "message_processing_error",
      error: String(err),
    });

    // Avisar al usuario (best-effort) — si no, queda mirando "escribiendo…"
    if (from) {
      try {
        await sendTextMessage(
          from,
          "Uy, algo se rompió procesando eso. Probá de nuevo.",
        );
      } catch (sendErr) {
        logger.error("whatsapp/webhook", {
          event: "error_notice_failed",
          error: String(sendErr),
        });
      }
    }

    // Marcar el INBOUND como FAILED para que no quede PENDING para siempre
    if (inboundMsgId) {
      await db.whatsAppMessage
        .update({
          where: { id: inboundMsgId },
          data: { status: "FAILED", processedAt: new Date() },
        })
        .catch(() => {});
    }
  }
}

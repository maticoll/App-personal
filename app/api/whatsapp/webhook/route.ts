// ============================================================
// /api/whatsapp/webhook
//
// GET  — Verificación del webhook por Meta (challenge handshake)
// POST — Recepción de mensajes entrantes de WhatsApp
//
// Documentación Meta:
//   https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import {
  parseIncomingWebhook,
  sendTextMessage,
  markAsRead,
  downloadAudio,
  transcribeAudio,
} from "@/lib/whatsapp";

// ----------------------------------------------------------------
// GET — Verificación del webhook (Meta challenge)
// Meta hace un GET con hub.verify_token y hub.challenge.
// Si el token coincide hay que devolver hub.challenge con status 200.
// ----------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken && challenge) {
    console.log("[whatsapp/webhook] Verificación de webhook exitosa");
    // Meta espera el challenge como texto plano con status 200
    return new NextResponse(challenge, { status: 200 });
  }

  console.warn("[whatsapp/webhook] Verificación fallida", { mode, token });
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// ----------------------------------------------------------------
// POST — Recibir mensajes entrantes
// Meta requiere una respuesta 200 en menos de 5 segundos.
// El procesamiento pesado (Whisper, IA) se hace en background.
// ----------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Responder 200 de inmediato — Meta penaliza si tardamos > 5s
  const body = await req.json().catch(() => null);

  // Procesar en background sin bloquear la respuesta
  void processIncomingMessage(body);

  return NextResponse.json({ ok: true }, { status: 200 });
}

// ----------------------------------------------------------------
// processIncomingMessage
// Lógica de procesamiento separada para no bloquear la respuesta.
// ----------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processIncomingMessage(body: any): Promise<void> {
  try {
    // 2. Parsear el payload de Meta
    const parsed = parseIncomingWebhook(body);

    if (!parsed) {
      // No es un mensaje de usuario (puede ser un status update, etc.)
      return;
    }

    const { from, messageId, type, text, audioId } = parsed;

    console.log("[whatsapp/webhook] Mensaje entrante:", {
      from,
      messageId,
      type,
      timestamp: parsed.timestamp,
    });

    // 3. Marcar como leído (best-effort, no bloquea)
    void markAsRead(messageId);

    let messageText: string | undefined = text;

    // 4. Si es audio → descargar y transcribir con Whisper
    if (type === "audio" && audioId) {
      try {
        console.log("[whatsapp/webhook] Transcribiendo audio:", audioId);
        const audioBuffer = await downloadAudio(audioId);
        messageText = await transcribeAudio(audioBuffer);
        console.log("[whatsapp/webhook] Transcripción:", messageText);
      } catch (err) {
        console.error("[whatsapp/webhook] Error transcribiendo audio:", err);
        await sendTextMessage(
          from,
          "No pude procesar el audio. ¿Podés escribirlo?"
        );
        return;
      }
    }

    // 5. Loguear mensaje final (texto original o transcripción)
    console.log("[whatsapp/webhook] Procesando:", { from, text: messageText });

    // 6. Por ahora: acusar recibo con el texto recibido
    //    TODO: Sesión 8 Parte 2 — pasar al orquestrador para procesamiento real
    if (messageText) {
      await sendTextMessage(from, `Hola, recibí tu mensaje: ${messageText}`);
    } else {
      await sendTextMessage(
        from,
        "Recibí tu mensaje pero no pude leerlo. ¿Podés enviarlo como texto?"
      );
    }
  } catch (err) {
    console.error("[whatsapp/webhook] Error general procesando mensaje:", err);
    // No lanzar — la respuesta 200 ya fue enviada
  }
}

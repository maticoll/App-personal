// /api/whatsapp/webhook
//
// GET  - Verificacion del webhook por Meta (challenge handshake)
// POST - Recepcion de mensajes entrantes de WhatsApp

import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import {
  parseIncomingWebhook,
  sendTextMessage,
  markAsRead,
  downloadAudio,
  transcribeAudio,
} from "@/lib/whatsapp";
import { orchestrate } from "@/lib/orchestrator";
import { db } from "@/lib/db";

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
    console.log("[whatsapp/webhook] Verificacion de webhook exitosa");
    return new NextResponse(challenge, { status: 200 });
  }

  console.warn("[whatsapp/webhook] Verificacion fallida", { mode, token });
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// ----------------------------------------------------------------
// POST - Recibir mensajes entrantes
// Meta requiere respuesta 200 en menos de 5 segundos.
// Procesamiento real se hace con after() (Next.js background task).
// ----------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json().catch(() => null);
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
  try {
    // 1. Parsear payload de Meta
    const parsed = parseIncomingWebhook(body);
    if (!parsed) return; // status update u otro evento no relevante

    const { from, messageId, type, text, audioId, timestamp } = parsed;
    console.log("[whatsapp/webhook] Mensaje entrante:", { from, messageId, type, timestamp });

    // 2. Marcar como leido (best-effort)
    void markAsRead(messageId);

    // 3. Resolver userId
    //    Primero buscar por numero de WhatsApp en UserSettings
    //    Fallback: primer usuario con el email permitido
    let userId: string | null = null;

    const settings = await db.userSettings.findFirst({
      where: { whatsappNumber: from },
      select: { userId: true },
    });

    if (settings) {
      userId = settings.userId;
    } else {
      const allowedEmail = process.env.ALLOWED_EMAIL;
      if (allowedEmail) {
        const user = await db.user.findFirst({
          where: { email: allowedEmail },
          select: { id: true },
        });
        if (user) userId = user.id;
      }
    }

    if (!userId) {
      console.warn("[whatsapp/webhook] No se encontro userId para from=" + from);
      await sendTextMessage(from, "Lo siento, tu numero no esta vinculado a ninguna cuenta.");
      return;
    }

    // 4. Transcribir audio si aplica
    let messageText: string | undefined = text;
    const isAudio = type === "audio";

    if (isAudio && audioId) {
      try {
        console.log("[whatsapp/webhook] Transcribiendo audio:", audioId);
        const audioBuffer = await downloadAudio(audioId);
        messageText = await transcribeAudio(audioBuffer);
        console.log("[whatsapp/webhook] Transcripcion:", messageText);
      } catch (err) {
        console.error("[whatsapp/webhook] Error transcribiendo audio:", err);
        await sendTextMessage(from, "No pude procesar el audio. Podes escribirlo?");
        return;
      }
    }

    if (!messageText) {
      await sendTextMessage(from, "Recibi tu mensaje pero no pude leerlo. Podes enviarlo como texto?");
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
        phoneNumber: from,
      },
    });

    // 6. Orquestar: detectar modulo y derivar al agente
    const response = await orchestrate(userId, messageText);
    console.log("[whatsapp/webhook] Respuesta del orquestrador:", response);

    // 7. Enviar respuesta al usuario
    await sendTextMessage(from, response);

    // 8. Guardar mensaje OUTBOUND
    await db.whatsAppMessage.create({
      data: {
        userId,
        direction: "OUTBOUND",
        content: response,
        status: "PROCESSED",
        phoneNumber: from,
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

    console.log("[whatsapp/webhook] Procesado OK, msgId=" + waMsg.id);
  } catch (err) {
    console.error("[whatsapp/webhook] Error general:", err);
    // No lanzar - el 200 ya fue enviado a Meta
  }
}

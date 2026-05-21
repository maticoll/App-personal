// lib/whatsapp.ts — WhatsApp Business API + Whisper

export type WhatsAppIncomingMessage = {
  from: string;
  messageId: string;
  type: "text" | "audio" | "image" | "document" | "unknown";
  text?: string;
  audioId?: string;
  timestamp: Date;
  forwarded?: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseIncomingWebhook(body: any): WhatsAppIncomingMessage | null {
  try {
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    if (!value?.messages || value.messages.length === 0) return null;
    const msg = value.messages[0];
    const from: string = msg.from;
    const messageId: string = msg.id;
    const timestamp = new Date(parseInt(msg.timestamp, 10) * 1000);
    const rawType: string = msg.type;
    if (!from || !messageId || !rawType) return null;
    const forwarded: boolean = !!(msg.context?.forwarded || msg.context?.frequently_forwarded);
    if (rawType === "text") return { from, messageId, type: "text", text: msg.text?.body ?? undefined, timestamp, forwarded };
    if (rawType === "audio") return { from, messageId, type: "audio", audioId: msg.audio?.id ?? undefined, timestamp, forwarded };
    if (rawType === "image") return { from, messageId, type: "image", timestamp, forwarded };
    if (rawType === "document") return { from, messageId, type: "document", timestamp, forwarded };
    // Botón de template Quick Reply — tratar como texto con el label del botón
    if (rawType === "button") {
      const buttonText: string = msg.button?.text ?? msg.button?.payload ?? "";
      return { from, messageId, type: "text", text: buttonText, timestamp, forwarded };
    }
    return { from, messageId, type: "unknown", timestamp, forwarded };
  } catch (err) {
    console.error("[whatsapp] Error parseando webhook:", err);
    return null;
  }
}

export async function sendTextMessage(to: string, text: string): Promise<void> {
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const token = process.env.WHATSAPP_TOKEN;
  if (!phoneId || !token) throw new Error("[whatsapp] WHATSAPP_PHONE_ID o WHATSAPP_TOKEN no configurados");
  const url = "https://graph.facebook.com/v21.0/" + phoneId + "/messages";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
  });
  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error("[whatsapp] Error enviando mensaje " + res.status + ": " + errorBody);
  }
}

export async function markAsRead(messageId: string): Promise<void> {
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const token = process.env.WHATSAPP_TOKEN;
  if (!phoneId || !token) return;
  const url = "https://graph.facebook.com/v21.0/" + phoneId + "/messages";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: messageId }),
  });
  if (!res.ok) {
    const errorBody = await res.text();
    console.warn("[whatsapp] No se pudo marcar como leido " + res.status + ": " + errorBody);
  }
}

export async function downloadAudio(audioId: string): Promise<Buffer> {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) throw new Error("[whatsapp] WHATSAPP_TOKEN no configurado");
  const metaRes = await fetch("https://graph.facebook.com/v21.0/" + audioId, {
    headers: { Authorization: "Bearer " + token },
  });
  if (!metaRes.ok) {
    const errBody = await metaRes.text();
    throw new Error("[whatsapp] Error obteniendo media URL " + metaRes.status + ": " + errBody);
  }
  const mediaData = (await metaRes.json()) as { url: string };
  const audioRes = await fetch(mediaData.url, {
    headers: { Authorization: "Bearer " + token },
  });
  if (!audioRes.ok) {
    const errBody = await audioRes.text();
    throw new Error("[whatsapp] Error descargando audio " + audioRes.status + ": " + errBody);
  }
  const arrayBuffer = await audioRes.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// -------------------------------------------------------
// sendTemplateMessage
// Envía un template aprobado por Meta (necesario para mensajes
// proactivos fuera de la ventana de 24hs del usuario).
//
// Uso básico (sin botones):
//   await sendTemplateMessage(to, "wakeup_alert", [])
//
// Con variables:
//   await sendTemplateMessage(to, "bedtime_reminder", [
//     { type: "text", text: "23:00" }
//   ])
//
// Con botón Quick Reply (gym):
//   await sendTemplateMessage(to, "gym_habit_reminder", [], [
//     { type: "button", sub_type: "quick_reply", index: 0,
//       parameters: [{ type: "payload", payload: "AGENDAR_GYM" }] }
//   ])
// -------------------------------------------------------

export type TemplateTextParam = { type: "text"; text: string };

export type TemplateQuickReplyButton = {
  type: "button";
  sub_type: "QUICK_REPLY";
  index: number;
};

export async function sendTemplateMessage(
  to: string,
  templateName: string,
  bodyParams: TemplateTextParam[] = [],
  buttons: TemplateQuickReplyButton[] = [],
  languageCode = "es_AR"
): Promise<void> {
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const token = process.env.WHATSAPP_TOKEN;
  if (!phoneId || !token) throw new Error("[whatsapp] WHATSAPP_PHONE_ID o WHATSAPP_TOKEN no configurados");

  // Construir components: body (si hay variables) + botones
  const components: object[] = [];
  if (bodyParams.length > 0) {
    components.push({ type: "body", parameters: bodyParams });
  }
  for (const btn of buttons) {
    components.push(btn);
  }

  const url = "https://graph.facebook.com/v21.0/" + phoneId + "/messages";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        components: components.length > 0 ? components : undefined,
      },
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error("[whatsapp] Error enviando template '" + templateName + "' " + res.status + ": " + errorBody);
  }
}

/**
 * Envía la plantilla "recordatorios_personales" de WhatsApp.
 * Plantilla (language: en, tipo servicio):
 *   "Dentro de {{1}} tenes {{2}}.\n¿Queres re-agendar?"
 *   Botón Quick Reply: "Re-agendar"
 *
 * @param to           Número de WhatsApp del destinatario
 * @param timeLabel    {{1}} — tiempo restante, ej: "2 horas", "30 minutos"
 * @param eventLabel   {{2}} — qué tiene pendiente, ej: "dentista", "gym"
 */
export async function sendReminderTemplate(
  to: string,
  timeLabel: string,
  eventLabel: string
): Promise<void> {
  await sendTemplateMessage(
    to,
    "recordatorios_personales",
    [
      { type: "text", text: timeLabel },
      { type: "text", text: eventLabel },
    ],
    [{ type: "button", sub_type: "QUICK_REPLY", index: 0 }],
    "en"
  );
}

export async function transcribeAudio(buffer: Buffer): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) throw new Error("[whatsapp] OPENAI_API_KEY no configurada");
  const formData = new FormData();
  const audioBlob = new Blob([new Uint8Array(buffer)], { type: "audio/ogg" });
  formData.append("file", audioBlob, "audio.ogg");
  formData.append("model", "whisper-1");
  formData.append("language", "es");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: "Bearer " + openaiKey },
    body: formData,
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error("[whatsapp] Error en Whisper " + res.status + ": " + errBody);
  }
  const data = (await res.json()) as { text: string };
  return data.text?.trim() ?? "";
}

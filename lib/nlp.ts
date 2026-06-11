// lib/nlp.ts
// Utilidad de deteccion de intencion con Claude Haiku
// Reemplaza la deteccion por regex en todos los agentes.
// Una sola llamada a la API por invocacion de agente.

import { callClaude } from "@/lib/claude";

type IntentMap = Record<string, string>; // { intent: "descripcion corta" }

/**
 * detectIntentAI
 * Clasifica el mensaje del usuario dentro de los intents validos
 * usando Claude Haiku como motor de NLP.
 *
 * @param context     - Rol del agente (p.ej. "eres el agente de sueno"), o prompt completo si systemPrompt no se pasa
 * @param intents     - Mapa de intents validos con descripcion breve
 * @param message     - Texto del usuario a clasificar
 * @param systemPrompt - (opcional) Prompt completo del agente especialista para mejor contexto
 * @returns           - Una de las keys de `intents`, o "unknown" si falla
 */
export async function detectIntentAI(
  context: string,
  intents: IntentMap,
  message: string,
  systemPrompt?: string
): Promise<string> {
  const intentList = Object.entries(intents)
    .map(([k, v]) => k + ": " + v)
    .join("\n");

  const validKeys = Object.keys(intents).join(", ");

  // Si hay un prompt especialista, úsalo como system y deja el context en el user message
  const systemContent = systemPrompt
    ? systemPrompt + "\n\nTu tarea ahora es SOLO clasificar el intent del mensaje. Responde con UNA SOLA PALABRA."
    : undefined;

  const userContent = systemPrompt
    ? `Clasifica este mensaje en uno de estos intents:\n${intentList}\n\nMensaje: "${message}"\n\nResponde SOLO con el nombre del intent (${validKeys}).`
    : context + "\n\n" +
      "Clasifica este mensaje del usuario en UNO de estos intents:\n" +
      intentList + "\n\n" +
      "Mensaje: \"" + message + "\"\n\n" +
      "Responde SOLO con el nombre del intent (" + validKeys + "). Sin explicaciones.";

  const result = await callClaude({
    model: "claude-haiku-4-5-20251001",
    maxTokens: 20,
    ...(systemContent ? { system: systemContent } : {}),
    messages: [{ role: "user", content: userContent }],
  });

  if (!result) return "unknown";

  const raw = result.toLowerCase();
  // Validar que la respuesta sea un intent conocido
  const valid = Object.keys(intents);
  const match = valid.find((k) => raw === k || raw.startsWith(k));
  return match ?? "unknown";
}

/**
 * detectPeriod
 * Detecta el periodo temporal en un mensaje: today, yesterday, week.
 * Funcion auxiliar rapida (sin IA) - los keywords temporales son simples.
 */
export function detectPeriod(message: string): "today" | "yesterday" | "week" {
  const m = message.toLowerCase();
  if (/semana|esta semana|ultimos dias|7 dias/.test(m)) return "week";
  if (/ayer|anoche|la noche anterior/.test(m)) return "yesterday";
  return "today";
}

// lib/nlp.ts
// Utilidad de deteccion de intencion con Claude Haiku
// Reemplaza la deteccion por regex en todos los agentes.
// Una sola llamada a la API por invocacion de agente.

type IntentMap = Record<string, string>; // { intent: "descripcion corta" }

/**
 * detectIntentAI
 * Clasifica el mensaje del usuario dentro de los intents validos
 * usando Claude Haiku como motor de NLP.
 *
 * @param context  - Rol del agente (p.ej. "eres el agente de sueno")
 * @param intents  - Mapa de intents validos con descripcion breve
 * @param message  - Texto del usuario a clasificar
 * @returns        - Una de las keys de `intents`, o "unknown" si falla
 */
export async function detectIntentAI(
  context: string,
  intents: IntentMap,
  message: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[nlp] ANTHROPIC_API_KEY no configurada - usando fallback unknown");
    return "unknown";
  }

  const intentList = Object.entries(intents)
    .map(([k, v]) => k + ": " + v)
    .join("\n");

  const validKeys = Object.keys(intents).join(", ");

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
        max_tokens: 20,
        messages: [
          {
            role: "user",
            content:
              context + "\n\n" +
              "Clasifica este mensaje del usuario en UNO de estos intents:\n" +
              intentList + "\n\n" +
              "Mensaje: \"" + message + "\"\n\n" +
              "Responde SOLO con el nombre del intent (" + validKeys + "). Sin explicaciones.",
          },
        ],
      }),
    });

    if (!res.ok) {
      console.error("[nlp] Error de API: " + res.status);
      return "unknown";
    }

    const data = (await res.json()) as {
      content: Array<{ type: string; text: string }>;
    };

    const raw = data.content?.[0]?.text?.trim().toLowerCase() ?? "";
    // Validar que la respuesta sea un intent conocido
    const valid = Object.keys(intents);
    const match = valid.find((k) => raw === k || raw.startsWith(k));
    return match ?? "unknown";
  } catch (err) {
    console.error("[nlp] Error llamando a Claude:", err);
    return "unknown";
  }
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

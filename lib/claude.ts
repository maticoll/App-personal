// ============================================================
// lib/claude.ts — Cliente único para la Claude API (Anthropic)
//
// Centraliza las llamadas a api.anthropic.com con:
//   - Retry + backoff exponencial ante 429 (rate limit) y 529/5xx (sobrecarga)
//   - Parseo del primer bloque de texto de la respuesta
//   - Manejo uniforme de errores (devuelve null en vez de tirar)
//
// Modelos hardcodeados del proyecto:
//   - Clasificación / NLP: "claude-haiku-4-5-20251001"
//   - Respuesta final:      "claude-sonnet-4-6"
// ============================================================

export type ClaudeMessage = { role: "user" | "assistant"; content: string };

export type CallClaudeParams = {
  model: string;
  maxTokens: number;
  system?: string;
  messages: ClaudeMessage[];
  /** Reintentos ante 429/5xx/529 antes de rendirse. Default 2. */
  maxRetries?: number;
};

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Llama a la Claude API y devuelve el texto de la respuesta, o null si
 * falla (sin API key, error irrecuperable, o agotó los reintentos).
 * Nunca lanza: el caller decide el fallback ante null.
 */
export async function callClaude(params: CallClaudeParams): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[claude] ANTHROPIC_API_KEY no configurada");
    return null;
  }

  const { model, maxTokens, system, messages, maxRetries = 2 } = params;

  const body = JSON.stringify({
    model,
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    messages,
  });

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body,
      });

      if (res.ok) {
        const data = (await res.json()) as {
          content?: Array<{ type: string; text: string }>;
        };
        return data.content?.[0]?.text?.trim() ?? null;
      }

      // 429 (rate limit) y 529/5xx (sobrecarga/servidor) → reintentar con backoff
      const retryable = res.status === 429 || res.status === 529 || res.status >= 500;
      if (retryable && attempt < maxRetries) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const backoffMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 500 * Math.pow(2, attempt); // 500ms, 1s, 2s...
        console.warn(`[claude] ${res.status} — reintento ${attempt + 1}/${maxRetries} en ${backoffMs}ms`);
        await sleep(backoffMs);
        continue;
      }

      const errText = await res.text().catch(() => "");
      console.error(`[claude] Error ${res.status}: ${errText}`);
      return null;
    } catch (err) {
      // Error de red → reintentar
      if (attempt < maxRetries) {
        const backoffMs = 500 * Math.pow(2, attempt);
        console.warn(`[claude] Error de red — reintento ${attempt + 1}/${maxRetries} en ${backoffMs}ms`);
        await sleep(backoffMs);
        continue;
      }
      console.error("[claude] Error de red irrecuperable:", err);
      return null;
    }
  }

  return null;
}

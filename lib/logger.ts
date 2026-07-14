// ============================================================
// Logger — Axiom via @axiomhq/js (SDK oficial)
// Fire-and-forget: nunca bloquea el flujo principal
// Uso: logger.info('whatsapp', { event: 'message_received', from })
// ============================================================

import { Axiom } from "@axiomhq/js";
import { after } from "next/server";

let axiomClient: Axiom | null = null;
let flushScheduled = false;

/**
 * En serverless el buffer de ingest muere cuando la lambda se congela si
 * nadie llama a flush(). Programamos UN flush por request vía after():
 * Vercel mantiene viva la función hasta que el callback termina.
 * Fallback (fuera de un request context, ej. scripts): flush directo.
 */
function scheduleFlush(client: Axiom): void {
  if (flushScheduled) return;
  flushScheduled = true;

  const doFlush = async () => {
    flushScheduled = false;
    await client.flush().catch(() => {
      // Silencioso — nunca romper la app por un fallo de logging
    });
  };

  try {
    after(doFlush);
  } catch {
    void doFlush();
  }
}

function getClient(): Axiom | null {
  if (!process.env.AXIOM_TOKEN || !process.env.AXIOM_DATASET) return null;
  if (!axiomClient) {
    axiomClient = new Axiom({ token: process.env.AXIOM_TOKEN });
  }
  return axiomClient;
}

type LogLevel = "debug" | "info" | "warn" | "error";

function log(
  level: LogLevel,
  source: string,
  data: Record<string, unknown>,
): void {
  const payload = {
    _time: new Date().toISOString(),
    level,
    source,
    ...data,
  };

  // Console local siempre (Vercel también los muestra en su dashboard)
  const consoleFn =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : console.log;
  consoleFn(`[${source}]`, data);

  // Axiom async — ingest al buffer sin bloquear + flush programado al final
  // del request (sin el flush, los logs quedaban en el buffer y se perdían
  // al congelarse la lambda).
  const client = getClient();
  if (client) {
    const dataset = process.env.AXIOM_DATASET!;
    try {
      client.ingest(dataset, [payload]);
      scheduleFlush(client);
    } catch {
      // Silencioso — nunca romper la app por un fallo de logging
    }
  }
}

export const logger = {
  debug: (source: string, data: Record<string, unknown>) =>
    log("debug", source, data),
  info: (source: string, data: Record<string, unknown>) =>
    log("info", source, data),
  warn: (source: string, data: Record<string, unknown>) =>
    log("warn", source, data),
  error: (source: string, data: Record<string, unknown>) =>
    log("error", source, data),
};

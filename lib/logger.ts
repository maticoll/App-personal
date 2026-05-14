// ============================================================
// Logger — Axiom via @axiomhq/js (SDK oficial)
// Fire-and-forget: nunca bloquea el flujo principal
// Uso: logger.info('whatsapp', { event: 'message_received', from })
// ============================================================

import { Axiom } from "@axiomhq/js";

let axiomClient: Axiom | null = null;

function getClient(): Axiom | null {
  if (!process.env.AXIOM_TOKEN || !process.env.AXIOM_DATASET) return null;
  if (!axiomClient) {
    axiomClient = new Axiom({ token: process.env.AXIOM_TOKEN });
  }
  return axiomClient;
}

type LogLevel = "debug" | "info" | "warn" | "error";

function log(level: LogLevel, source: string, data: Record<string, unknown>): void {
  const payload = {
    _time: new Date().toISOString(),
    level,
    source,
    env: process.env.NODE_ENV ?? "development",
    ...data,
  };

  // Console local siempre (Vercel también los muestra en su dashboard)
  const consoleFn =
    level === "error" ? console.error
    : level === "warn" ? console.warn
    : console.log;
  consoleFn(`[${source}]`, data);

  // Axiom async — ingest sin bloquear
  const client = getClient();
  if (client) {
    const dataset = process.env.AXIOM_DATASET!;
    void client.ingest(dataset, [payload]).catch(() => {
      // Silencioso — nunca romper la app por un fallo de logging
    });
  }
}

export const logger = {
  debug: (source: string, data: Record<string, unknown>) => log("debug", source, data),
  info:  (source: string, data: Record<string, unknown>) => log("info",  source, data),
  warn:  (source: string, data: Record<string, unknown>) => log("warn",  source, data),
  error: (source: string, data: Record<string, unknown>) => log("error", source, data),
};

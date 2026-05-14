// ============================================================
// Logger — Axiom via REST API
// Fire-and-forget: nunca bloquea el flujo principal
// Uso: logger.info('whatsapp', { event: 'message_received', from })
// ============================================================

type LogLevel = "info" | "warn" | "error";

interface LogEvent {
  _time: string;
  level: LogLevel;
  source: string;
  env: string;
  [key: string]: unknown;
}

async function send(events: LogEvent[]): Promise<void> {
  const token = process.env.AXIOM_TOKEN;
  const dataset = process.env.AXIOM_DATASET;

  if (!token || !dataset) return; // Sin config → silencioso

  try {
    await fetch(`https://api.axiom.co/v1/datasets/${dataset}/ingest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(events),
    });
  } catch {
    // No propagar errores del logger — nunca romper la app por logs
  }
}

function log(level: LogLevel, source: string, data: Record<string, unknown>): void {
  const event: LogEvent = {
    _time: new Date().toISOString(),
    level,
    source,
    env: process.env.NODE_ENV ?? "development",
    ...data,
  };

  // Console local siempre (Vercel también los captura)
  const consoleFn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  consoleFn(`[${source}]`, data);

  // Axiom async — no await, no bloquea
  void send([event]);
}

export const logger = {
  info: (source: string, data: Record<string, unknown>) => log("info", source, data),
  warn: (source: string, data: Record<string, unknown>) => log("warn", source, data),
  error: (source: string, data: Record<string, unknown>) => log("error", source, data),
};

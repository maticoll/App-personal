// ============================================================
// lib/conversation.ts — Memoria de conversación para HERMES
//
// Implementa rolling window (K=8 turnos) + summarización
// automática cada M=12 turnos o después de un gap >= 6h.
//
// Inspirado en Core/app/services/memory_service.py
// ============================================================

import { db } from "@/lib/db";
import { callClaude } from "@/lib/claude";
import type { ConversationTurn } from "@/lib/types";

// ── Configuración ──────────────────────────────────────────
const K = 8; // Turnos recientes a mantener en ventana
const M = 12; // Número de turnos que dispara summarización
const GAP_H = 6; // Horas de inactividad que disparan summarización

// ── Tipos internos ─────────────────────────────────────────
export type ConversationContext = {
  recentTurns: ConversationTurn[];
  summary: string | null;
};

// ── Helpers ────────────────────────────────────────────────

function parseTurns(json: unknown): ConversationTurn[] {
  if (!Array.isArray(json)) return [];
  return json as ConversationTurn[];
}

function isoNow(): string {
  return new Date().toISOString();
}

// ── API pública ────────────────────────────────────────────

/**
 * Retorna los turnos recientes + resumen actual para el orquestrador.
 */
export async function getConversationContext(
  userId: string,
): Promise<ConversationContext> {
  const mem = await db.conversationMemory.findUnique({ where: { userId } });
  if (!mem) return { recentTurns: [], summary: null };

  const turns = parseTurns(mem.recentMessages);
  return {
    recentTurns: turns.slice(-K),
    summary: mem.summary ?? null,
  };
}

/**
 * Añade uno o más turnos (user/assistant) a la ventana deslizante en UNA sola
 * operación read-modify-write. Guardar el par user+assistant con dos addTurn
 * en paralelo perdía casi siempre uno de los dos (el último write pisaba al
 * otro) — por eso los call sites del orquestrador usan esta función.
 * Si se llega a M turnos, dispara summarización.
 * Si hay un gap >= GAP_H desde el último turno, también summariza.
 */
export async function addTurns(
  userId: string,
  turns: { role: "user" | "assistant"; content: string }[],
): Promise<void> {
  if (turns.length === 0) return;

  const now = isoNow();
  const newTurns: ConversationTurn[] = turns.map((t) => ({
    role: t.role,
    content: t.content,
    timestamp: now,
  }));

  // Upsert: crear si no existe, actualizar si existe
  const existing = await db.conversationMemory.findUnique({
    where: { userId },
  });

  if (!existing) {
    await db.conversationMemory.create({
      data: {
        userId,
        recentMessages: newTurns,
        summary: null,
        turnCount: newTurns.length,
        updatedAt: new Date(),
      },
    });
    return;
  }

  const prevTurns = parseTurns(existing.recentMessages);
  const newCount = existing.turnCount + newTurns.length;

  // Detectar gap temporal
  const lastTimestamp = prevTurns[prevTurns.length - 1]?.timestamp;
  const hasLongGap = lastTimestamp
    ? Date.now() - new Date(lastTimestamp).getTime() > GAP_H * 60 * 60 * 1000
    : false;

  // Si hay gap o se alcanzó el umbral M → summarizar primero
  const shouldSummarize = hasLongGap || newCount >= M;

  let summary = existing.summary ?? null;
  let updatedTurns = [...prevTurns, ...newTurns];

  if (shouldSummarize && prevTurns.length > 0) {
    try {
      summary = await summarizeTurns(prevTurns, summary);
      // Después de summarizar, limpiamos la ventana (solo mantenemos K más recientes)
      updatedTurns = [...prevTurns.slice(-K), ...newTurns];
    } catch (err) {
      console.error("[conversation] Error summarizando:", err);
      // Si falla la summarización, igual continuamos
    }
  }

  // Si la ventana supera K*2, recortar (sin summarización de emergencia)
  if (updatedTurns.length > K * 2) {
    updatedTurns = updatedTurns.slice(-K);
  }

  await db.conversationMemory.update({
    where: { userId },
    data: {
      recentMessages: updatedTurns,
      summary,
      turnCount: shouldSummarize ? newTurns.length : newCount,
      updatedAt: new Date(),
    },
  });
}

/**
 * Añade un único turno. Para guardar user+assistant juntos usar addTurns
 * (dos addTurn en paralelo se pisan entre sí).
 */
export async function addTurn(
  userId: string,
  role: "user" | "assistant",
  content: string,
): Promise<void> {
  return addTurns(userId, [{ role, content }]);
}

/**
 * Formatea el contexto de conversación en un string listo para inyectar
 * en el system prompt del orquestrador.
 */
export function formatContextForPrompt(ctx: ConversationContext): string {
  const parts: string[] = [];

  if (ctx.summary) {
    parts.push(`RESUMEN DE LA CONVERSACIÓN ANTERIOR:\n${ctx.summary}`);
  }

  if (ctx.recentTurns.length > 0) {
    const lines = ctx.recentTurns.map((t) => {
      const who = t.role === "user" ? "Corea" : "HERMES";
      return `${who}: ${t.content}`;
    });
    parts.push(`ÚLTIMOS MENSAJES:\n${lines.join("\n")}`);
  }

  return parts.join("\n\n");
}

// ── Summarización ──────────────────────────────────────────

/**
 * Llama a Claude Haiku para comprimir los turnos en un resumen de ≤120 palabras.
 * Si ya había un resumen previo, lo incorpora.
 */
async function summarizeTurns(
  turns: ConversationTurn[],
  previousSummary: string | null,
): Promise<string> {
  const conversationText = turns
    .map((t) => `${t.role === "user" ? "Usuario" : "Asistente"}: ${t.content}`)
    .join("\n");

  const contextSection = previousSummary
    ? `RESUMEN PREVIO (que debés incorporar):\n${previousSummary}\n\n`
    : "";

  const prompt = `${contextSection}CONVERSACIÓN A RESUMIR:\n${conversationText}\n\nResumí esta conversación en tercera persona, en español, en máximo 120 palabras. Enfocate en los temas tratados, lo que quedó pendiente y cualquier dato personal mencionado (objetivos, números, intenciones). Sé conciso y factual.`;

  const result = await callClaude({
    model: "claude-haiku-4-5-20251001",
    maxTokens: 200,
    messages: [{ role: "user", content: prompt }],
  });

  return result ?? previousSummary ?? "";
}

/**
 * Limpia la memoria de conversación de un usuario (útil para tests o reset manual).
 */
export async function clearConversationMemory(userId: string): Promise<void> {
  await db.conversationMemory.deleteMany({ where: { userId } });
}

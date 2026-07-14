// ============================================================
// lib/pending-transaction.ts
// Manejo del estado de confirmación de transacciones financieras
// en el flujo de WhatsApp (HERMES).
//
// Flujo:
//   1. Agente finanzas parsea el mensaje → guarda pendiente
//   2. Si no se encontró tarjeta → step "select_card" (con lista de cards)
//   3. Si se encontró tarjeta    → step "confirm" (esperando sí/no)
//   4. Usuario responde          → orchestrator redirige acá antes de Haiku
// ============================================================

import { db } from "@/lib/db";
import type { FinancesCard } from "@/lib/finances";

// ─── Configuración ────────────────────────────────────────────────────────────

/**
 * TTL de una transacción pendiente. Si el usuario abandona el flujo de
 * confirmación a mitad de camino, el pending queda colgado y —como userId es
 * UNIQUE— bloquea TODOS los mensajes futuros (el orquestrador los desvía a
 * handleConfirmation). Con este TTL, un pending vencido se trata como
 * inexistente y se borra al consultarlo, evitando el bloqueo.
 */
const PENDING_TTL_MS = 30 * 60 * 1000; // 30 minutos

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type PendingStep = "select_card" | "confirm";

export type PendingTransactionData = {
  amount: number;
  type: "gasto" | "ingreso";
  currency: "UYU" | "USD";
  description: string;
  date: string; // YYYY-MM-DD
  cardId: string; // vacío ("") cuando step = "select_card"
  cardName?: string;
  categoryId?: string;
  categoryName?: string;
};

export type PendingRecord = {
  data: PendingTransactionData;
  step: PendingStep;
  cards?: FinancesCard[]; // sólo cuando step = "select_card"
};

// ─── Funciones ────────────────────────────────────────────────────────────────

/**
 * Guarda (upsert) una transacción pendiente para el usuario.
 */
export async function savePending(
  userId: string,
  data: PendingTransactionData,
  step: PendingStep,
  cards?: FinancesCard[],
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {
    data: data as unknown as import("@prisma/client").Prisma.JsonObject,
    step,
    cards: cards
      ? (cards as unknown as import("@prisma/client").Prisma.JsonObject)
      : null,
  };

  await db.pendingTransaction.upsert({
    where: { userId },
    create: { userId, ...payload },
    update: payload,
  });
}

/**
 * Recupera la transacción pendiente del usuario.
 * Devuelve null si no hay ninguna.
 */
export async function getPending(
  userId: string,
): Promise<PendingRecord | null> {
  const record = await db.pendingTransaction
    .findUnique({ where: { userId } })
    .catch(() => null);

  if (!record) return null;

  // Si el pending venció (flujo abandonado), borrarlo y tratar como inexistente
  // para no bloquear los mensajes siguientes del usuario.
  if (Date.now() - record.createdAt.getTime() > PENDING_TTL_MS) {
    await db.pendingTransaction
      .deleteMany({ where: { userId } })
      .catch(() => null);
    return null;
  }

  return {
    data: record.data as unknown as PendingTransactionData,
    step: record.step as PendingStep,
    cards: record.cards
      ? (record.cards as unknown as FinancesCard[])
      : undefined,
  };
}

/**
 * Borra el pending de forma atómica y devuelve si esta invocación lo "ganó".
 * Llamar ANTES de ejecutar efectos externos (crear la transacción en la API
 * de finanzas): si dos mensajes casi simultáneos (doble "sí", retry de Meta)
 * leen el mismo pending, solo la lambda cuyo deleteMany borró el registro
 * ejecuta el efecto — la otra recibe count 0 y no duplica.
 */
export async function claimPending(userId: string): Promise<boolean> {
  const { count } = await db.pendingTransaction.deleteMany({
    where: { userId },
  });
  return count > 0;
}

/**
 * Elimina la transacción pendiente del usuario.
 * Seguro de llamar aunque no exista ninguna.
 */
export async function clearPending(userId: string): Promise<void> {
  await db.pendingTransaction
    .deleteMany({ where: { userId } })
    .catch(() => null);
}

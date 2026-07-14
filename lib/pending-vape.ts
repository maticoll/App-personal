// ============================================================
// lib/pending-vape.ts
// Estado de "esperando el nombre del comprador" tras una venta de vapes.
//
// Reusa la tabla pending_transactions (userId UNIQUE) con un marcador
// data.kind = "vape_buyer" para distinguirla de los pendientes de finanzas.
// El orquestrador chequea getVapePending ANTES del pending de finanzas y,
// si existe, desvía el mensaje (el nombre) a vapesAgent.handleBuyerReply.
// ============================================================

import { db } from "@/lib/db";

const PENDING_TTL_MS = 30 * 60 * 1000; // 30 min — flujo abandonado se descarta

export type VapePendingLinea = {
  alias: string;
  nombre: string;
  count: number;
  price: number;
};

export type VapeBuyerPending = {
  kind: "vape_buyer";
  tipo: "venta" | "compra";
  lineas: VapePendingLinea[];
  /** Paso del flujo: "buyer" (esperando comprador) | "payment" (esperando pago/debe) */
  step?: "buyer" | "payment";
  /** Comprador ya capturado (cuando step = "payment") */
  comprador?: string;
};

/** Esperando que el usuario complete/repita una venta que no se pudo parsear
 *  (faltaba total, sabor ambiguo, etc.). La próxima respuesta se reinterpreta
 *  como venta/compra forzando este `tipo`. */
export type VapeClarifyPending = {
  kind: "vape_clarify";
  tipo: "venta" | "compra";
};

export type VapePending = VapeBuyerPending | VapeClarifyPending;

export async function saveVapePending(
  userId: string,
  pending: VapePending,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = pending as unknown as import("@prisma/client").Prisma.JsonObject;
  await db.pendingTransaction.upsert({
    where: { userId },
    create: { userId, data, step: "vape_buyer", cards: undefined },
    update: { data, step: "vape_buyer", cards: undefined },
  });
}

export async function getVapePending(
  userId: string,
): Promise<VapePending | null> {
  const record = await db.pendingTransaction
    .findUnique({ where: { userId } })
    .catch(() => null);
  if (!record) return null;

  if (Date.now() - record.createdAt.getTime() > PENDING_TTL_MS) {
    await db.pendingTransaction
      .deleteMany({ where: { userId } })
      .catch(() => null);
    return null;
  }

  const data = record.data as unknown as { kind?: string };
  if (data?.kind !== "vape_buyer" && data?.kind !== "vape_clarify") return null; // pending de finanzas, no nuestro
  return record.data as unknown as VapePending;
}

/**
 * Borra el pending de forma atómica y devuelve si esta invocación lo "ganó".
 * Llamar ANTES de ejecutar efectos externos (Nubez / finanzas): dos mensajes
 * casi simultáneos no deben descontar stock ni registrar el ingreso dos veces.
 */
export async function claimVapePending(userId: string): Promise<boolean> {
  const { count } = await db.pendingTransaction.deleteMany({
    where: { userId },
  });
  return count > 0;
}

export async function clearVapePending(userId: string): Promise<void> {
  await db.pendingTransaction
    .deleteMany({ where: { userId } })
    .catch(() => null);
}

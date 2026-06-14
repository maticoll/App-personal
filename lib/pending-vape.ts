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

export type VapePending = {
  kind: "vape_buyer";
  tipo: "venta" | "compra";
  lineas: VapePendingLinea[];
};

export async function saveVapePending(userId: string, pending: VapePending): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = pending as unknown as import("@prisma/client").Prisma.JsonObject;
  await db.pendingTransaction.upsert({
    where: { userId },
    create: { userId, data, step: "vape_buyer", cards: undefined },
    update: { data, step: "vape_buyer", cards: undefined },
  });
}

export async function getVapePending(userId: string): Promise<VapePending | null> {
  const record = await db.pendingTransaction.findUnique({ where: { userId } }).catch(() => null);
  if (!record) return null;

  if (Date.now() - record.createdAt.getTime() > PENDING_TTL_MS) {
    await db.pendingTransaction.deleteMany({ where: { userId } }).catch(() => null);
    return null;
  }

  const data = record.data as unknown as { kind?: string };
  if (data?.kind !== "vape_buyer") return null; // es un pending de finanzas, no nuestro
  return record.data as unknown as VapePending;
}

export async function clearVapePending(userId: string): Promise<void> {
  await db.pendingTransaction.deleteMany({ where: { userId } }).catch(() => null);
}

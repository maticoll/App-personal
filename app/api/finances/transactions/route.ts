// GET  /api/finances/transactions — lista transacciones del mes
// POST /api/finances/transactions — crea una transacción

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getRecentTransactions, createTransaction } from "@/lib/finances";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);
  const month = searchParams.get("month")
    ? parseInt(searchParams.get("month")!, 10)
    : undefined;
  const year = searchParams.get("year")
    ? parseInt(searchParams.get("year")!, 10)
    : undefined;

  const transactions = await getRecentTransactions(session.user.id, limit, month, year);
  return NextResponse.json({ ok: true, transactions, count: transactions.length });
}

type CreateBody = {
  cardId: string;
  amount: number;
  type: "gasto" | "ingreso";
  description: string;
  date?: string;
  categoryId?: string;
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  if (!body.cardId || !body.amount || !body.type || !body.description) {
    return NextResponse.json(
      { error: "Faltan campos requeridos: cardId, amount, type, description" },
      { status: 400 }
    );
  }

  const tx = await createTransaction(session.user.id, body);
  if (!tx) {
    return NextResponse.json(
      { error: "No se pudo crear la transacción. Verificá la API key de finanzas en Ajustes." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, transaction: tx });
}

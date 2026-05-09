// ============================================================
// GET /api/scoring/history
// Retorna histórico de scores para gráficos.
//
// Query params:
//   period: "daily" | "weekly" | "monthly"  (default: "weekly")
//   from:   ISO date string                  (opcional, override)
//   to:     ISO date string                  (opcional, override)
//   mock:   "true"                           (usa datos mock para demo)
// ============================================================

import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import {
  getScoreHistory,
  generateMockHistory,
} from "@/lib/scoring";

function getDateRange(period: string): { from: Date; to: Date } {
  const to = new Date();
  to.setHours(23, 59, 59, 999);

  const from = new Date();

  switch (period) {
    case "daily":
      // Últimos 14 días
      from.setDate(from.getDate() - 13);
      break;
    case "weekly":
      // Últimas 8 semanas (56 días)
      from.setDate(from.getDate() - 55);
      break;
    case "monthly":
      // Últimos 6 meses
      from.setMonth(from.getMonth() - 6);
      break;
    default:
      from.setDate(from.getDate() - 13);
  }

  from.setHours(0, 0, 0, 0);
  return { from, to };
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const period = searchParams.get("period") ?? "weekly";
  const useMock = searchParams.get("mock") === "true";

  if (useMock) {
    const days =
      period === "daily" ? 14 : period === "weekly" ? 56 : 180;
    return NextResponse.json({ entries: generateMockHistory(days), mock: true });
  }

  // Determinar rango de fechas
  let from: Date;
  let to: Date;

  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  if (fromParam && toParam) {
    from = new Date(fromParam);
    to = new Date(toParam);
  } else {
    ({ from, to } = getDateRange(period));
  }

  const userId = session.user.id;
  const entries = await getScoreHistory(userId, from, to);

  // Si no hay datos reales, devolver mock transparentemente
  if (entries.length === 0) {
    const days =
      period === "daily" ? 14 : period === "weekly" ? 56 : 180;
    return NextResponse.json({
      entries: generateMockHistory(days),
      mock: true,
      from: from.toISOString(),
      to: to.toISOString(),
    });
  }

  return NextResponse.json({
    entries,
    mock: false,
    from: from.toISOString(),
    to: to.toISOString(),
  });
}

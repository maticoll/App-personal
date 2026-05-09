// ============================================================
// GET /api/sleep/history?days=14
// Historial de sueño + estadísticas semanales
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSleepHistory, getWeeklyStats } from "@/lib/sleep";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const userId = session.user.id;
  const { searchParams } = new URL(req.url);
  const days = Math.min(parseInt(searchParams.get("days") ?? "30"), 90);

  const [history, weeklyStats] = await Promise.all([
    getSleepHistory(userId, days),
    getWeeklyStats(userId),
  ]);

  return NextResponse.json({ history, weeklyStats, days });
}

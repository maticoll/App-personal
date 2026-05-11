// ============================================================
// GET /api/nutrition/weekly-stats
// Stats de la semana actual
// ============================================================

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getWeeklyNutritionStats } from "@/lib/nutrition";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const stats = await getWeeklyNutritionStats(session.user.id);
  return NextResponse.json(stats);
}

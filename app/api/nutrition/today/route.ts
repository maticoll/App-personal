// ============================================================
// GET /api/nutrition/today
// Resumen nutricional del día actual
// ============================================================

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTodayNutritionSummary } from "@/lib/nutrition";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const summary = await getTodayNutritionSummary(session.user.id);
  return NextResponse.json(summary);
}

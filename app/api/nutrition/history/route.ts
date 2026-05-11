// ============================================================
// GET /api/nutrition/history?days=14
// Historial de comidas agrupado por día
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getMealHistory } from "@/lib/nutrition";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const days = Math.min(parseInt(searchParams.get("days") ?? "14"), 60);

  const history = await getMealHistory(session.user.id, days);
  return NextResponse.json({ history });
}

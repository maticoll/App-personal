// ============================================================
// POST /api/scoring/calculate
// Fuerza el recálculo del score para una fecha dada.
// Body: { date?: string (ISO) }  — default: hoy
// ============================================================

import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { calculateFullScore, saveScore } from "@/lib/scoring";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  let date: Date;
  try {
    const body = await request.json();
    date = body.date ? new Date(body.date) : new Date();
  } catch {
    date = new Date();
  }

  const result = await calculateFullScore(userId, date);
  await saveScore(userId, date, result);

  return NextResponse.json({
    success: true,
    global: result.global,
    sleep: result.sleep.score,
    fitness: result.fitness.score,
    nutrition: result.nutrition.score,
    projects: result.projects.score,
    date: date.toISOString(),
  });
}

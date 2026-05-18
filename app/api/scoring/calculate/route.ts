// ============================================================
// /api/scoring/calculate
//
// GET  — calcula el score de HOY para el usuario autenticado
// POST — fuerza recálculo para una fecha dada
//        Body: { date?: string (ISO) }  — default: hoy
//
// Nota: GET resuelve el error 405 cuando el botón "Recalcular"
// o algún cron llama al endpoint sin body.
// ============================================================

import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { calculateFullScore, saveScore } from "@/lib/scoring";

async function calculate(userId: string, date: Date) {
  const result = await calculateFullScore(userId, date);
  await saveScore(userId, date, result);
  return NextResponse.json({
    success:   true,
    global:    result.global,
    sleep:     result.sleep.score,
    fitness:   result.fitness.score,
    nutrition: result.nutrition.score,
    projects:  result.projects.score,
    finances:  result.finances.score,
    date:      date.toISOString(),
  });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return calculate(session.user.id, new Date());
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let date: Date;
  try {
    const body = await request.json();
    date = body.date ? new Date(body.date) : new Date();
  } catch {
    date = new Date();
  }

  return calculate(session.user.id, date);
}

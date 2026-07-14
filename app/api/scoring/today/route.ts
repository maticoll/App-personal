// ============================================================
// GET /api/scoring/today
// Retorna el score del día actual.
// Si no hay score guardado, lo calcula en el momento y lo guarda.
// ============================================================

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { calculateFullScore, saveScore, getStoredScore } from "@/lib/scoring";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const today = new Date();

  // El score de HOY se recalcula siempre — devolver el stored lo congelaba
  // con los datos de la primera consulta del día. El stored queda como
  // fallback si el cálculo falla.
  let result;
  try {
    result = await calculateFullScore(userId, today);
    await saveScore(userId, today, result);
  } catch {
    const stored = await getStoredScore(userId, today).catch(() => null);
    if (stored) {
      return NextResponse.json({ score: stored, cached: true });
    }
    return NextResponse.json(
      { error: "No se pudo calcular el score" },
      { status: 500 },
    );
  }

  // Retornar en formato DailyScoreData
  return NextResponse.json({
    score: {
      sleep: result.sleep.score,
      fitness: result.fitness.score,
      nutrition: result.nutrition.score,
      projects: result.projects.score,
      finances: result.finances.score,
      global: result.global,
      date: today,
      details: {
        sleep: { met: result.sleep.met, missed: result.sleep.missed },
        fitness: { met: result.fitness.met, missed: result.fitness.missed },
        nutrition: {
          met: result.nutrition.met,
          missed: result.nutrition.missed,
        },
        projects: { met: result.projects.met, missed: result.projects.missed },
        finances: { met: result.finances.met, missed: result.finances.missed },
      },
    },
    cached: false,
  });
}

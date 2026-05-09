// ============================================================
// GET /api/scoring/today
// Retorna el score del día actual.
// Si no hay score guardado, lo calcula en el momento y lo guarda.
// ============================================================

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import {
  calculateFullScore,
  saveScore,
  getStoredScore,
} from "@/lib/scoring";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const today = new Date();

  // Intentar leer el score guardado del día
  const stored = await getStoredScore(userId, today);

  if (stored) {
    return NextResponse.json({ score: stored, cached: true });
  }

  // Si no hay score guardado, calcularlo y guardarlo
  const result = await calculateFullScore(userId, today);
  await saveScore(userId, today, result);

  // Retornar en formato DailyScoreData
  return NextResponse.json({
    score: {
      sleep: result.sleep.score,
      fitness: result.fitness.score,
      nutrition: result.nutrition.score,
      projects: result.projects.score,
      global: result.global,
      date: today,
      details: {
        sleep: { met: result.sleep.met, missed: result.sleep.missed },
        fitness: { met: result.fitness.met, missed: result.fitness.missed },
        nutrition: { met: result.nutrition.met, missed: result.nutrition.missed },
        projects: { met: result.projects.met, missed: result.projects.missed },
      },
    },
    cached: false,
  });
}

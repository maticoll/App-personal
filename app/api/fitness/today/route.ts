// GET /api/fitness/today
// Retorna workouts de hoy + rutina esperada + estado de smart habits
// Usado por el cliente para refreshes en tiempo real

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getTodayWorkouts,
  getTodayGymRoutine,
  checkSmartHabitDeviation,
  getTodaySteps,
} from "@/lib/fitness";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const userId = session.user.id;

    const [workouts, routine, smartHabit, steps] = await Promise.all([
      getTodayWorkouts(userId),
      getTodayGymRoutine(userId),
      checkSmartHabitDeviation(userId),
      getTodaySteps(userId).catch(() => null),
    ]);

    return NextResponse.json({ workouts, routine, smartHabit, steps });
  } catch (err) {
    console.error("[/api/fitness/today]", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

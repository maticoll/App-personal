import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { saveWorkoutSession, type WorkoutSessionPayload } from "@/lib/fitness";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = (await req.json()) as WorkoutSessionPayload;
    if (!body || !Array.isArray(body.exercises)) {
      return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
    }

    const summary = await saveWorkoutSession(session.user.id, {
      routineName: body.routineName ?? null,
      durationSeconds: Math.max(0, Number(body.durationSeconds) || 0),
      exercises: body.exercises,
    });
    return NextResponse.json({ summary }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al guardar la sesión";
    console.error("[POST /api/fitness/session]", err);
    const status = message.includes("series con datos") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

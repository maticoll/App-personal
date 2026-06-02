// POST /api/fitness/start-routine
// Inicia (o reutiliza) la sesión de gym de hoy y la etiqueta con el nombre de
// la rutina indicada. Permite registrar CUALQUIER rutina, no solo la del día.
// Body: { title?: string }

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { startGymWorkout } from "@/lib/fitness";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : undefined;

    const workout = await startGymWorkout(session.user.id, title);
    return NextResponse.json({ workout }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/fitness/start-routine]", err);
    return NextResponse.json(
      { error: "Error al iniciar la rutina" },
      { status: 500 }
    );
  }
}

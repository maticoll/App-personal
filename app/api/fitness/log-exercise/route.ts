// POST /api/fitness/log-exercise
// Parsea texto en lenguaje natural con Claude API y registra ejercicios
// en la sesión de gym de hoy (la crea si no existe).
//
// Body: { text: string }
// Ej:  { text: "press plano 100kg 4 reps 3 series" }
//
// Requiere: ANTHROPIC_API_KEY en .env.local

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { parseAndLogExerciseNLP } from "@/lib/fitness";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const { text } = body as { text?: string };

    if (!text?.trim()) {
      return NextResponse.json(
        { error: "El campo 'text' es requerido" },
        { status: 400 }
      );
    }

    const result = await parseAndLogExerciseNLP(session.user.id, text.trim());

    return NextResponse.json({
      workout: result.workout,
      parsedExercises: result.parsedExercises,
      message: result.message,
    });
  } catch (err) {
    console.error("[POST /api/fitness/log-exercise]", err);
    const message =
      err instanceof Error ? err.message : "Error al procesar el ejercicio";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

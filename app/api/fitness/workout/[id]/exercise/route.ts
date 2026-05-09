// POST /api/fitness/workout/[id]/exercise
// Agrega ejercicios (con sus series) a un workout de gym existente.
// Body: { exercises: [{ name: string, sets: [{ reps, weightKg }] }] }

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { addExerciseSets } from "@/lib/fitness";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id: workoutId } = await params;

    // Verificar propiedad
    const workout = await db.workout.findFirst({
      where: { id: workoutId, userId: session.user.id },
    });
    if (!workout) {
      return NextResponse.json(
        { error: "Workout no encontrado" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const exercises = body.exercises as Array<{
      name: string;
      sets: { reps: number | null; weightKg: number | null }[];
    }>;

    if (!Array.isArray(exercises) || exercises.length === 0) {
      return NextResponse.json(
        { error: "Se esperan ejercicios en body.exercises" },
        { status: 400 }
      );
    }

    const created = [];
    for (const ex of exercises) {
      const exercise = await addExerciseSets(workoutId, ex.name, ex.sets);
      created.push(exercise);
    }

    return NextResponse.json({ exercises: created }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/fitness/workout/[id]/exercise]", err);
    return NextResponse.json(
      { error: "Error al registrar ejercicio" },
      { status: 500 }
    );
  }
}

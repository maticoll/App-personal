// GET  /api/fitness/routines  — listar rutinas
// POST /api/fitness/routines  — crear rutina

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getRoutines, createRoutine } from "@/lib/fitness";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const routines = await getRoutines(session.user.id);
    return NextResponse.json({ routines });
  } catch (err) {
    console.error("[GET /api/fitness/routines]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const { name, days, exercises } = body as {
      name: string;
      days: string[];
      exercises: {
        name: string;
        order?: number;
        sets?: number;
        repsRange?: string;
        notes?: string;
      }[];
    };

    if (!name || !days || !exercises) {
      return NextResponse.json(
        { error: "Campos requeridos: name, days, exercises" },
        { status: 400 }
      );
    }

    const routine = await createRoutine(session.user.id, {
      name,
      days,
      exercises,
    });
    return NextResponse.json({ routine }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/fitness/routines]", err);
    return NextResponse.json({ error: "Error al crear rutina" }, { status: 500 });
  }
}

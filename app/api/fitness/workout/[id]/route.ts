// GET    /api/fitness/workout/[id]  — obtener workout con ejercicios
// PATCH  /api/fitness/workout/[id]  — actualizar duración / notas
// DELETE /api/fitness/workout/[id]  — eliminar workout

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { updateWorkout, deleteWorkout } from "@/lib/fitness";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const workout = await db.workout.findFirst({
      where: { id, userId: session.user.id },
      include: {
        exercises: {
          orderBy: { order: "asc" },
          include: { sets: { orderBy: { setNumber: "asc" } } },
        },
      },
    });

    if (!workout) {
      return NextResponse.json({ error: "Workout no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ workout });
  } catch (err) {
    console.error("[GET /api/fitness/workout/[id]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;

    // Verificar propiedad
    const existing = await db.workout.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Workout no encontrado" }, { status: 404 });
    }

    const body = await req.json();
    const workout = await updateWorkout(id, body);
    return NextResponse.json({ workout });
  } catch (err) {
    console.error("[PATCH /api/fitness/workout/[id]]", err);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;

    // Verificar propiedad
    const existing = await db.workout.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Workout no encontrado" }, { status: 404 });
    }

    await deleteWorkout(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/fitness/workout/[id]]", err);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}

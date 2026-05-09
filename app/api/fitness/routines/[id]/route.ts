// PATCH  /api/fitness/routines/[id]  — actualizar rutina
// DELETE /api/fitness/routines/[id]  — eliminar rutina

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { updateRoutine, deleteRoutine } from "@/lib/fitness";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await db.gymRoutine.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Rutina no encontrada" }, { status: 404 });
    }

    const body = await req.json();
    const routine = await updateRoutine(id, body);
    return NextResponse.json({ routine });
  } catch (err) {
    console.error("[PATCH /api/fitness/routines/[id]]", err);
    return NextResponse.json({ error: "Error al actualizar rutina" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await db.gymRoutine.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Rutina no encontrada" }, { status: 404 });
    }

    await deleteRoutine(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/fitness/routines/[id]]", err);
    return NextResponse.json({ error: "Error al eliminar rutina" }, { status: 500 });
  }
}

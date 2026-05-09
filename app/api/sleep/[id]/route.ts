// ============================================================
// DELETE /api/sleep/:id — Eliminar un registro de sueño
// PATCH  /api/sleep/:id — Actualizar notas de un registro
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteSleepLog } from "@/lib/sleep";
import { db } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await deleteSleepLog(session.user.id, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  // Verificar ownership
  const log = await db.sleepLog.findUnique({ where: { id } });
  if (!log || log.userId !== session.user.id) {
    return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
  }

  const updated = await db.sleepLog.update({
    where: { id },
    data: {
      notes: body.notes ?? log.notes,
      flexible: body.flexible ?? log.flexible,
    },
  });

  return NextResponse.json({ log: updated });
}

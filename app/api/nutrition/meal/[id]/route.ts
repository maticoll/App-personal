// ============================================================
// DELETE /api/nutrition/meal/[id]
// Eliminar comida por ID
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteMeal } from "@/lib/nutrition";

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
    await deleteMeal(session.user.id, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

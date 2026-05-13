// ============================================================
// GET    /api/ideas/[id]
// PATCH  /api/ideas/[id]  { title?, content?, tags?, priority?, status?, cycleStatus? }
// DELETE /api/ideas/[id]
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getIdea, updateIdea, deleteIdea, cycleIdeaStatus } from "@/lib/ideas";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const idea = await getIdea(session.user.id, id);

  if (!idea) {
    return NextResponse.json({ error: "Idea no encontrada" }, { status: 404 });
  }

  return NextResponse.json(idea);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { title, content, tags, priority, status, cycleStatus } = body;

  try {
    // Cycling rápido: solo avanza al siguiente estado
    if (cycleStatus === true) {
      const updated = await cycleIdeaStatus(session.user.id, id);
      return NextResponse.json(updated);
    }

    if (!title && !content && !tags && !priority && !status) {
      return NextResponse.json(
        { error: "Se requiere al menos un campo para actualizar" },
        { status: 400 }
      );
    }

    const updated = await updateIdea(session.user.id, id, {
      title,
      content,
      tags,
      priority,
      status,
    });
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await deleteIdea(session.user.id, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

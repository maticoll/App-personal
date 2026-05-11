import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createTask } from "@/lib/projects";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const { id: projectId } = await params;
    const body = await req.json();
    const { title } = body;
    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "Título requerido" }, { status: 400 });
    }
    const task = await createTask(projectId, session.user.id, title.trim());
    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/projects/[id]/tasks]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

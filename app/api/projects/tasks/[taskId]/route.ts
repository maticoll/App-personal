import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { updateTask, deleteTask } from "@/lib/projects";

type Params = { params: Promise<{ taskId: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const { taskId } = await params;
    const body = await req.json();
    const { done, title, order } = body;
    const task = await updateTask(session.user.id, taskId, {
      ...(done !== undefined && { done }),
      ...(title !== undefined && { title }),
      ...(order !== undefined && { order }),
    });
    return NextResponse.json({ task });
  } catch (err) {
    console.error("[PATCH /api/projects/tasks/[taskId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const { taskId } = await params;
    await deleteTask(session.user.id, taskId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/projects/tasks/[taskId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

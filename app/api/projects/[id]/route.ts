import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getProject, updateProject, deleteProject } from "@/lib/projects";
import { updateNotionProjectStatus } from "@/lib/notion";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const { id } = await params;
    const project = await getProject(session.user.id, id);
    if (!project) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ project });
  } catch (err) {
    console.error("[GET /api/projects/[id]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const { id } = await params;
    const body = await req.json();
    const { title, description, status, deadline, color, order } = body;
    const project = await updateProject(session.user.id, id, {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(status !== undefined && { status }),
      ...(deadline !== undefined && {
        deadline: deadline ? new Date(deadline) : null,
      }),
      ...(color !== undefined && { color }),
      ...(order !== undefined && { order }),
    });

    // Si el proyecto tiene notionId y cambió el status → sync a Notion (fire-and-forget)
    if (status !== undefined && project.notionId) {
      void updateNotionProjectStatus(session.user.id, project.notionId, status).catch(
        (err) => console.error("[projects] Error actualizando Notion:", err)
      );
    }

    return NextResponse.json({ project });
  } catch (err) {
    console.error("[PATCH /api/projects/[id]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const { id } = await params;
    await deleteProject(session.user.id, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/projects/[id]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

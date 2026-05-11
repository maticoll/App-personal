import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { reorderProjects } from "@/lib/projects";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const body = await req.json();
    const { projectIds } = body;
    if (!Array.isArray(projectIds)) {
      return NextResponse.json({ error: "projectIds debe ser un array" }, { status: 400 });
    }
    await reorderProjects(session.user.id, projectIds);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/projects/reorder]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { syncNotionToProjects } from "@/lib/notion";
import { cleanupOldDoneProjects } from "@/lib/projects";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // 1. Eliminar proyectos DONE de días anteriores antes de sincronizar
    const deleted = await cleanupOldDoneProjects(session.user.id);

    // 2. Sincronizar desde Notion
    const result = await syncNotionToProjects(session.user.id);

    return NextResponse.json({ result, deletedOldDone: deleted });
  } catch (err) {
    console.error("[POST /api/projects/sync-notion]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

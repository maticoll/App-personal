import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { syncNotionToProjects } from "@/lib/notion";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const result = await syncNotionToProjects(session.user.id);
    return NextResponse.json({ result });
  } catch (err) {
    console.error("[POST /api/projects/sync-notion]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

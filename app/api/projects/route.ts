import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAllProjects, createProject } from "@/lib/projects";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const projects = await getAllProjects(session.user.id);
    return NextResponse.json({ projects });
  } catch (err) {
    console.error("[GET /api/projects]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const body = await req.json();
    const { title, description, deadline, color } = body;
    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "Título requerido" }, { status: 400 });
    }
    const project = await createProject(session.user.id, {
      title: title.trim(),
      description: description?.trim(),
      deadline: deadline ? new Date(deadline) : undefined,
      color,
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/projects]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

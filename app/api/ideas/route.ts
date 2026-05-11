// ============================================================
// GET  /api/ideas?tag=&search=
// POST /api/ideas  { text: string }
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAllIdeas, captureIdeaNLP } from "@/lib/ideas";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const tag = searchParams.get("tag") ?? undefined;
  const search = searchParams.get("search") ?? undefined;

  const ideas = await getAllIdeas(session.user.id, { tag, search });
  return NextResponse.json({ ideas });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const { text } = body;

  if (!text || typeof text !== "string" || text.trim().length < 3) {
    return NextResponse.json(
      { error: "text inválido — mínimo 3 caracteres" },
      { status: 400 }
    );
  }

  const idea = await captureIdeaNLP(session.user.id, text.trim());
  return NextResponse.json(idea, { status: 201 });
}

// ============================================================
// POST /api/ideas/[id]/breakdown — genera/regenera el desglose IA
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateIdeaBreakdown } from "@/lib/ideas";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const updated = await generateIdeaBreakdown(session.user.id, id);
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    const status = message.includes("no encontrada") ? 404 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}

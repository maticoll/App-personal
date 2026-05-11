// ============================================================
// GET /api/ideas/stats
// Stats generales de ideas del usuario
// ============================================================

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getIdeasStats } from "@/lib/ideas";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const stats = await getIdeasStats(session.user.id);
  return NextResponse.json(stats);
}

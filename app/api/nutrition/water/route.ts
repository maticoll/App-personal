// ============================================================
// POST /api/nutrition/water
// Registrar consumo de agua
// Body: { thermos?: number } (default 1.0)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { logWater } from "@/lib/nutrition";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const thermos = typeof body.thermos === "number" ? body.thermos : 1.0;

  if (thermos <= 0 || thermos > 5) {
    return NextResponse.json(
      { error: "thermos debe estar entre 0 y 5" },
      { status: 400 }
    );
  }

  const result = await logWater(session.user.id, thermos);
  return NextResponse.json(result, { status: 201 });
}

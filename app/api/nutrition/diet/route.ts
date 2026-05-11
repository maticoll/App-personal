// ============================================================
// GET  /api/nutrition/diet — obtener dieta actual
// POST /api/nutrition/diet — actualizar dieta
// Body POST: { content: string }
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserDiet, updateUserDiet } from "@/lib/nutrition";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const diet = await getUserDiet(session.user.id);
  return NextResponse.json({ diet });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const { content } = body;

  if (!content || typeof content !== "string" || content.trim().length < 10) {
    return NextResponse.json(
      { error: "content inválido — mínimo 10 caracteres" },
      { status: 400 }
    );
  }

  const diet = await updateUserDiet(session.user.id, content.trim());
  return NextResponse.json({ diet });
}

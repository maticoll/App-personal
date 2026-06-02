import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSessionPrep } from "@/lib/fitness";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const routineId = req.nextUrl.searchParams.get("routineId");
    const prep = await getSessionPrep(session.user.id, routineId);
    return NextResponse.json(prep);
  } catch (err) {
    console.error("[GET /api/fitness/session/prep]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

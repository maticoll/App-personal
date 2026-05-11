import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getWeeklyStats } from "@/lib/projects";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const stats = await getWeeklyStats(session.user.id);
    return NextResponse.json({ stats });
  } catch (err) {
    console.error("[GET /api/projects/weekly-stats]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

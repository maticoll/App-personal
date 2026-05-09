import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getWeeklyStats } from "@/lib/fitness";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stats = await getWeeklyStats(session.user.id);
    return NextResponse.json({ stats });
  } catch (err) {
    console.error("[fitness/weekly-stats]", err);
    return NextResponse.json({ error: "Error al obtener estadísticas" }, { status: 500 });
  }
}

// ============================================================
// GET /api/sleep/today
// Sueño de hoy + registro pendiente (bedTime sin wakeTime)
// ============================================================

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTodaySleep, getPendingSleepLog } from "@/lib/sleep";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const userId = session.user.id;

  const [todaySleep, pendingLog] = await Promise.all([
    getTodaySleep(userId),
    getPendingSleepLog(userId),
  ]);

  return NextResponse.json({
    today: todaySleep,
    pending: pendingLog,
    // 'pending' es el registro activo donde ya está bedTime pero falta wakeTime
    // Si exists, el UI debe mostrar "Me desperté" prominentemente
    hasPending: !!pendingLog,
  });
}

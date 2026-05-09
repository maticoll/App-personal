// ============================================================
// GET /api/garmin/status
// Estado de la conexión con Garmin Connect
// ============================================================

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { checkGarminStatus } from "@/lib/garmin";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const status = await checkGarminStatus(session.user.id);
  return NextResponse.json(status);
}

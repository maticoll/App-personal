// ============================================================
// POST /api/sleep/sync-garmin
// Sync manual con Garmin Connect — últimos N días
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { syncGarminSleepRange, checkGarminStatus } from "@/lib/garmin";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const userId = session.user.id;
  const body = await req.json().catch(() => ({}));
  const days: number = Math.min(body.days ?? 7, 30); // máx 30 días por sync manual

  // Verificar que Garmin está configurado
  const status = await checkGarminStatus(userId);
  if (!status.connected) {
    return NextResponse.json(
      {
        error: status.error ?? "Garmin no está configurado",
        setup: "Configurá GARMIN_EMAIL y GARMIN_PASSWORD en .env.local",
      },
      { status: 503 }
    );
  }

  try {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);

    const result = await syncGarminSleepRange(userId, from, to);

    return NextResponse.json({
      success: true,
      ...result,
      message: `Sync completado: ${result.synced} registros importados, ${result.skipped} días sin datos, ${result.errors} errores`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error de sincronización";
    console.error("Garmin sync error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

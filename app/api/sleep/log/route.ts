// ============================================================
// POST /api/sleep/log
// Registrar bedTime o wakeTime (flujo de dos pasos), o log completo
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { logBedTime, logWakeTime, upsertSleepLog } from "@/lib/sleep";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const body = await req.json();
    const { action } = body as {
      action: "bed" | "wake" | "manual";
      time?: string;
      date?: string;
      bedTime?: string;
      wakeTime?: string;
      notes?: string;
      flexible?: boolean;
    };

    switch (action) {
      case "bed": {
        // Registrar hora de acostarse (ahora o time especificado)
        const bedTime = body.time ? new Date(body.time) : new Date();
        const log = await logBedTime(userId, bedTime, {
          notes: body.notes,
          flexible: body.flexible,
        });
        return NextResponse.json({ log });
      }

      case "wake": {
        // Registrar hora de despertar
        const wakeTime = body.time ? new Date(body.time) : new Date();
        const log = await logWakeTime(userId, wakeTime);
        return NextResponse.json({ log });
      }

      case "manual": {
        // Log completo para edición manual
        if (!body.bedTime) {
          return NextResponse.json(
            { error: "bedTime requerido para log manual" },
            { status: 400 }
          );
        }

        const log = await upsertSleepLog({
          userId,
          date: body.date ? new Date(body.date) : undefined,
          bedTime: new Date(body.bedTime),
          wakeTime: body.wakeTime ? new Date(body.wakeTime) : undefined,
          notes: body.notes,
          flexible: body.flexible,
        });
        return NextResponse.json({ log });
      }

      default:
        return NextResponse.json(
          { error: "action debe ser: bed | wake | manual" },
          { status: 400 }
        );
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

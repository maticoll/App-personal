// GET  /api/fitness/workout?days=14  — historial de workouts
// POST /api/fitness/workout          — registrar nueva actividad

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getWorkoutHistory, logActivity } from "@/lib/fitness";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const days = parseInt(req.nextUrl.searchParams.get("days") ?? "14", 10);
    const workouts = await getWorkoutHistory(session.user.id, days);
    return NextResponse.json({ workouts });
  } catch (err) {
    console.error("[GET /api/fitness/workout]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const {
      type,
      durationMinutes,
      distanceKm,
      calories,
      title,
      notes,
      date,
    } = body as {
      type: "GYM" | "RUNNING" | "SWIMMING" | "WALKING" | "CYCLING" | "OTHER";
      durationMinutes?: number;
      distanceKm?: number;
      calories?: number;
      title?: string;
      notes?: string;
      date?: string;
    };

    if (!type) {
      return NextResponse.json(
        { error: "El campo 'type' es requerido" },
        { status: 400 }
      );
    }

    const workout = await logActivity(session.user.id, {
      type,
      durationMinutes,
      distanceKm,
      calories,
      title,
      notes,
      date: date ? new Date(date) : undefined,
    });

    return NextResponse.json({ workout }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/fitness/workout]", err);
    return NextResponse.json({ error: "Error al registrar actividad" }, { status: 500 });
  }
}

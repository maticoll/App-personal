// GET /api/calendar/today — Eventos de hoy del usuario autenticado

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTodayEvents } from "@/lib/calendar";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const events = await getTodayEvents(session.user.id);

  return NextResponse.json({
    ok: true,
    events,
    count: events.length,
  });
}

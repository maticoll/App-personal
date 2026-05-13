// GET /api/calendar/week — Eventos de los próximos 7 días del usuario autenticado

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getWeekEvents } from "@/lib/calendar";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const events = await getWeekEvents(session.user.id);

  return NextResponse.json({
    ok: true,
    events,
    count: events.length,
  });
}

// POST /api/calendar/event — Crea un evento en Google Calendar

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createEvent } from "@/lib/calendar";

type CreateEventBody = {
  title: string;
  start: string; // ISO 8601
  end: string;   // ISO 8601
  description?: string;
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: CreateEventBody;
  try {
    body = (await req.json()) as CreateEventBody;
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const { title, start, end, description } = body;

  if (!title || !start || !end) {
    return NextResponse.json(
      { error: "Faltan campos requeridos: title, start, end" },
      { status: 400 }
    );
  }

  const startDate = new Date(start);
  const endDate = new Date(end);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return NextResponse.json(
      { error: "Formato de fecha inválido. Usar ISO 8601." },
      { status: 400 }
    );
  }

  if (endDate <= startDate) {
    return NextResponse.json(
      { error: "La fecha de fin debe ser posterior a la de inicio" },
      { status: 400 }
    );
  }

  const eventId = await createEvent(
    session.user.id,
    title,
    startDate,
    endDate,
    description
  );

  if (!eventId) {
    return NextResponse.json(
      {
        error:
          "No se pudo crear el evento. Verificá que Google Calendar esté conectado.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, eventId });
}

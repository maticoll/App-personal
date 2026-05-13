// ============================================================
// GET  /api/settings  — Obtiene la configuración del usuario
// PATCH /api/settings — Actualiza campos de UserSettings
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const settings = await db.userSettings.findUnique({
    where: { userId: session.user.id },
  });

  // Si no existe el registro, devolver valores por defecto
  if (!settings) {
    return NextResponse.json({
      ok: true,
      settings: {
        expectedSleepTime: null,
        expectedWakeTime: null,
        expectedGymTime: null,
        gymDays: [],
        dailyWaterGoalThermos: 1.0,
        notificationsEnabled: true,
        whatsappNumber: null,
        prefersDarkMode: true,
        language: "es",
        notionToken: null,
        notionDbId: null,
        garminSessionKey: null, // Solo para indicar si está conectado
      },
    });
  }

  return NextResponse.json({
    ok: true,
    settings: {
      expectedSleepTime: settings.expectedSleepTime,
      expectedWakeTime: settings.expectedWakeTime,
      expectedGymTime: settings.expectedGymTime,
      gymDays: settings.gymDays,
      dailyWaterGoalThermos: settings.dailyWaterGoalThermos,
      notificationsEnabled: settings.notificationsEnabled,
      whatsappNumber: settings.whatsappNumber,
      prefersDarkMode: settings.prefersDarkMode,
      language: settings.language,
      notionToken: settings.notionToken,
      notionDbId: settings.notionDbId,
      garminConnected: !!settings.garminSessionKey,
    },
  });
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

type PatchBody = Partial<{
  expectedSleepTime: string | null;
  expectedWakeTime: string | null;
  expectedGymTime: string | null;
  gymDays: string[];
  dailyWaterGoalThermos: number;
  notificationsEnabled: boolean;
  whatsappNumber: string | null;
  prefersDarkMode: boolean;
  language: string;
  notionToken: string | null;
  notionDbId: string | null;
}>;

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  // Solo permitir campos válidos de UserSettings
  const allowed: (keyof PatchBody)[] = [
    "expectedSleepTime",
    "expectedWakeTime",
    "expectedGymTime",
    "gymDays",
    "dailyWaterGoalThermos",
    "notificationsEnabled",
    "whatsappNumber",
    "prefersDarkMode",
    "language",
    "notionToken",
    "notionDbId",
  ];

  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) {
      data[key] = body[key];
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No hay campos válidos para actualizar" }, { status: 400 });
  }

  const updated = await db.userSettings.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      ...data,
    },
    update: data,
  });

  return NextResponse.json({ ok: true, settings: updated });
}

// ============================================================
// DELETE /api/settings/day-data
// Borra todos los datos del día de hoy del usuario autenticado.
// Módulos afectados: sueño, workouts, comidas, agua, score.
// Requiere confirmación explícita en el cuerpo: { confirm: true }
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { uyDayDate, startOfDayUY, endOfDayUY } from "@/lib/dates";

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // Requerir confirmación explícita para evitar borrados accidentales
  let body: { confirm?: boolean } = {};
  try {
    body = (await req.json()) as { confirm?: boolean };
  } catch {
    // Body vacío — sin confirmación
  }

  if (!body.confirm) {
    return NextResponse.json(
      {
        error: "Se requiere confirmación explícita: { confirm: true }",
        hint: "Esta acción borrará todos los datos del día de hoy de forma permanente.",
      },
      { status: 400 },
    );
  }

  const userId = session.user.id;

  // "Hoy" = día calendario URUGUAY — con setHours() del server (UTC), borrar
  // de noche eliminaba las keys del día siguiente (acción destructiva sobre
  // el día equivocado).
  const todayStart = startOfDayUY();
  const todayEnd = endOfDayUY();

  // Fecha de hoy como key para columnas @db.Date
  const todayDate = uyDayDate();

  let deleted = {
    sleep: 0,
    workouts: 0,
    meals: 0,
    water: 0,
    score: 0,
  };

  try {
    // 1. Sueño del día
    const sleepResult = await db.sleepLog.deleteMany({
      where: {
        userId,
        date: todayDate,
      },
    });
    deleted.sleep = sleepResult.count;

    // 2. Workouts del día (incluye exercises y sets por cascade)
    const workoutsResult = await db.workout.deleteMany({
      where: {
        userId,
        date: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    });
    deleted.workouts = workoutsResult.count;

    // 3. Comidas del día
    const mealsResult = await db.meal.deleteMany({
      where: {
        userId,
        date: todayDate,
      },
    });
    deleted.meals = mealsResult.count;

    // 4. Registros de agua del día
    const waterResult = await db.waterLog.deleteMany({
      where: {
        userId,
        date: todayDate,
      },
    });
    deleted.water = waterResult.count;

    // 5. Score del día
    const scoreResult = await db.dailyScore.deleteMany({
      where: {
        userId,
        date: todayDate,
      },
    });
    deleted.score = scoreResult.count;

    const totalDeleted = Object.values(deleted).reduce((a, b) => a + b, 0);

    return NextResponse.json({
      ok: true,
      message: `Datos del día borrados correctamente. ${totalDeleted} registros eliminados.`,
      deleted,
    });
  } catch (err) {
    console.error("[settings/day-data] Error borrando datos:", err);
    return NextResponse.json(
      { error: "Error interno borrando los datos del día" },
      { status: 500 },
    );
  }
}

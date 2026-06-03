// GET /api/fitness/garmin-raw?date=YYYY-MM-DD
// ⚠️ ENDPOINT TEMPORAL DE INSPECCIÓN — para ver qué datos crudos trae Garmin
// de cada actividad y diseñar las stats por actividad (Fase 2).
// Abrir en el navegador estando logueado en la app. Borrar cuando ya no se use.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getGarminSession } from "@/lib/garmin";

const GARMIN_CONNECT_URL = "https://connect.garmin.com";

const GARMIN_HEADERS = (session: string) => ({
  Cookie: session,
  NK: "NT",
  "User-Agent": "Mozilla/5.0",
  "DI-Backend": "connectapi.garmin.com",
  Accept: "application/json",
});

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const userId = session.user.id;

    const url = new URL(req.url);
    const date = url.searchParams.get("date"); // opcional
    const limit = url.searchParams.get("limit") ?? "10";

    const garminSession = await getGarminSession(userId);

    // 1) Lista de actividades. Sin ?date → trae las últimas N (evita problemas
    //    de zona horaria). Con ?date=YYYY-MM-DD → filtra por ese día.
    const listUrl =
      `${GARMIN_CONNECT_URL}/proxy/activitylist-service/activities/search/activities` +
      `?start=0&limit=${limit}` +
      (date ? `&startDate=${date}&endDate=${date}` : "");
    const listRes = await fetch(listUrl, { headers: GARMIN_HEADERS(garminSession) });

    if (!listRes.ok) {
      return NextResponse.json(
        { error: `Garmin list API ${listRes.status}`, date },
        { status: 502 }
      );
    }

    const list = await listRes.json();
    const activities = Array.isArray(list) ? list : [];

    // 2) Detalle por actividad (pulso, ritmo, desnivel, cadencia, etc.)
    const detailed = [];
    for (const act of activities) {
      const id = act?.activityId;
      let detail: unknown = null;
      if (id) {
        try {
          const detRes = await fetch(
            `${GARMIN_CONNECT_URL}/proxy/activity-service/activity/${id}`,
            { headers: GARMIN_HEADERS(garminSession) }
          );
          if (detRes.ok) detail = await detRes.json();
          else detail = { _error: `detail ${detRes.status}` };
        } catch (e) {
          detail = { _error: e instanceof Error ? e.message : "detail fetch failed" };
        }
      }
      detailed.push({
        activityId: id,
        activityName: act?.activityName,
        typeKey: act?.activityType?.typeKey,
        listItem: act, // crudo de la lista
        detail, // crudo del detalle
      });
      await new Promise((r) => setTimeout(r, 250)); // ser amable con Garmin
    }

    return NextResponse.json(
      { date, count: detailed.length, activities: detailed },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[GET /api/fitness/garmin-raw]", err);
    const message = err instanceof Error ? err.message : "Error inspeccionando Garmin";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

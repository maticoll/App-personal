// GET /api/fitness/garmin-raw
// ⚠️ ENDPOINT TEMPORAL DE INSPECCIÓN — muestra el JSON crudo de actividades de
// Garmin (vía connectapi + Bearer OAuth) para diseñar las stats por actividad.
// Params: ?limit=10  ?date=YYYY-MM-DD  ?full=1 (incluye detalle de la 1ª).
// Abrir logueado en la app. Borrar cuando ya no se use.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureGarminAccessToken } from "@/lib/garmin";

const CONNECTAPI = "https://connectapi.garmin.com";
const HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "User-Agent": "com.garmin.android.apps.connectmobile",
  Accept: "application/json",
  "DI-Backend": "connectapi.garmin.com",
});

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const userId = session.user.id;

    const url = new URL(req.url);
    const date = url.searchParams.get("date");
    const limit = url.searchParams.get("limit") ?? "10";
    const full = url.searchParams.get("full") === "1";

    const token = await ensureGarminAccessToken(userId);

    const listUrl =
      `${CONNECTAPI}/activitylist-service/activities/search/activities` +
      `?start=0&limit=${limit}` +
      (date ? `&startDate=${date}&endDate=${date}` : "");
    const listRes = await fetch(listUrl, { headers: HEADERS(token) });
    const listText = await listRes.text();

    let activities: unknown[] = [];
    try {
      const parsed = JSON.parse(listText);
      if (Array.isArray(parsed)) activities = parsed;
    } catch {
      /* no JSON */
    }

    // Detalle de la primera actividad (pulso, ritmo, desnivel, cadencia, etc.)
    let detailSample: unknown = null;
    if (full && activities.length > 0) {
      const id = (activities[0] as Record<string, unknown>)?.activityId;
      if (id) {
        try {
          const detRes = await fetch(`${CONNECTAPI}/activity-service/activity/${id}`, {
            headers: HEADERS(token),
          });
          detailSample = detRes.ok ? await detRes.json() : { _status: detRes.status };
        } catch (e) {
          detailSample = { _error: e instanceof Error ? e.message : "detail failed" };
        }
      }
    }

    return NextResponse.json(
      {
        listStatus: listRes.status,
        count: activities.length,
        bodySnippetIfNotArray: activities.length ? undefined : listText.slice(0, 400),
        activities,
        detailSample,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[GET /api/fitness/garmin-raw]", err);
    const message = err instanceof Error ? err.message : "Error inspeccionando Garmin";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/fitness/garmin-raw
// ⚠️ ENDPOINT TEMPORAL DE DIAGNÓSTICO — prueba varias URLs de Garmin para ver
// cuál devuelve las actividades y con qué shape. Abrir logueado en la app.
// Params opcionales: ?date=YYYY-MM-DD  ?limit=10  ?full=1 (incluye detalle)
// Borrar cuando ya no se use.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getGarminSession } from "@/lib/garmin";

const GARMIN_HEADERS = (session: string) => ({
  Cookie: session,
  NK: "NT",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "DI-Backend": "connectapi.garmin.com",
  Accept: "application/json",
  Referer: "https://connect.garmin.com/modern/activities",
  "X-Requested-With": "XMLHttpRequest",
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

    const garminSession = await getGarminSession(userId);

    const qs =
      `?start=0&limit=${limit}` +
      (date ? `&startDate=${date}&endDate=${date}` : "");

    // Variantes de URL a probar
    const candidates = [
      `https://connect.garmin.com/proxy/activitylist-service/activities/search/activities${qs}`,
      `https://connectapi.garmin.com/activitylist-service/activities/search/activities${qs}`,
      `https://connect.garmin.com/activitylist-service/activities/search/activities${qs}`,
      `https://connect.garmin.com/proxy/activitylist-service/activities/${qs}`,
    ];

    const attempts = [];
    let activities: unknown[] = [];
    let workingUrl: string | null = null;

    for (const candidate of candidates) {
      try {
        const res = await fetch(candidate, { headers: GARMIN_HEADERS(garminSession) });
        const contentType = res.headers.get("content-type") ?? "";
        const text = await res.text();
        let parsed: unknown = null;
        let isArray = false;
        let arrayLen = 0;
        try {
          parsed = JSON.parse(text);
          isArray = Array.isArray(parsed);
          if (isArray) arrayLen = (parsed as unknown[]).length;
        } catch {
          /* no JSON */
        }
        attempts.push({
          url: candidate,
          status: res.status,
          contentType,
          isJsonArray: isArray,
          arrayLen,
          // primeros 400 chars del cuerpo (para ver HTML/redirect/objeto)
          bodySnippet: text.slice(0, 400),
        });
        if (isArray && arrayLen > 0 && !workingUrl) {
          activities = parsed as unknown[];
          workingUrl = candidate;
        }
      } catch (e) {
        attempts.push({
          url: candidate,
          error: e instanceof Error ? e.message : "fetch failed",
        });
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    // Si pediste ?full=1 y encontramos actividades, traemos el detalle de la 1ª
    let detailSample: unknown = null;
    if (full && workingUrl && activities.length > 0) {
      const id = (activities[0] as Record<string, unknown>)?.activityId;
      if (id) {
        const host = workingUrl.includes("connectapi.garmin.com")
          ? "https://connectapi.garmin.com"
          : workingUrl.includes("/proxy/")
            ? "https://connect.garmin.com/proxy"
            : "https://connect.garmin.com";
        try {
          const detRes = await fetch(`${host}/activity-service/activity/${id}`, {
            headers: GARMIN_HEADERS(garminSession),
          });
          detailSample = detRes.ok ? await detRes.json() : { _status: detRes.status };
        } catch (e) {
          detailSample = { _error: e instanceof Error ? e.message : "detail failed" };
        }
      }
    }

    return NextResponse.json(
      {
        sessionChars: garminSession.length,
        workingUrl,
        foundActivities: activities.length,
        attempts,
        activities: workingUrl ? activities : [],
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

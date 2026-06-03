// GET /api/fitness/garmin-raw
// ⚠️ ENDPOINT TEMPORAL DE DIAGNÓSTICO — prueba qué endpoints de Garmin responden
// con la cookie de sesión actual (perfil, pasos, actividades). Abrir logueado.
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
  Referer: "https://connect.garmin.com/modern/",
  "X-Requested-With": "XMLHttpRequest",
});

async function probe(label: string, url: string, headers: Record<string, string>) {
  try {
    const res = await fetch(url, { headers });
    const contentType = res.headers.get("content-type") ?? "";
    const text = await res.text();
    return {
      label,
      url,
      status: res.status,
      contentType,
      bodySnippet: text.slice(0, 500),
    };
  } catch (e) {
    return { label, url, error: e instanceof Error ? e.message : "fetch failed" };
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const userId = session.user.id;
    const garminSession = await getGarminSession(userId);
    const H = GARMIN_HEADERS(garminSession);

    const today = new Date().toISOString().split("T")[0];
    const C = "https://connect.garmin.com";

    const results = [];

    // 1) Perfil social (de acá sale el displayName; lo usa checkGarminStatus)
    const profile = await probe("socialProfile", `${C}/proxy/userprofile-service/socialProfile`, H);
    results.push(profile);

    // Intentar extraer displayName para los siguientes
    let displayName: string | null = null;
    try {
      const pj = JSON.parse((profile as { bodySnippet?: string }).bodySnippet ?? "{}");
      displayName = pj.displayName ?? pj.userName ?? null;
    } catch {
      /* noop */
    }

    // 2) Pasos diarios (lo que hoy sync usa)
    if (displayName) {
      results.push(
        await probe(
          "usersummary-steps",
          `${C}/proxy/usersummary-service/usersummary/daily/${displayName}?calendarDate=${today}`,
          H
        )
      );
    } else {
      results.push({ label: "usersummary-steps", skipped: "sin displayName" });
    }

    // 3) Actividades (las 3 variantes relevantes)
    results.push(
      await probe(
        "activities-proxy",
        `${C}/proxy/activitylist-service/activities/search/activities?start=0&limit=10`,
        H
      )
    );
    results.push(
      await probe(
        "activities-connectapi",
        `https://connectapi.garmin.com/activitylist-service/activities/search/activities?start=0&limit=10`,
        H
      )
    );

    return NextResponse.json(
      { sessionChars: garminSession.length, displayName, today, results },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[GET /api/fitness/garmin-raw]", err);
    const message = err instanceof Error ? err.message : "Error inspeccionando Garmin";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

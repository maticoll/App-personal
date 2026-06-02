// GET /api/finances/diagnose
// Endpoint de diagnóstico: hace una llamada cruda a la API de finanzas y reporta
// exactamente qué devuelve (status, content-type, snippet, cantidad de tarjetas).
// Sirve para saber por qué "no hay tarjetas" sin tener que mirar los logs.
// NO expone la API key.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFinancesApiKey } from "@/lib/finances";

const FINANCES_URL =
  process.env.FINANCES_APP_URL ?? "https://finanzas-lemon.vercel.app";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const apiKey = await getFinancesApiKey(session.user.id);
  if (!apiKey) {
    return NextResponse.json({
      hasApiKey: false,
      hint: "No hay API key configurada (ni en Ajustes ni en env FINANCES_API_KEY).",
    });
  }

  const url = `${FINANCES_URL}/api/cards`;
  let result: Record<string, unknown> = {
    hasApiKey: true,
    apiKeyPreview: apiKey.slice(0, 6) + "…",
    url,
  };

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    const contentType = res.headers.get("content-type") ?? "";
    const text = await res.text();
    const isJson = contentType.includes("application/json");

    let cardCount: number | null = null;
    let parseError: string | null = null;
    if (isJson) {
      try {
        const data = JSON.parse(text) as unknown;
        const cards = Array.isArray(data)
          ? data
          : (data as { cards?: unknown[] }).cards ?? [];
        cardCount = Array.isArray(cards) ? cards.length : null;
      } catch (e) {
        parseError = e instanceof Error ? e.message : String(e);
      }
    }

    result = {
      ...result,
      status: res.status,
      ok: res.ok,
      contentType,
      isJson,
      cardCount,
      parseError,
      bodyPreview: text.slice(0, 400),
    };
  } catch (err) {
    result = {
      ...result,
      fetchError: err instanceof Error ? err.message : String(err),
    };
  }

  return NextResponse.json(result);
}

// GET /api/finances/diagnose
// Diagnóstico: prueba VARIAS formas de autenticación contra /api/cards de la
// app de finanzas y reporta cuál devuelve JSON. Sirve para descubrir cómo
// espera la API key (Bearer, x-api-key, query param, etc.). Read-only.
// NO expone la API key completa.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFinancesApiKey } from "@/lib/finances";

const FINANCES_URL =
  process.env.FINANCES_APP_URL ?? "https://finanzas-lemon.vercel.app";

type Attempt = {
  label: string;
  url: string;
  headers: Record<string, string>;
};

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

  const base = `${FINANCES_URL}/api/cards`;
  const attempts: Attempt[] = [
    { label: "Authorization: Bearer", url: base, headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" } },
    { label: "Authorization: raw (sin Bearer)", url: base, headers: { Authorization: apiKey, Accept: "application/json" } },
    { label: "x-api-key header", url: base, headers: { "x-api-key": apiKey, Accept: "application/json" } },
    { label: "api-key header", url: base, headers: { "api-key": apiKey, Accept: "application/json" } },
    { label: "query ?apiKey", url: `${base}?apiKey=${encodeURIComponent(apiKey)}`, headers: { Accept: "application/json" } },
    { label: "query ?api_key", url: `${base}?api_key=${encodeURIComponent(apiKey)}`, headers: { Accept: "application/json" } },
    { label: "query ?key", url: `${base}?key=${encodeURIComponent(apiKey)}`, headers: { Accept: "application/json" } },
    { label: "query ?token", url: `${base}?token=${encodeURIComponent(apiKey)}`, headers: { Accept: "application/json" } },
  ];

  const results = [];
  for (const a of attempts) {
    try {
      const res = await fetch(a.url, { headers: a.headers });
      const contentType = res.headers.get("content-type") ?? "";
      const text = await res.text();
      const isJson = contentType.includes("application/json");
      let cardCount: number | null = null;
      if (isJson) {
        try {
          const data = JSON.parse(text) as unknown;
          const cards = Array.isArray(data) ? data : (data as { cards?: unknown[] }).cards ?? [];
          cardCount = Array.isArray(cards) ? cards.length : null;
        } catch {
          /* no-op */
        }
      }
      results.push({
        attempt: a.label,
        status: res.status,
        contentType,
        isJson,
        cardCount,
        bodyPreview: text.slice(0, 120).replace(/\s+/g, " "),
      });
    } catch (err) {
      results.push({
        attempt: a.label,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const winner = results.find((r) => "isJson" in r && r.isJson);

  return NextResponse.json({
    hasApiKey: true,
    apiKeyPreview: apiKey.slice(0, 6) + "…",
    base,
    winner: winner ? winner.attempt : null,
    hint: winner
      ? `Usá este método de auth: ${winner.attempt}`
      : "Ningún método devolvió JSON. La API quizás exige sesión por cookie, o la key es inválida.",
    results,
  });
}

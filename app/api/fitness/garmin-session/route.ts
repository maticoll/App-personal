// POST /api/fitness/garmin-session
// Inyecta una sesión de Garmin obtenida desde una IP residencial (script local),
// porque el login SSO de Garmin está bloqueado por Cloudflare desde Vercel.
//
// Auth (una de dos):
//   - Sesión NextAuth (si lo llamás logueado desde la app), o
//   - ?secret=CRON_SECRET + { email } en el body (para el script local automatizado).
//
// Body: { session: string, ttlHours?: number, email?: string }
//   - session  → string de cookies de Garmin (ej "GARMIN-SSO-GUID=...; SESSIONID=...")
//   - ttlHours → vida de la sesión en horas (default 20)
//   - email    → solo requerido en el modo ?secret (para resolver el userId)

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { verifyCronSecret } from "@/lib/cron";
import { saveGarminSession } from "@/lib/garmin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const sessionCookie = typeof body.session === "string" ? body.session.trim() : "";
    const ttlHours = Number.isFinite(body.ttlHours) ? Number(body.ttlHours) : 20;

    if (!sessionCookie) {
      return NextResponse.json(
        { error: "Falta 'session' (string de cookies de Garmin) en el body" },
        { status: 400 }
      );
    }

    // Sanity check: que parezca una sesión de Garmin válida
    if (
      !sessionCookie.includes("GARMIN-SSO") &&
      !sessionCookie.includes("SESSIONID") &&
      !sessionCookie.includes("connect.garmin")
    ) {
      return NextResponse.json(
        { error: "El string de sesión no parece de Garmin (sin GARMIN-SSO/SESSIONID)" },
        { status: 400 }
      );
    }

    // Resolver userId: por sesión NextAuth o por secret + email
    let userId: string | null = null;

    const authSession = await auth();
    if (authSession?.user?.id) {
      userId = authSession.user.id;
    } else if (verifyCronSecret(req)) {
      const email = typeof body.email === "string" ? body.email.trim() : "";
      if (!email) {
        return NextResponse.json(
          { error: "En modo ?secret hay que pasar 'email' en el body para resolver el usuario" },
          { status: 400 }
        );
      }
      const user = await db.user.findUnique({ where: { email } });
      if (!user) {
        return NextResponse.json(
          { error: `No existe un usuario con email ${email}` },
          { status: 404 }
        );
      }
      userId = user.id;
    }

    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const ttlMs = Math.max(1, ttlHours) * 60 * 60 * 1000;
    await saveGarminSession(userId, sessionCookie, ttlMs);

    return NextResponse.json({
      success: true,
      expiresInHours: Math.round(ttlHours),
      message: "Sesión de Garmin inyectada correctamente",
    });
  } catch (err) {
    console.error("[POST /api/fitness/garmin-session]", err);
    const message =
      err instanceof Error ? err.message : "Error al inyectar la sesión de Garmin";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/fitness/garmin-session
// Inyecta los tokens OAuth de Garmin obtenidos desde una IP residencial (script
// local), porque el login SSO de Garmin está bloqueado por Cloudflare desde Vercel.
//
// Auth (una de dos):
//   - Sesión NextAuth (si lo llamás logueado desde la app), o
//   - ?secret=CRON_SECRET + { email } en el body (para el script local automatizado).
//
// Body: { oauth1Token, oauth1Secret, oauth2Token?, oauth2ExpiresInSec?, email? }

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { verifyCronSecret } from "@/lib/cron";
import { saveGarminOAuth } from "@/lib/garmin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const oauth1Token = typeof body.oauth1Token === "string" ? body.oauth1Token.trim() : "";
    const oauth1Secret = typeof body.oauth1Secret === "string" ? body.oauth1Secret.trim() : "";
    const oauth2Token = typeof body.oauth2Token === "string" ? body.oauth2Token.trim() : "";
    const oauth2ExpiresInSec = Number.isFinite(body.oauth2ExpiresInSec)
      ? Number(body.oauth2ExpiresInSec)
      : null;

    if (!oauth1Token || !oauth1Secret) {
      return NextResponse.json(
        { error: "Faltan oauth1Token / oauth1Secret en el body" },
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

    const oauth2Exp =
      oauth2Token && oauth2ExpiresInSec
        ? new Date(Date.now() + oauth2ExpiresInSec * 1000)
        : undefined;

    await saveGarminOAuth(userId, {
      oauth1Token,
      oauth1Secret,
      oauth2Token: oauth2Token || undefined,
      oauth2Exp,
    });

    return NextResponse.json({
      success: true,
      message: "Tokens OAuth de Garmin guardados. La app ya puede leer datos desde Vercel.",
    });
  } catch (err) {
    console.error("[POST /api/fitness/garmin-session]", err);
    const message =
      err instanceof Error ? err.message : "Error al guardar los tokens de Garmin";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

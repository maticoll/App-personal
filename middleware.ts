// ============================================================
// Middleware - Edge-compatible, usa auth.config.ts (sin Prisma)
// PrismaClient no puede correr en Edge Runtime - por eso se
// separa la config base del auth completo con adapter.
// ============================================================

import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  const isPublicRoute =
    nextUrl.pathname.startsWith("/login") ||
    nextUrl.pathname.startsWith("/privacy") ||
    nextUrl.pathname.startsWith("/terms");
  const isApiAuthRoute = nextUrl.pathname.startsWith("/api/auth");
  const isApiWebhook = nextUrl.pathname.startsWith("/api/webhooks");
  const isWhatsAppWebhook = nextUrl.pathname.startsWith("/api/whatsapp/webhook");
  const isCronRoute = nextUrl.pathname.startsWith("/api/cron");
  // Inyección de sesión de Garmin: valida ?secret=CRON_SECRET o sesión NextAuth
  // dentro del propio handler, por eso se excluye del middleware (igual que crons).
  const isGarminSessionRoute = nextUrl.pathname.startsWith("/api/fitness/garmin-session");

  // Dejar pasar rutas de auth, webhooks publicos, crons e inyección de sesión Garmin
  if (isApiAuthRoute || isApiWebhook || isWhatsAppWebhook || isCronRoute || isGarminSessionRoute) {
    return undefined;
  }

  // Redirigir a login si no esta autenticado
  if (!isLoggedIn && !isPublicRoute) {
    return Response.redirect(new URL("/login", nextUrl));
  }

  // Si ya esta autenticado y va a /login, redirigir al dashboard
  // (solo /login — las páginas legales se pueden leer logueado)
  if (isLoggedIn && nextUrl.pathname.startsWith("/login")) {
    return Response.redirect(new URL("/", nextUrl));
  }

  return undefined;
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox-.*).*)",
  ],
};

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

  const isPublicRoute = nextUrl.pathname.startsWith("/login");
  const isApiAuthRoute = nextUrl.pathname.startsWith("/api/auth");
  const isApiWebhook = nextUrl.pathname.startsWith("/api/webhooks");
  const isWhatsAppWebhook = nextUrl.pathname.startsWith("/api/whatsapp/webhook");
  const isCronRoute = nextUrl.pathname.startsWith("/api/cron");

  // Dejar pasar rutas de auth, webhooks publicos y crons
  if (isApiAuthRoute || isApiWebhook || isWhatsAppWebhook || isCronRoute) {
    return undefined;
  }

  // Redirigir a login si no esta autenticado
  if (!isLoggedIn && !isPublicRoute) {
    return Response.redirect(new URL("/login", nextUrl));
  }

  // Si ya esta autenticado y va a /login, redirigir al dashboard
  if (isLoggedIn && isPublicRoute) {
    return Response.redirect(new URL("/", nextUrl));
  }

  return undefined;
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox-.*).*)",
  ],
};

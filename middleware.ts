// ============================================================
// Middleware — Protección de rutas con NextAuth v5
// Todas las rutas excepto /login requieren autenticación
// ============================================================

import { auth } from "@/auth";

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  const isPublicRoute = nextUrl.pathname.startsWith("/login");
  const isApiAuthRoute = nextUrl.pathname.startsWith("/api/auth");
  const isApiWebhook = nextUrl.pathname.startsWith("/api/webhooks");

  // Dejar pasar rutas de auth y webhooks públicos
  if (isApiAuthRoute || isApiWebhook) {
    return undefined;
  }

  // Redirigir a login si no está autenticado
  if (!isLoggedIn && !isPublicRoute) {
    return Response.redirect(new URL("/login", nextUrl));
  }

  // Si ya está autenticado y va a /login, redirigir al dashboard
  if (isLoggedIn && isPublicRoute) {
    return Response.redirect(new URL("/", nextUrl));
  }

  return undefined;
});

export const config = {
  matcher: [
    // Excluir archivos estáticos y PWA assets
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox-.*).*)",
  ],
};

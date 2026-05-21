// ============================================================
// auth.config.ts — Configuración edge-compatible de NextAuth v5
// NO importa Prisma — puede correr en Edge Runtime (middleware)
// El auth.ts completo (con PrismaAdapter) se usa en el servidor
// ============================================================

import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

export const authConfig = {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      authorization: {
        params: {
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/calendar.readonly",
            "https://www.googleapis.com/auth/calendar.events",
          ].join(" "),
          access_type: "offline",  // Necesario para obtener refresh_token
          prompt: "consent",       // Fuerza el consent para siempre recibir refresh_token
        },
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    // Permitir solo los emails configurados en ALLOWED_EMAILS (separados por coma)
    // Ejemplo: ALLOWED_EMAILS="usuario1@gmail.com,usuario2@gmail.com"
    signIn({ user }) {
      const allowedEmails = process.env.ALLOWED_EMAILS
        ?.split(",")
        .map((e) => e.trim())
        .filter(Boolean) ?? [];
      if (allowedEmails.length > 0 && !allowedEmails.includes(user.email ?? "")) {
        return false;
      }
      return true;
    },
    // Enriquecer la sesión con el ID del usuario
    session({ session, user }) {
      if (session.user && user?.id) {
        session.user.id = user.id;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

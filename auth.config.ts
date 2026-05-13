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
    // Solo permitir al usuario propietario
    signIn({ user }) {
      const allowedEmail = process.env.ALLOWED_EMAIL;
      if (allowedEmail && user.email !== allowedEmail) {
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

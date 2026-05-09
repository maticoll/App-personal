// ============================================================
// NextAuth v5 — Configuración de autenticación
// Usa Google como proveedor principal
// @auth/prisma-adapter para persistir sesiones en Supabase
// ============================================================

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      // Scopes para Google Calendar (Sesión 7)
      authorization: {
        params: {
          scope: [
            "openid",
            "email",
            "profile",
            // TODO: Sesión 7 — agregar scopes de Calendar y Gmail
            // "https://www.googleapis.com/auth/calendar",
            // "https://www.googleapis.com/auth/gmail.readonly",
          ].join(" "),
        },
      },
    }),
  ],
  session: {
    strategy: "database",
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    // Enriquecer la sesión con el ID del usuario de Prisma
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
    // Solo permitir al usuario propietario (app personal, un solo usuario)
    signIn({ user }) {
      const allowedEmail = process.env.ALLOWED_EMAIL;
      if (allowedEmail && user.email !== allowedEmail) {
        return false;
      }
      return true;
    },
  },
});

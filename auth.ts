// ============================================================
// auth.ts — NextAuth v5 completo con PrismaAdapter
// Solo se importa desde Server Components y API Routes
// El middleware usa auth.config.ts (edge-compatible, sin Prisma)
// ============================================================

import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  session: {
    strategy: "jwt", // JWT para que el middleware (Edge) pueda leer la sesión sin Prisma
  },
  callbacks: {
    ...authConfig.callbacks,
    // Con JWT strategy, el user.id viene del token, no del adapter
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
      }

      // Cada vez que el usuario inicia sesión con Google, actualizamos los tokens
      // en la DB. Con strategy: "jwt", PrismaAdapter solo crea el registro la
      // primera vez (linkAccount no hace update), por lo que sin esto los tokens
      // viejos (sin scopes de Calendar) persisten indefinidamente.
      //
      // IMPORTANTE: hay que AWAITear la escritura. En serverless (Vercel), si el
      // callback retorna antes de que termine el update, la promesa pendiente se
      // descarta y el refresh_token nuevo nunca se persiste — esa era la causa de
      // que reconectar Google no reemplazara el token muerto.
      if (account && token.id && account.provider === "google") {
        try {
          await db.account.updateMany({
            where: { userId: token.id as string, provider: "google" },
            data: {
              access_token: account.access_token,
              refresh_token: account.refresh_token ?? undefined,
              expires_at: account.expires_at ?? undefined,
              scope: account.scope ?? undefined,
            },
          });
        } catch (err) {
          console.error("[auth] Error actualizando tokens de Google:", err);
        }
      }

      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});

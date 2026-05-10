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
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
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

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
    strategy: "database",
  },
});

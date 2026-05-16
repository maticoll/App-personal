// ============================================================
// Login Page — Pantalla de autenticación
// Usa Google OAuth a través de NextAuth v5
// ============================================================

import { signIn } from "@/auth";
import { Chrome } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center text-white font-bold text-2xl mb-4 shadow-lg shadow-indigo-500/25">
            C
          </div>
          <h1 className="text-2xl font-bold text-on-surface">CLAUDIO</h1>
          <p className="text-on-surface-variant text-sm mt-1">
            Tu vida, centralizada.
          </p>
        </div>

        {/* Card de login */}
        <div className="card">
          <h2 className="text-lg font-semibold text-on-surface mb-1">
            Bienvenido
          </h2>
          <p className="text-sm text-on-surface-variant mb-6">
            Ingresá con tu cuenta de Google para acceder al dashboard.
          </p>

          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-outline-variant/20 bg-surface-container-high hover:bg-surface-container-highest transition-colors text-on-surface font-medium text-sm"
            >
              <Chrome className="w-5 h-5 text-[#4285F4]" />
              Continuar con Google
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-outline mt-6">
          App personal de uso privado
        </p>
      </div>
    </div>
  );
}

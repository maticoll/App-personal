// ============================================================
// Login Page — Pantalla de autenticación
// Usa Google OAuth a través de NextAuth v5
// ============================================================

import { signIn } from "@/auth";
import { Chrome } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center text-white font-bold text-2xl mb-4 shadow-lg shadow-indigo-500/25">
            A
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">App Personal</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">
            Tu vida, centralizada.
          </p>
        </div>

        {/* Card de login */}
        <div className="card">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
            Bienvenido
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-6">
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
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] hover:bg-[var(--border)] transition-colors text-[var(--text-primary)] font-medium text-sm"
            >
              <Chrome className="w-5 h-5 text-[#4285F4]" />
              Continuar con Google
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[var(--text-muted)] mt-6">
          App personal de uso privado
        </p>
      </div>
    </div>
  );
}

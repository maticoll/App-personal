// ============================================================
// Módulo de Finanzas — /finances
// TODO: Sesión 7 — integrar app de finanzas existente (Next.js/Neon)
// ============================================================

import { Wallet } from "lucide-react";

export default function FinancesPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Wallet className="w-5 h-5 text-module-finances" />
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Finanzas</h2>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          App de finanzas integrada
        </p>
      </div>

      {/* Placeholder — TODO: Sesión 7 */}
      <div className="card text-center py-12">
        <Wallet className="w-12 h-12 text-module-finances mx-auto mb-4 opacity-40" />
        <p className="font-medium text-[var(--text-primary)]">Módulo en construcción</p>
        <p className="text-sm text-[var(--text-muted)] mt-1">Se integra en la Sesión 7</p>
      </div>

      {/* TODO: Sesión 7
        - Integrar la app de finanzas existente (Next.js + Neon + Prisma)
        - Tarjetas, transacciones, categorías, balances mensuales
        - Recharts para reportes
        - Alertas proactivas de gasto desde el Agente de Finanzas
      */}
    </div>
  );
}

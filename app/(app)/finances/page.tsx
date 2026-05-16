// ============================================================
// Módulo de Finanzas — /finances
// Server Component: carga el dashboard desde la API de finanzas
// Pasa datos iniciales a FinancesModuleClient
// ============================================================

import { Wallet } from "lucide-react";
import { auth } from "@/auth";
import { getFinancesDashboard } from "@/lib/finances";
import { FinancesModuleClient } from "@/components/finances/FinancesModuleClient";

export default async function FinancesPage() {
  const session = await auth();

  if (!session?.user?.id) return null;

  // Carga inicial — si falla, el cliente puede re-intentar con el botón refresh
  const dashboard = await getFinancesDashboard(session.user.id).catch(() => ({
    report: null,
    recentTransactions: [],
    balances: [],
    connected: false,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Wallet className="w-5 h-5 text-module-finances" />
          <h2 className="text-xl font-bold text-on-surface">Finanzas</h2>
        </div>
        <p className="text-sm text-on-surface-variant">
          Resumen del mes — integrado con tu app de finanzas
        </p>
      </div>

      {/* Módulo cliente */}
      <FinancesModuleClient
        connected={dashboard.connected}
        report={dashboard.report}
        recentTransactions={dashboard.recentTransactions}
        balances={dashboard.balances}
      />
    </div>
  );
}

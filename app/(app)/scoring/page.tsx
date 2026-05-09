// ============================================================
// Historial de Scoring — /scoring
// Sesión 2 — Gráficos + vistas diario/semanal/mensual
// ============================================================

import { auth } from "@/auth";
import { BarChart3 } from "lucide-react";
import { ScoringHistoryClient } from "@/components/scoring/ScoringHistoryClient";
import { getScoreHistory, generateMockHistory } from "@/lib/scoring";

export default async function ScoringPage() {
  const session = await auth();
  const userId = session?.user?.id;

  // Cargar datos de las últimas 8 semanas (56 días) por defecto
  const from = new Date();
  from.setDate(from.getDate() - 55);
  from.setHours(0, 0, 0, 0);

  const to = new Date();
  to.setHours(23, 59, 59, 999);

  let historyData = userId
    ? await getScoreHistory(userId, from, to).catch(() => [])
    : [];

  let isMock = false;

  // Si no hay datos, usar mock para mostrar la UI correctamente
  if (historyData.length === 0) {
    historyData = generateMockHistory(56);
    isMock = true;
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 className="w-5 h-5 text-module-scoring" />
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Scoring</h2>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          Evolución de tu progreso diario
        </p>
        {isMock && (
          <p className="text-xs text-[var(--text-muted)] mt-1">
            * Datos de ejemplo — registrá actividades para ver tus scores reales
          </p>
        )}
      </div>

      {/* Componente client con selector de período + gráficos */}
      <ScoringHistoryClient initialData={historyData} isMock={isMock} />

    </div>
  );
}

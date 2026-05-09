// ============================================================
// Módulo de Nutrición — /nutrition
// TODO: Sesión 5 — implementar UI completa
// ============================================================

import { Salad } from "lucide-react";

export default function NutritionPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Salad className="w-5 h-5 text-module-nutrition" />
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Nutrición</h2>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          Comidas, macros e hidratación
        </p>
      </div>

      {/* Placeholder — TODO: Sesión 5 */}
      <div className="card text-center py-12">
        <Salad className="w-12 h-12 text-module-nutrition mx-auto mb-4 opacity-40" />
        <p className="font-medium text-[var(--text-primary)]">Módulo en construcción</p>
        <p className="text-sm text-[var(--text-muted)] mt-1">Se implementa en la Sesión 5</p>
      </div>

      {/* TODO: Sesión 5
        - MealLogList: comidas registradas hoy
        - MacrosSummaryCard: calorías + macros del día
        - WaterTrackerCard: termos tomados vs meta
        - DietAlignmentScore: qué tan alineado con la dieta
      */}
    </div>
  );
}

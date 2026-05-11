// ============================================================
// Módulo de Nutrición — /nutrition
// Server Component — carga datos iniciales en paralelo
// Sesión 5 — implementado
// ============================================================

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Salad } from "lucide-react";
import {
  getTodayNutritionSummary,
  getMealHistory,
  getUserDiet,
  getWeeklyNutritionStats,
} from "@/lib/nutrition";
import NutritionModuleClient from "@/components/nutrition/NutritionModuleClient";

export default async function NutritionPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  // Carga paralela de todos los datos iniciales
  const [summary, history, diet, weeklyStats] = await Promise.all([
    getTodayNutritionSummary(userId).catch(() => ({
      meals: [],
      totalWaterThermos: 0,
      waterGoalThermos: 1.0,
      totalCalories: null,
      totalProteinG: null,
      totalCarbsG: null,
      totalFatG: null,
      hasAllMainMeals: false,
    })),
    getMealHistory(userId, 14).catch(() => []),
    getUserDiet(userId).catch(() => null),
    getWeeklyNutritionStats(userId).catch(() => ({
      avgCalories: null,
      avgWaterThermos: 0,
      daysWithAllMeals: 0,
      totalMealsLogged: 0,
    })),
  ]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Salad className="w-5 h-5 text-module-nutrition" />
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Nutrición</h2>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          Comidas, macros e hidratación
        </p>
      </div>

      {/* Client wrapper con toda la interactividad */}
      <NutritionModuleClient
        initialSummary={summary}
        initialHistory={history}
        initialDiet={diet}
        initialWeeklyStats={weeklyStats}
      />
    </div>
  );
}

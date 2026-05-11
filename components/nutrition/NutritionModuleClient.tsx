"use client";

import { useState, useCallback } from "react";
import type {
  NutritionSummary,
  DayNutrition,
  DietInfo,
  WeeklyNutritionStats,
} from "@/lib/nutrition";

import MealLogCard from "./MealLogCard";
import MacrosChart from "./MacrosChart";
import WaterTracker from "./WaterTracker";
import NutritionQuickActions from "./NutritionQuickActions";
import MealHistoryList from "./MealHistoryList";
import NutritionWeekStats from "./NutritionWeekStats";
import DietCard from "./DietCard";

type Tab = "hoy" | "stats" | "dieta";

type Props = {
  initialSummary: NutritionSummary;
  initialHistory: DayNutrition[];
  initialDiet: DietInfo;
  initialWeeklyStats: WeeklyNutritionStats;
};

export default function NutritionModuleClient({
  initialSummary,
  initialHistory,
  initialDiet,
  initialWeeklyStats,
}: Props) {
  const [tab, setTab] = useState<Tab>("hoy");
  const [summary, setSummary] = useState<NutritionSummary>(initialSummary);
  const [history, setHistory] = useState<DayNutrition[]>(initialHistory);
  const [diet, setDiet] = useState<DietInfo>(initialDiet);
  const [weeklyStats, setWeeklyStats] =
    useState<WeeklyNutritionStats>(initialWeeklyStats);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [todayRes, historyRes, statsRes, dietRes] = await Promise.all([
        fetch("/api/nutrition/today"),
        fetch("/api/nutrition/history?days=14"),
        fetch("/api/nutrition/weekly-stats"),
        fetch("/api/nutrition/diet"),
      ]);

      if (todayRes.ok) setSummary(await todayRes.json());
      if (historyRes.ok) {
        const d = await historyRes.json();
        setHistory(d.history ?? []);
      }
      if (statsRes.ok) setWeeklyStats(await statsRes.json());
      if (dietRes.ok) {
        const d = await dietRes.json();
        setDiet(d.diet ?? null);
      }
    } catch {
      // silently fail
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const tabs: { id: Tab; label: string }[] = [
    { id: "hoy", label: "Hoy" },
    { id: "stats", label: "Stats" },
    { id: "dieta", label: "Dieta" },
  ];

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 bg-surface rounded-xl p-1 border border-white/5">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id
                ? "bg-module-nutrition/20 text-module-nutrition"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Refresh indicator */}
      {isRefreshing && (
        <p className="text-xs text-text-muted text-center animate-pulse">
          Actualizando...
        </p>
      )}

      {/* TAB: HOY */}
      {tab === "hoy" && (
        <div className="space-y-4">
          <NutritionQuickActions onLogged={refreshAll} />
          <WaterTracker
            totalThermos={summary.totalWaterThermos}
            goalThermos={summary.waterGoalThermos}
            onLogged={refreshAll}
          />
          <MealLogCard meals={summary.meals} onDeleted={refreshAll} />
          {summary.totalProteinG !== null &&
            summary.totalCarbsG !== null &&
            summary.totalFatG !== null && (
              <MacrosChart
                proteinG={summary.totalProteinG}
                carbsG={summary.totalCarbsG}
                fatG={summary.totalFatG}
                calories={summary.totalCalories}
              />
            )}
        </div>
      )}

      {/* TAB: STATS */}
      {tab === "stats" && (
        <div className="space-y-4">
          <NutritionWeekStats stats={weeklyStats} />
          <MealHistoryList history={history} />
        </div>
      )}

      {/* TAB: DIETA */}
      {tab === "dieta" && (
        <div className="space-y-4">
          <DietCard diet={diet} onUpdated={refreshAll} />
          <div className="rounded-xl bg-surface border border-white/5 p-4">
            <p className="text-xs text-text-muted leading-relaxed">
              💡 La IA usa tu dieta como referencia para evaluar qué tan alineadas están tus
              comidas. Cuanto más detallada sea, más precisas serán las evaluaciones.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

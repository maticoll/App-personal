"use client";

import { useState, useCallback } from "react";
import type {
  NutritionSummary,
  DayNutrition,
  DietInfo,
  WeeklyNutritionStats,
} from "@/lib/nutrition";

import MacrosChart from "./MacrosChart";
import WaterTracker from "./WaterTracker";
import NutritionQuickActions from "./NutritionQuickActions";
import MealHistoryList from "./MealHistoryList";
import NutritionWeekStats from "./NutritionWeekStats";
import DietCard from "./DietCard";
import MealLogCard from "./MealLogCard";

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
  const [weeklyStats, setWeeklyStats] = useState<WeeklyNutritionStats>(initialWeeklyStats);
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
      if (historyRes.ok) { const d = await historyRes.json(); setHistory(d.history ?? []); }
      if (statsRes.ok) setWeeklyStats(await statsRes.json());
      if (dietRes.ok) { const d = await dietRes.json(); setDiet(d.diet ?? null); }
    } catch { /* silently fail */ } finally { setIsRefreshing(false); }
  }, []);

  const TABS: { id: Tab; label: string }[] = [
    { id: "hoy", label: "Today" },
    { id: "stats", label: "Stats" },
    { id: "dieta", label: "Diet" },
  ];

  return (
    <div className="space-y-5">

      {/* ── Tab nav estilo Stitch ─────────────────────────────── */}
      <div className="flex p-1 bg-surface-container rounded-xl">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              tab === t.id
                ? "text-accent-emerald bg-surface-container-high shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isRefreshing && (
        <p className="text-xs text-on-surface-variant text-center animate-pulse">Actualizando...</p>
      )}

      {/* ── TODAY ────────────────────────────────────────────── */}
      {tab === "hoy" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-on-surface tracking-tight">Nutrition</h2>
          </div>

          {/* Macros Ring */}
          <MacrosChart
            proteinG={summary.totalProteinG ?? 0}
            carbsG={summary.totalCarbsG ?? 0}
            fatG={summary.totalFatG ?? 0}
            calories={summary.totalCalories}
          />

          {/* Water Tracker */}
          <WaterTracker
            totalThermos={summary.totalWaterThermos}
            goalThermos={summary.waterGoalThermos}
            onLogged={refreshAll}
          />

          {/* Quick Log */}
          <NutritionQuickActions onLogged={refreshAll} />

          {/* Today's Timeline */}
          {summary.meals.length > 0 && (
            <MealLogCard meals={summary.meals} onDeleted={refreshAll} />
          )}
        </div>
      )}

      {/* ── STATS ─────────────────────────────────────────────── */}
      {tab === "stats" && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-on-surface tracking-tight">Analysis</h2>
          <NutritionWeekStats stats={weeklyStats} />
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest px-1">
              Últimos 14 días
            </h3>
            <MealHistoryList history={history} />
          </div>
        </div>
      )}

      {/* ── DIET ──────────────────────────────────────────────── */}
      {tab === "dieta" && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-on-surface tracking-tight">Diet Profile</h2>
          <DietCard diet={diet} onUpdated={refreshAll} />
          <div className="glass-card rounded-2xl p-4">
            <p className="text-xs text-on-surface-variant leading-relaxed">
              La IA usa tu dieta como referencia para evaluar qué tan alineadas están tus comidas.
              Cuanto más detallada sea, más precisas serán las evaluaciones.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

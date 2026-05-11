"use client";

import type { WeeklyNutritionStats } from "@/lib/nutrition";

type Props = {
  stats: WeeklyNutritionStats;
};

export default function NutritionWeekStats({ stats }: Props) {
  const items = [
    {
      label: "Calorías promedio",
      value: stats.avgCalories !== null ? `~${stats.avgCalories} kcal` : "Sin datos",
      emoji: "🔥",
      hasData: stats.avgCalories !== null,
    },
    {
      label: "Hidratación promedio",
      value: `${stats.avgWaterThermos} termos/día`,
      emoji: "💧",
      hasData: stats.avgWaterThermos > 0,
    },
    {
      label: "Días con 3 comidas",
      value: `${stats.daysWithAllMeals}/7 días`,
      emoji: "✅",
      hasData: stats.daysWithAllMeals > 0,
    },
    {
      label: "Total de registros",
      value: `${stats.totalMealsLogged} comidas`,
      emoji: "📝",
      hasData: stats.totalMealsLogged > 0,
    },
  ];

  return (
    <div className="rounded-xl bg-surface border border-white/5 p-4">
      <h3 className="text-sm font-medium text-text-primary mb-3">Esta semana</h3>
      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="bg-white/5 rounded-lg px-3 py-2.5"
          >
            <p className="text-xs text-text-muted mb-1">
              {item.emoji} {item.label}
            </p>
            <p
              className={`text-sm font-semibold ${
                item.hasData ? "text-text-primary" : "text-text-muted"
              }`}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

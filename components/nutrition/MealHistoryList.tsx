"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import AlignmentBadge from "./AlignmentBadge";
import type { DayNutrition } from "@/lib/nutrition";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const MEAL_EMOJI: Record<string, string> = {
  BREAKFAST: "🌅",
  LUNCH: "☀️",
  DINNER: "🌙",
  SNACK: "🍎",
  OTHER: "🍽️",
};

const MEAL_LABEL: Record<string, string> = {
  BREAKFAST: "Desayuno",
  LUNCH: "Almuerzo",
  DINNER: "Cena",
  SNACK: "Snack",
  OTHER: "Otra",
};

type Props = {
  history: DayNutrition[];
};

export default function MealHistoryList({ history }: Props) {
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  if (history.length === 0) {
    return (
      <div className="rounded-xl bg-surface border border-white/5 p-6 text-center">
        <p className="text-text-muted text-sm">Sin historial disponible</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-surface border border-white/5 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5">
        <h3 className="text-sm font-medium text-text-primary">
          Historial (últimos 14 días)
        </h3>
      </div>
      <div className="divide-y divide-white/5">
        {history.map((day) => {
          const key = day.date.toISOString().split("T")[0];
          const isExpanded = expandedDate === key;
          const mealCount = day.meals.length;
          const waterOk = day.totalWaterThermos >= day.waterGoalThermos;

          return (
            <div key={key}>
              <button
                onClick={() => setExpandedDate(isExpanded ? null : key)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/3 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-sm text-text-primary font-medium capitalize">
                      {format(new Date(key + "T12:00:00"), "EEEE d MMM", {
                        locale: es,
                      })}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {mealCount} {mealCount === 1 ? "comida" : "comidas"} ·{" "}
                      {day.totalWaterThermos.toFixed(1)} termos
                      {day.totalCalories !== null &&
                        ` · ~${Math.round(day.totalCalories)} kcal`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {waterOk && (
                    <span className="text-xs text-blue-400">💧</span>
                  )}
                  <span className="text-xs text-text-muted">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </span>
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-3 space-y-2">
                  {day.meals.map((meal) => (
                    <div
                      key={meal.id}
                      className="flex items-start gap-2 bg-white/5 rounded-lg px-3 py-2"
                    >
                      <span className="text-base shrink-0">
                        {MEAL_EMOJI[meal.mealType] ?? "🍽️"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-text-muted">
                            {MEAL_LABEL[meal.mealType] ?? "Comida"}
                          </span>
                          {meal.dietAlignmentScore !== null && (
                            <AlignmentBadge score={meal.dietAlignmentScore} />
                          )}
                        </div>
                        <p className="text-sm text-text-primary leading-snug mt-0.5">
                          {meal.description}
                        </p>
                        {meal.calories !== null && (
                          <p className="text-xs text-text-muted mt-0.5">
                            ~{Math.round(meal.calories)} kcal · P:{meal.proteinG}g C:{meal.carbsG}g G:{meal.fatG}g
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  {day.meals.length === 0 && (
                    <p className="text-xs text-text-muted px-1">Sin comidas registradas</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

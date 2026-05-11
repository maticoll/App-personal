"use client";

import { useState } from "react";
import { Trash2, ChevronDown, ChevronUp } from "lucide-react";
import AlignmentBadge from "./AlignmentBadge";
import type { MealWithMeta } from "@/lib/nutrition";

type MealTypeLabel = {
  label: string;
  emoji: string;
  color: string;
};

const MEAL_LABELS: Record<string, MealTypeLabel> = {
  BREAKFAST: { label: "Desayuno", emoji: "🌅", color: "text-orange-400" },
  LUNCH: { label: "Almuerzo", emoji: "☀️", color: "text-yellow-400" },
  DINNER: { label: "Cena", emoji: "🌙", color: "text-indigo-400" },
  SNACK: { label: "Snack", emoji: "🍎", color: "text-emerald-400" },
  OTHER: { label: "Otra comida", emoji: "🍽️", color: "text-text-muted" },
};

type Props = {
  meals: MealWithMeta[];
  onDeleted: () => void;
};

export default function MealLogCard({ meals, onDeleted }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (meals.length === 0) {
    return (
      <div className="rounded-xl bg-surface border border-white/5 p-6 text-center">
        <p className="text-text-muted text-sm">Sin comidas registradas hoy</p>
        <p className="text-text-muted/60 text-xs mt-1">
          Usá el campo de abajo para registrar tu primera comida
        </p>
      </div>
    );
  }

  const handleDelete = async (mealId: string) => {
    setDeletingId(mealId);
    try {
      await fetch(`/api/nutrition/meal/${mealId}`, { method: "DELETE" });
      onDeleted();
    } catch {
      console.error("Error eliminando comida");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="rounded-xl bg-surface border border-white/5 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5">
        <h3 className="text-sm font-medium text-text-primary">Comidas de hoy</h3>
      </div>
      <div className="divide-y divide-white/5">
        {meals.map((meal) => {
          const config = MEAL_LABELS[meal.mealType] ?? MEAL_LABELS.OTHER;
          const isExpanded = expandedId === meal.id;

          return (
            <div key={meal.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">{config.emoji}</span>
                    <span className={`text-xs font-medium ${config.color}`}>
                      {config.label}
                    </span>
                    {meal.dietAlignmentScore !== null && (
                      <AlignmentBadge score={meal.dietAlignmentScore} size="sm" />
                    )}
                  </div>
                  <p className="text-sm text-text-primary leading-snug line-clamp-2">
                    {meal.description}
                  </p>
                  {meal.calories !== null && (
                    <p className="text-xs text-text-muted mt-1">
                      ~{Math.round(meal.calories)} kcal
                      {meal.proteinG !== null && ` · P: ${meal.proteinG}g`}
                      {meal.carbsG !== null && ` · C: ${meal.carbsG}g`}
                      {meal.fatG !== null && ` · G: ${meal.fatG}g`}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : meal.id)}
                    className="p-1.5 text-text-muted hover:text-text-primary transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(meal.id)}
                    disabled={deletingId === meal.id}
                    className="p-1.5 text-text-muted hover:text-red-400 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {isExpanded && meal.notes && (
                <p className="mt-2 text-xs text-text-muted bg-white/5 rounded-lg px-3 py-2">
                  {meal.notes}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

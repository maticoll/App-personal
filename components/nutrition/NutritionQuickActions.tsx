"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import type { MealType } from "@prisma/client";

const MEAL_TYPES: { value: MealType; label: string; emoji: string }[] = [
  { value: "BREAKFAST", label: "Desayuno", emoji: "🌅" },
  { value: "LUNCH", label: "Almuerzo", emoji: "☀️" },
  { value: "DINNER", label: "Cena", emoji: "🌙" },
  { value: "SNACK", label: "Snack", emoji: "🍎" },
  { value: "OTHER", label: "Otra", emoji: "🍽️" },
];

type Props = {
  onLogged: () => void;
};

export default function NutritionQuickActions({ onLogged }: Props) {
  const [text, setText] = useState("");
  const [mealType, setMealType] = useState<MealType>("LUNCH");
  const [loading, setLoading] = useState<"meal" | "water" | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const showFeedback = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleLogMeal = async () => {
    if (!text.trim()) return;
    setLoading("meal");
    try {
      const res = await fetch("/api/nutrition/meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: text.trim(), mealType }),
      });
      if (!res.ok) throw new Error();
      setText("");
      showFeedback("success", "✓ Comida registrada con macros calculados por IA");
      onLogged();
    } catch {
      showFeedback("error", "Error registrando la comida");
    } finally {
      setLoading(null);
    }
  };

  const handleLogWater = async () => {
    setLoading("water");
    try {
      const res = await fetch("/api/nutrition/water", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thermos: 1 }),
      });
      if (!res.ok) throw new Error();
      showFeedback("success", "💧 +1 termo registrado");
      onLogged();
    } catch {
      showFeedback("error", "Error registrando agua");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="rounded-xl bg-surface border border-white/5 p-4 space-y-3">
      <h3 className="text-sm font-medium text-text-primary">Registrar</h3>

      {/* Selector de tipo */}
      <div className="flex gap-2 flex-wrap">
        {MEAL_TYPES.map((mt) => (
          <button
            key={mt.value}
            onClick={() => setMealType(mt.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              mealType === mt.value
                ? "bg-module-nutrition text-white"
                : "bg-white/5 text-text-muted hover:bg-white/10"
            }`}
          >
            {mt.emoji} {mt.label}
          </button>
        ))}
      </div>

      {/* Textarea NLP */}
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleLogMeal();
            }
          }}
          placeholder="¿Qué comiste? Ej: dos medialunas con café con leche y medialunas de manteca..."
          rows={3}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted/60 resize-none focus:outline-none focus:border-module-nutrition/50 transition-colors"
        />
        <p className="text-xs text-text-muted/50 mt-1">
          La IA calcula los macros automáticamente • Enter para enviar
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleLogMeal}
          disabled={!text.trim() || loading === "meal"}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-module-nutrition/20 text-emerald-400 text-sm font-medium hover:bg-module-nutrition/30 transition-colors disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
          {loading === "meal" ? "Calculando macros..." : "Registrar comida"}
        </button>
        <button
          onClick={handleLogWater}
          disabled={loading === "water"}
          className="px-4 py-2.5 rounded-lg bg-blue-500/20 text-blue-400 text-sm font-medium hover:bg-blue-500/30 transition-colors disabled:opacity-40"
        >
          {loading === "water" ? "..." : "💧 +1 Termo"}
        </button>
      </div>

      {feedback && (
        <p
          className={`text-xs text-center ${
            feedback.type === "success" ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {feedback.message}
        </p>
      )}
    </div>
  );
}

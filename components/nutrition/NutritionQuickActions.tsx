"use client";

import { useState } from "react";
import type { MealType } from "@prisma/client";

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: "BREAKFAST", label: "Breakfast" },
  { value: "LUNCH",     label: "Lunch" },
  { value: "DINNER",    label: "Dinner" },
  { value: "SNACK",     label: "Snack" },
];

type Props = { onLogged: () => void };

export default function NutritionQuickActions({ onLogged }: Props) {
  const [text, setText] = useState("");
  const [mealType, setMealType] = useState<MealType>("LUNCH");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const flash = (ok: boolean, msg: string) => {
    setFeedback({ ok, msg });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/nutrition/meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: text.trim(), mealType }),
      });
      if (!res.ok) throw new Error();
      setText("");
      flash(true, "Comida registrada con macros calculados");
      onLogged();
    } catch {
      flash(false, "Error registrando la comida");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="glass-card p-4 rounded-2xl space-y-3">
      <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
        Quick Log
      </span>

      {/* Category pills */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {MEAL_TYPES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setMealType(value)}
            className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all active:scale-95"
            style={
              mealType === value
                ? { background: "rgba(16,185,129,0.2)", border: "1px solid rgba(16,185,129,0.3)", color: "#10B981" }
                : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#908fa0" }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* NLP textarea */}
      <form onSubmit={handleLog} className="relative">
        <div className="absolute left-4 top-4 text-accent-emerald font-mono text-sm select-none">&gt;</div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleLog(e as unknown as React.FormEvent); } }}
          placeholder="1 chicken breast and 100g rice..."
          rows={3}
          className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-2xl pt-4 pl-9 pr-14 pb-4 text-on-surface font-mono text-sm focus:ring-1 focus:ring-accent-emerald focus:border-accent-emerald transition-all resize-none outline-none"
        />
        <button
          type="submit"
          disabled={!text.trim() || loading}
          className="absolute right-3 bottom-3 w-10 h-10 rounded-xl bg-surface-container-high text-accent-emerald flex items-center justify-center hover:bg-accent-emerald hover:text-[#0D0F14] active:scale-90 transition-all disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[20px]">
            {loading ? "hourglass_empty" : "keyboard_return"}
          </span>
        </button>
      </form>

      {feedback && (
        <div className={`text-sm px-4 py-3 rounded-2xl border ${
          feedback.ok
            ? "bg-[#10B981]/10 text-[#34D399] border-[#10B981]/20"
            : "bg-[#EF4444]/10 text-[#F87171] border-[#EF4444]/20"
        }`}>
          {feedback.msg}
        </div>
      )}
    </section>
  );
}

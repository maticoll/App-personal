"use client";

import { Footprints } from "lucide-react";

type Props = {
  steps: number;
  goal: number;
};

export default function StepsCard({ steps, goal }: Props) {
  const pct = goal > 0 ? Math.min(Math.round((steps / goal) * 100), 100) : 0;
  const reached = steps >= goal;
  const remaining = Math.max(goal - steps, 0);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent-cyan/10 flex items-center justify-center">
            <Footprints className="w-4 h-4 text-accent-cyan" />
          </div>
          <span className="text-sm font-semibold text-on-surface">Pasos de hoy</span>
        </div>
        <span
          className={`text-xs font-bold uppercase tracking-widest ${
            reached ? "text-green-500" : "text-on-surface-variant"
          }`}
        >
          {reached ? "Meta ✓" : `${pct}%`}
        </span>
      </div>

      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-3xl font-bold text-on-surface tracking-tight">
          {steps.toLocaleString("es-UY")}
        </span>
        <span className="text-sm text-on-surface-variant">
          / {goal.toLocaleString("es-UY")}
        </span>
      </div>

      {/* Barra de progreso */}
      <div className="h-2 rounded-full bg-surface-container-high overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            reached ? "bg-green-500" : "bg-accent-cyan"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="text-xs text-outline mt-2">
        {reached
          ? "¡Llegaste a tu meta de pasos! Cuenta como cardio del día."
          : `Te faltan ${remaining.toLocaleString("es-UY")} pasos para la meta.`}
      </p>
    </div>
  );
}

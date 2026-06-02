"use client";

import { useState } from "react";
import type { RoutineWithLastPerformance } from "@/lib/fitness";

const DAY_LABELS: Record<string, string> = {
  MONDAY: "Lun", TUESDAY: "Mar", WEDNESDAY: "Mié",
  THURSDAY: "Jue", FRIDAY: "Vie", SATURDAY: "Sáb", SUNDAY: "Dom",
};

// Tiempo estimado: 10 min calentamiento + 8 min por ejercicio
function estimateMinutes(exerciseCount: number): string {
  return `${10 + exerciseCount * 8} min`;
}

type Props = {
  routine: RoutineWithLastPerformance;
  onStarted: () => void;
};

/** Formatea el último peso×reps de un ejercicio (ej: "70x10"), o "" si no hay. */
function lastLabel(last: { weightKg: number | null; reps: number | null } | null): string {
  if (!last || last.weightKg == null) return "";
  const w = Number.isInteger(last.weightKg) ? String(last.weightKg) : String(last.weightKg);
  return last.reps != null ? `${w}x${last.reps}` : `${w}kg`;
}

export default function GymRoutineCard({ routine, onStarted }: Props) {
  const [starting, setStarting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleStart = async () => {
    setStarting(true);
    try {
      const res = await fetch("/api/fitness/start-routine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: routine.name }),
      });
      if (!res.ok) throw new Error();
      onStarted();
    } catch {
      alert("Error al iniciar la sesión de gym");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div
      className="glass-card rounded-2xl p-4 flex flex-col justify-between min-h-[160px] relative overflow-hidden active:scale-[0.98] transition-all duration-150"
      style={{ minHeight: expanded ? "auto" : 160 }}
    >
      {/* Decoración de fondo cyan */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-accent-cyan/10 blur-3xl -mr-16 -mt-16 pointer-events-none" />

      {/* Top row */}
      <div className="flex justify-between items-start z-10">
        <div>
          <span className="text-xs font-bold text-accent-cyan uppercase tracking-widest opacity-80">
            Gym Routine
          </span>
          <h3 className="text-2xl font-bold text-on-surface mt-1">{routine.name}</h3>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-10 h-10 bg-[#06B6D4]/20 rounded-full flex items-center justify-center active:scale-90 transition-transform"
        >
          <span
            className="material-symbols-outlined text-accent-cyan text-[22px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            fitness_center
          </span>
        </button>
      </div>

      {/* Stats row */}
      <div className="flex gap-4 mt-4 z-10">
        <div className="flex flex-col">
          <span className="text-xs text-on-surface-variant">Exercises</span>
          <span className="text-base font-semibold text-on-surface">
            {routine.exercises.length} Total
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-on-surface-variant">Est. Time</span>
          <span className="text-base font-semibold text-on-surface">
            {estimateMinutes(routine.exercises.length)}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-on-surface-variant">Días</span>
          <span className="text-xs font-semibold text-accent-cyan">
            {routine.days.map((d) => DAY_LABELS[d] ?? d).join(" · ")}
          </span>
        </div>
      </div>

      {/* Ejercicios expandidos */}
      {expanded && routine.exercises.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/10 space-y-2 z-10">
          {routine.exercises.map((ex, idx) => {
            const last = lastLabel(ex.last);
            return (
              <div key={ex.id} className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-surface-container-high flex items-center justify-center text-[10px] text-outline flex-shrink-0">
                  {idx + 1}
                </span>
                <span className="text-sm text-on-surface flex-1">{ex.name}</span>
                {last && (
                  <span className="text-xs font-semibold text-accent-cyan">{last}</span>
                )}
                <span className="text-xs text-outline">
                  {ex.sets}×{ex.repsRange ?? "—"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Botón empezar gym */}
      <button
        onClick={handleStart}
        disabled={starting}
        className="mt-4 w-full py-2.5 rounded-full bg-accent-cyan text-[#0D0F14] font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60 z-10"
      >
        <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
          play_arrow
        </span>
        {starting ? "Iniciando..." : "Empezar gym"}
      </button>
    </div>
  );
}

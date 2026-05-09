"use client";

import { useState } from "react";
import { Dumbbell, Calendar, Play, ChevronDown, ChevronUp } from "lucide-react";
import type { GymRoutineWithExercises } from "@/lib/fitness";

const DAY_LABELS: Record<string, string> = {
  MONDAY: "Lun",
  TUESDAY: "Mar",
  WEDNESDAY: "Mié",
  THURSDAY: "Jue",
  FRIDAY: "Vie",
  SATURDAY: "Sáb",
  SUNDAY: "Dom",
};

type Props = {
  routine: GymRoutineWithExercises;
  onStarted: () => void;
};

export default function GymRoutineCard({ routine, onStarted }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [starting, setStarting] = useState(false);

  const handleStart = async () => {
    setStarting(true);
    try {
      const res = await fetch("/api/fitness/workout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "GYM", title: routine.name }),
      });
      if (!res.ok) throw new Error("Error al iniciar sesión");
      onStarted();
    } catch {
      alert("Error al iniciar la sesión de gym");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="card">
      <div className="flex items-start gap-3">
        {/* Ícono */}
        <div className="w-10 h-10 rounded-xl bg-[#06B6D4]/10 flex items-center justify-center flex-shrink-0">
          <Dumbbell className="w-5 h-5 text-module-fitness" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                Rutina de hoy
              </p>
              <p className="text-sm text-module-fitness font-medium">{routine.name}</p>
            </div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-muted)]"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {/* Días asignados */}
          <div className="flex items-center gap-1 mt-2">
            <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <div className="flex gap-1">
              {routine.days.map((day) => (
                <span
                  key={day}
                  className="text-xs bg-[#06B6D4]/10 text-module-fitness px-1.5 py-0.5 rounded-full"
                >
                  {DAY_LABELS[day] ?? day}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Lista de ejercicios (expandible) */}
      {expanded && routine.exercises.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-[var(--border)] pt-4">
          {routine.exercises.map((ex, idx) => (
            <div key={ex.id} className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-[var(--surface-hover)] flex items-center justify-center text-xs text-[var(--text-muted)] flex-shrink-0">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-[var(--text-primary)]">{ex.name}</span>
                <span className="text-xs text-[var(--text-muted)] ml-2">
                  {ex.sets} series{ex.repsRange ? ` × ${ex.repsRange} reps` : ""}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Botón iniciar */}
      <button
        onClick={handleStart}
        disabled={starting}
        className="btn-primary w-full mt-4 flex items-center justify-center gap-2 text-sm"
      >
        <Play className="w-4 h-4" />
        {starting ? "Iniciando..." : "Empezar gym"}
      </button>
    </div>
  );
}

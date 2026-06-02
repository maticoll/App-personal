"use client";
import { useState } from "react";
import { Plus, Trash2, Timer } from "lucide-react";
import SetRow from "./SetRow";
import type { SessionExercise } from "./workout-session-types";

type Props = {
  exercise: SessionExercise;
  onSetChange: (setId: string, patch: { weightKg?: number | null; reps?: number | null }) => void;
  onToggleDone: (setId: string) => void;
  onAddSet: () => void;
  onRemoveExercise: () => void;
  onRestChange: (seconds: number) => void;
};

// Misma clave canónica que lib `weightKey` (String(weightKg), "0" si null).
function weightKey(weightKg: number | null): string {
  return weightKg == null ? "0" : String(weightKg);
}

function isPR(
  set: { weightKg: number | null; reps: number | null },
  bests: SessionExercise["bests"]
): boolean {
  if (!bests || set.weightKg == null) return false;
  if (bests.maxWeightKg != null && set.weightKg > bests.maxWeightKg) return true;
  if (set.reps != null) {
    const prevReps = bests.repsAtWeight[weightKey(set.weightKg)];
    if (prevReps != null && set.reps > prevReps) return true;
  }
  return false;
}

export default function ExerciseLogCard({
  exercise,
  onSetChange,
  onToggleDone,
  onAddSet,
  onRemoveExercise,
  onRestChange,
}: Props) {
  const [editingRest, setEditingRest] = useState(false);

  return (
    <div className="bg-surface-container rounded-xl p-3 space-y-2 border border-outline-variant/20">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-accent-cyan truncate">{exercise.name}</p>
          {exercise.repsRange && (
            <p className="text-xs text-outline">Objetivo: {exercise.repsRange} reps</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {editingRest ? (
            <div className="flex items-center gap-1">
              <Timer className="w-3.5 h-3.5 text-outline" />
              <input
                type="number"
                inputMode="numeric"
                autoFocus
                value={exercise.restSeconds}
                onChange={(e) => onRestChange(Math.max(0, parseInt(e.target.value, 10) || 0))}
                onBlur={() => setEditingRest(false)}
                className="w-14 bg-surface-container-high text-on-surface text-center text-xs rounded-md px-1 py-1 outline-none focus:ring-1 focus:ring-accent-cyan"
              />
              <span className="text-xs text-outline">s</span>
            </div>
          ) : (
            <button
              onClick={() => setEditingRest(true)}
              className="flex items-center gap-1 text-xs text-outline hover:text-on-surface px-2 py-1 rounded-md hover:bg-surface-container-high"
            >
              <Timer className="w-3.5 h-3.5" />
              descanso {exercise.restSeconds}s
            </button>
          )}
          <button
            onClick={onRemoveExercise}
            aria-label="Quitar ejercicio"
            className="p-1.5 rounded-md text-outline hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Column headers */}
      <div
        className="grid items-center gap-2 px-2 text-[10px] uppercase tracking-wide text-outline"
        style={{ gridTemplateColumns: "28px 1fr 56px 48px 32px" }}
      >
        <span className="text-center">Set</span>
        <span>Anterior</span>
        <span className="text-center">Kg</span>
        <span className="text-center">Reps</span>
        <span className="text-center">✓</span>
      </div>

      {/* Set rows */}
      <div className="space-y-1">
        {exercise.sets.map((set, i) => {
          const pr = isPR(set, exercise.bests);
          return (
            <div key={set.id} className="flex items-center gap-1">
              <div className="flex-1 min-w-0">
                <SetRow
                  index={i + 1}
                  prev={{ weightKg: set.prevWeightKg, reps: set.prevReps }}
                  weightKg={set.weightKg}
                  reps={set.reps}
                  done={set.done}
                  onChange={(patch) => onSetChange(set.id, patch)}
                  onToggleDone={() => onToggleDone(set.id)}
                />
              </div>
              <span className="w-5 text-center text-sm" aria-label={pr ? "Posible récord" : undefined}>
                {pr ? "🔥" : ""}
              </span>
            </div>
          );
        })}
      </div>

      {/* Add set */}
      <button
        onClick={onAddSet}
        className="w-full flex items-center justify-center gap-1 text-xs text-on-surface-variant hover:text-on-surface bg-surface-container-high rounded-lg py-2 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> Agregar serie
      </button>
    </div>
  );
}

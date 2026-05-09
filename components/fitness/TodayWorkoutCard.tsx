"use client";

import { useState } from "react";
import { Dumbbell, Timer, Droplets, MapPin, Bike, ChevronDown, ChevronUp, Trash2, Activity } from "lucide-react";
import type { WorkoutWithExercises } from "@/lib/fitness";

type Props = {
  workouts: WorkoutWithExercises[];
  onDeleted: (workoutId: string) => void;
  isRefreshing?: boolean;
};

const TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  GYM: { label: "Gym", icon: <Dumbbell className="w-4 h-4" />, color: "text-module-fitness" },
  RUNNING: { label: "Carrera", icon: <Timer className="w-4 h-4" />, color: "text-orange-400" },
  SWIMMING: { label: "Natación", icon: <Droplets className="w-4 h-4" />, color: "text-blue-400" },
  WALKING: { label: "Caminata", icon: <MapPin className="w-4 h-4" />, color: "text-green-400" },
  CYCLING: { label: "Ciclismo", icon: <Bike className="w-4 h-4" />, color: "text-purple-400" },
  OTHER: { label: "Actividad", icon: <Activity className="w-4 h-4" />, color: "text-[var(--text-secondary)]" },
};

function formatDuration(minutes: number | null): string {
  if (!minutes) return "-";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

type WorkoutRowProps = {
  workout: WorkoutWithExercises;
  onDeleted: (id: string) => void;
};

function WorkoutRow({ workout, onDeleted }: WorkoutRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const config = TYPE_CONFIG[workout.type] ?? TYPE_CONFIG.OTHER;

  const handleDelete = async () => {
    if (!confirm("¿Eliminar este entrenamiento?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/fitness/workout/${workout.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Error al eliminar");
      onDeleted(workout.id);
    } catch {
      alert("Error al eliminar el entrenamiento");
      setDeleting(false);
    }
  };

  return (
    <div className="border border-[var(--border)] rounded-xl overflow-hidden">
      {/* Header del workout */}
      <div className="flex items-center gap-3 p-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--surface-hover)] ${config.color}`}>
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${config.color}`}>
            {workout.title ?? config.label}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-[var(--text-muted)]">
              {formatDuration(workout.durationMinutes)}
            </span>
            {workout.distanceKm && (
              <span className="text-xs text-[var(--text-muted)]">
                · {workout.distanceKm.toFixed(1)} km
              </span>
            )}
            {workout.calories && (
              <span className="text-xs text-[var(--text-muted)]">
                · {workout.calories} kcal
              </span>
            )}
            {workout.source === "GARMIN" && (
              <span className="text-xs bg-[var(--surface-hover)] text-[var(--text-muted)] px-1.5 py-0.5 rounded-full">
                Garmin
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {workout.exercises.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-muted)] transition-colors"
            >
              {expanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 transition-colors disabled:opacity-40"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Ejercicios expandibles (solo para GYM) */}
      {expanded && workout.exercises.length > 0 && (
        <div className="px-3 pb-3 space-y-2 border-t border-[var(--border)] pt-3">
          {workout.exercises.map((ex) => (
            <div key={ex.id}>
              <p className="text-xs font-medium text-[var(--text-secondary)] mb-1">
                {ex.name}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ex.sets.map((set) => (
                  <span
                    key={set.id}
                    className="text-xs bg-[var(--surface-hover)] text-[var(--text-muted)] px-2 py-0.5 rounded-full"
                  >
                    Serie {set.setNumber}
                    {set.reps ? `: ${set.reps} reps` : ""}
                    {set.weightKg ? ` · ${set.weightKg} kg` : ""}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TodayWorkoutCard({ workouts, onDeleted, isRefreshing }: Props) {
  const totalMinutes = workouts.reduce((sum, w) => sum + (w.durationMinutes ?? 0), 0);
  const totalSets = workouts.reduce(
    (sum, w) => sum + w.exercises.reduce((s, ex) => s + ex.sets.length, 0),
    0
  );

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-[var(--text-primary)]">
          Hoy{isRefreshing && <span className="ml-2 text-xs text-[var(--text-muted)]">actualizando...</span>}
        </h3>
        <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
          {totalMinutes > 0 && <span>{formatDuration(totalMinutes)}</span>}
          {totalSets > 0 && <span>{totalSets} series</span>}
        </div>
      </div>

      <div className="space-y-2">
        {workouts.map((workout) => (
          <WorkoutRow key={workout.id} workout={workout} onDeleted={onDeleted} />
        ))}
      </div>
    </div>
  );
}

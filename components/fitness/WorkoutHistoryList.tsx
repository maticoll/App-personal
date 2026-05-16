"use client";

import { useState } from "react";
import { Dumbbell, Timer, Droplets, MapPin, Bike, Activity, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import type { WorkoutWithExercises } from "@/lib/fitness";

const TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  GYM: { label: "Gym", icon: <Dumbbell className="w-3.5 h-3.5" />, color: "text-module-fitness" },
  RUNNING: { label: "Carrera", icon: <Timer className="w-3.5 h-3.5" />, color: "text-orange-400" },
  SWIMMING: { label: "Natación", icon: <Droplets className="w-3.5 h-3.5" />, color: "text-blue-400" },
  WALKING: { label: "Caminata", icon: <MapPin className="w-3.5 h-3.5" />, color: "text-green-400" },
  CYCLING: { label: "Ciclismo", icon: <Bike className="w-3.5 h-3.5" />, color: "text-purple-400" },
  OTHER: { label: "Actividad", icon: <Activity className="w-3.5 h-3.5" />, color: "text-on-surface-variant" },
};

function formatDate(date: Date): string {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Hoy";
  if (d.toDateString() === yesterday.toDateString()) return "Ayer";
  return d.toLocaleDateString("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatDuration(minutes: number | null): string {
  if (!minutes) return "";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

type HistoryItemProps = {
  workout: WorkoutWithExercises;
  onDeleted: (id: string) => void;
};

function HistoryItem({ workout, onDeleted }: HistoryItemProps) {
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
      if (!res.ok) throw new Error();
      onDeleted(workout.id);
    } catch {
      alert("Error al eliminar");
      setDeleting(false);
    }
  };

  return (
    <div className="border border-outline-variant/20 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center bg-surface-container-high flex-shrink-0 ${config.color}`}
        >
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${config.color}`}>
              {workout.title ?? config.label}
            </span>
            {workout.source === "GARMIN" && (
              <span className="text-xs bg-surface-container-high text-outline px-1.5 rounded-full">
                Garmin
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {workout.durationMinutes && (
              <span className="text-xs text-outline">
                {formatDuration(workout.durationMinutes)}
              </span>
            )}
            {workout.distanceKm && (
              <span className="text-xs text-outline">
                · {workout.distanceKm.toFixed(1)} km
              </span>
            )}
            {workout.exercises.length > 0 && (
              <span className="text-xs text-outline">
                · {workout.exercises.length} ejercicios
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {workout.exercises.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-surface-container-high text-outline transition-colors"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-red-500/10 text-outline hover:text-red-400 transition-colors disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {expanded && workout.exercises.length > 0 && (
        <div className="px-3 pb-3 pt-2 border-t border-outline-variant/20 space-y-2">
          {workout.exercises.map((ex) => (
            <div key={ex.id} className="text-xs">
              <span className="text-on-surface-variant font-medium">{ex.name}</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {ex.sets.map((set) => (
                  <span
                    key={set.id}
                    className="bg-surface-container-high text-outline px-1.5 py-0.5 rounded"
                  >
                    S{set.setNumber}
                    {set.reps ? ` ${set.reps}r` : ""}
                    {set.weightKg ? ` ${set.weightKg}kg` : ""}
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

type Props = {
  workouts: WorkoutWithExercises[];
  onDeleted: (id: string) => void;
};

type DayGroup = {
  date: string;
  label: string;
  workouts: WorkoutWithExercises[];
};

export default function WorkoutHistoryList({ workouts, onDeleted }: Props) {
  // Agrupar por día
  const groups: DayGroup[] = [];
  const seen = new Set<string>();

  for (const w of workouts) {
    const dateStr = new Date(w.date).toDateString();
    if (!seen.has(dateStr)) {
      seen.add(dateStr);
      groups.push({
        date: dateStr,
        label: formatDate(w.date),
        workouts: workouts.filter(
          (x) => new Date(x.date).toDateString() === dateStr
        ),
      });
    }
  }

  if (workouts.length === 0) {
    return (
      <div className="card text-center py-10 text-outline text-sm">
        Sin entrenamientos registrados en los últimos 14 días
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.date} className="space-y-2">
          <h4 className="text-xs font-semibold text-outline uppercase tracking-wide px-1">
            {group.label}
          </h4>
          {group.workouts.map((w) => (
            <HistoryItem key={w.id} workout={w} onDeleted={onDeleted} />
          ))}
        </div>
      ))}
    </div>
  );
}

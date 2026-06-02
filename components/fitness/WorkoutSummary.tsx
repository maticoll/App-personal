"use client";
import { Clock, Layers, Dumbbell } from "lucide-react";
import type { WorkoutSessionSummary } from "@/lib/fitness";

type Props = { summary: WorkoutSessionSummary; onClose: () => void };

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

const KIND_LABEL: Record<string, string> = {
  weight: "Peso máximo",
  volume: "Volumen",
  reps: "Reps",
};

export default function WorkoutSummary({ summary, onClose }: Props) {
  return (
    <div className="max-w-md mx-auto space-y-5 py-6">
      <div className="text-center space-y-1">
        <p className="text-4xl">💪</p>
        <h2 className="text-xl font-bold text-on-surface">¡Workout completado!</h2>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-surface-container rounded-xl p-3 text-center border border-outline-variant/20">
          <Clock className="w-4 h-4 mx-auto text-accent-cyan mb-1" />
          <p className="font-bold text-on-surface tabular-nums">{formatDuration(summary.durationSeconds)}</p>
          <p className="text-[10px] uppercase tracking-wide text-outline">Duración</p>
        </div>
        <div className="bg-surface-container rounded-xl p-3 text-center border border-outline-variant/20">
          <Layers className="w-4 h-4 mx-auto text-accent-cyan mb-1" />
          <p className="font-bold text-on-surface tabular-nums">{summary.totalSets}</p>
          <p className="text-[10px] uppercase tracking-wide text-outline">Series</p>
        </div>
        <div className="bg-surface-container rounded-xl p-3 text-center border border-outline-variant/20">
          <Dumbbell className="w-4 h-4 mx-auto text-accent-cyan mb-1" />
          <p className="font-bold text-on-surface tabular-nums">{summary.totalVolume}</p>
          <p className="text-[10px] uppercase tracking-wide text-outline">Volumen (kg)</p>
        </div>
      </div>

      {/* PRs */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-on-surface-variant">Récords</h3>
        {summary.prs.length === 0 ? (
          <p className="text-sm text-outline bg-surface-container rounded-xl p-3 border border-outline-variant/20">
            Sin récords esta vez — igual sumaste 💪
          </p>
        ) : (
          <ul className="space-y-1.5">
            {summary.prs.map((pr, i) => (
              <li
                key={`${pr.exercise}-${pr.kind}-${i}`}
                className="flex items-center gap-2 bg-surface-container rounded-xl p-3 border border-outline-variant/20"
              >
                <span className="text-lg">🔥</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-on-surface truncate">{pr.exercise}</p>
                  <p className="text-xs text-outline">
                    {KIND_LABEL[pr.kind] ?? pr.kind}: {pr.detail}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        onClick={onClose}
        className="w-full bg-accent-cyan text-[#0D0F14] font-semibold rounded-xl py-3 transition-opacity hover:opacity-90"
      >
        Listo
      </button>
    </div>
  );
}

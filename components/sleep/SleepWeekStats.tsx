"use client";

// ============================================================
// SleepWeekStats — Estadísticas semanales resumidas
// ============================================================

import { cn, formatDuration } from "@/lib/utils";
import type { WeeklyStats } from "@/lib/sleep";

type Props = {
  stats: WeeklyStats;
};

export function SleepWeekStats({ stats }: Props) {
  const {
    avgDurationMinutes,
    daysInIdealRange,
    daysInAcceptableRange,
    avgGarminScore,
    streak,
    totalDays,
  } = stats;

  const daysInRange = daysInIdealRange + daysInAcceptableRange;

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">
        Últimos 7 días
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Promedio */}
        <div className="text-center">
          <div
            className={cn(
              "text-2xl font-bold",
              avgDurationMinutes === null
                ? "text-[var(--text-muted)]"
                : avgDurationMinutes >= 7 * 60 && avgDurationMinutes <= 9 * 60
                ? "text-score-excellent"
                : avgDurationMinutes >= 6 * 60
                ? "text-score-good"
                : "text-score-bad"
            )}
          >
            {avgDurationMinutes !== null
              ? formatDuration(avgDurationMinutes)
              : "–"}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5">
            Promedio
          </div>
        </div>

        {/* Días en rango */}
        <div className="text-center">
          <div
            className={cn(
              "text-2xl font-bold",
              daysInIdealRange >= 5
                ? "text-score-excellent"
                : daysInIdealRange >= 3
                ? "text-score-good"
                : daysInIdealRange >= 1
                ? "text-score-average"
                : "text-[var(--text-muted)]"
            )}
          >
            {totalDays > 0 ? `${daysInIdealRange}/7` : "–"}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5">
            7–9h ideales
          </div>
        </div>

        {/* Calidad Garmin */}
        <div className="text-center">
          <div
            className={cn(
              "text-2xl font-bold",
              avgGarminScore === null
                ? "text-[var(--text-muted)]"
                : avgGarminScore >= 75
                ? "text-score-excellent"
                : avgGarminScore >= 60
                ? "text-score-good"
                : "text-score-average"
            )}
          >
            {avgGarminScore !== null ? `${avgGarminScore}` : "–"}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5">
            Calidad Garmin
          </div>
        </div>

        {/* Racha */}
        <div className="text-center">
          <div
            className={cn(
              "text-2xl font-bold",
              streak >= 7
                ? "text-score-excellent"
                : streak >= 4
                ? "text-score-good"
                : streak >= 2
                ? "text-score-average"
                : "text-[var(--text-muted)]"
            )}
          >
            {streak > 0 ? `${streak}🔥` : "–"}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5">Racha</div>
        </div>
      </div>

      {/* Mini barra de días en rango */}
      {totalDays > 0 && (
        <div className="mt-4 space-y-1">
          <div className="flex justify-between text-xs text-[var(--text-muted)]">
            <span>Días en rango (6–10h)</span>
            <span>
              {daysInRange}/{totalDays}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--surface-alt)]">
            <div
              className="h-full rounded-full bg-module-sleep transition-all duration-500"
              style={{ width: `${(daysInRange / 7) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

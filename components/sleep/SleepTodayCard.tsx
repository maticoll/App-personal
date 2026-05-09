"use client";

// ============================================================
// SleepTodayCard — Card del sueño de hoy (o de anoche)
// Muestra duración, calidad, fases y datos Garmin
// ============================================================

import { Moon, Clock, TrendingUp, Droplets, Wind } from "lucide-react";
import { cn, formatDuration, formatTime } from "@/lib/utils";
import type { SleepLogEntry } from "@/lib/sleep";

type Props = {
  log: SleepLogEntry;
};

const SLEEP_PHASES = [
  {
    key: "deepSleepMinutes" as const,
    label: "Profundo",
    color: "bg-violet-600",
    textColor: "text-violet-400",
  },
  {
    key: "remSleepMinutes" as const,
    label: "REM",
    color: "bg-blue-500",
    textColor: "text-blue-400",
  },
  {
    key: "lightSleepMinutes" as const,
    label: "Ligero",
    color: "bg-sky-400",
    textColor: "text-sky-400",
  },
  {
    key: "awakeMinutes" as const,
    label: "Despierto",
    color: "bg-gray-500",
    textColor: "text-gray-400",
  },
];

function getQualityLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "Excelente", color: "text-score-excellent" };
  if (score >= 65) return { label: "Bueno", color: "text-score-good" };
  if (score >= 50) return { label: "Regular", color: "text-score-average" };
  return { label: "Insuficiente", color: "text-score-bad" };
}

function getDurationLabel(minutes: number): { label: string; color: string } {
  const h = minutes / 60;
  if (h >= 7 && h <= 9) return { label: "Ideal", color: "text-score-excellent" };
  if (h >= 6 && h <= 10) return { label: "Aceptable", color: "text-score-good" };
  return { label: "Fuera de rango", color: "text-score-bad" };
}

export function SleepTodayCard({ log }: Props) {
  const hasGarmin =
    log.garminScore !== null ||
    log.deepSleepMinutes !== null;
  const hasBothTimes = !!log.wakeTime;

  const totalPhaseMinutes =
    (log.deepSleepMinutes ?? 0) +
    (log.remSleepMinutes ?? 0) +
    (log.lightSleepMinutes ?? 0) +
    (log.awakeMinutes ?? 0);

  return (
    <div className="card space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Moon className="w-4 h-4 text-module-sleep" />
            <span className="text-sm font-medium text-[var(--text-secondary)]">
              Sueño de anoche
            </span>
          </div>
          {log.durationMinutes ? (
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-[var(--text-primary)]">
                {formatDuration(log.durationMinutes)}
              </span>
              <span
                className={cn(
                  "text-sm font-medium",
                  getDurationLabel(log.durationMinutes).color
                )}
              >
                {getDurationLabel(log.durationMinutes).label}
              </span>
            </div>
          ) : (
            <span className="text-sm text-[var(--text-muted)]">
              Sin hora de despertar
            </span>
          )}
        </div>

        {/* Garmin Score */}
        {log.garminScore !== null && (
          <div className="text-right">
            <div className="text-2xl font-bold text-module-sleep">
              {log.garminScore}
            </div>
            <div
              className={cn(
                "text-xs font-medium",
                getQualityLabel(log.garminScore).color
              )}
            >
              {getQualityLabel(log.garminScore).label}
            </div>
            <div className="text-xs text-[var(--text-muted)]">Garmin</div>
          </div>
        )}
      </div>

      {/* Horarios */}
      {hasBothTimes && (
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-module-sleep" />
            <span className="text-[var(--text-muted)]">Dormiste</span>
            <span className="font-semibold text-[var(--text-primary)]">
              {formatTime(log.bedTime)}
            </span>
          </div>
          <div className="flex-1 border-t border-dashed border-[var(--border)]" />
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-[var(--text-muted)]">Desperté</span>
            <span className="font-semibold text-[var(--text-primary)]">
              {formatTime(log.wakeTime!)}
            </span>
          </div>
        </div>
      )}

      {/* Fases de sueño (si hay datos Garmin) */}
      {hasGarmin && totalPhaseMinutes > 0 && (
        <div className="space-y-2">
          {/* Barra de fases */}
          <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
            {SLEEP_PHASES.map((phase) => {
              const mins = log[phase.key] ?? 0;
              if (mins === 0) return null;
              const pct = (mins / totalPhaseMinutes) * 100;
              return (
                <div
                  key={phase.key}
                  className={cn("h-full rounded-sm", phase.color)}
                  style={{ width: `${pct}%` }}
                  title={`${phase.label}: ${formatDuration(mins)}`}
                />
              );
            })}
          </div>

          {/* Leyenda de fases */}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {SLEEP_PHASES.map((phase) => {
              const mins = log[phase.key] ?? 0;
              if (mins === 0) return null;
              return (
                <div
                  key={phase.key}
                  className="flex items-center gap-1 text-xs"
                >
                  <div
                    className={cn("w-2 h-2 rounded-full", phase.color)}
                  />
                  <span className="text-[var(--text-muted)]">
                    {phase.label}
                  </span>
                  <span className={cn("font-medium", phase.textColor)}>
                    {formatDuration(mins)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Extra stats (Garmin) */}
      {hasGarmin && (
        <div className="flex gap-4 pt-1 border-t border-[var(--border)]">
          {log.spo2Avg !== null && (
            <div className="flex items-center gap-1.5 text-xs">
              <Droplets className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[var(--text-muted)]">SpO2</span>
              <span className="font-semibold text-[var(--text-primary)]">
                {log.spo2Avg.toFixed(0)}%
              </span>
            </div>
          )}
          {log.respirationAvg !== null && (
            <div className="flex items-center gap-1.5 text-xs">
              <Wind className="w-3.5 h-3.5 text-teal-400" />
              <span className="text-[var(--text-muted)]">Resp.</span>
              <span className="font-semibold text-[var(--text-primary)]">
                {log.respirationAvg.toFixed(1)}{" "}
                <span className="font-normal text-[var(--text-muted)]">
                  resp/min
                </span>
              </span>
            </div>
          )}
          {log.bodyBatteryChange !== null && (
            <div className="flex items-center gap-1.5 text-xs">
              <TrendingUp className="w-3.5 h-3.5 text-green-400" />
              <span className="text-[var(--text-muted)]">Body Battery</span>
              <span
                className={cn(
                  "font-semibold",
                  log.bodyBatteryChange > 0
                    ? "text-score-excellent"
                    : "text-score-bad"
                )}
              >
                {log.bodyBatteryChange > 0 ? "+" : ""}
                {log.bodyBatteryChange}
              </span>
            </div>
          )}
          {log.stressScore !== null && (
            <div className="flex items-center gap-1.5 text-xs">
              <Clock className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-[var(--text-muted)]">Estrés</span>
              <span className="font-semibold text-[var(--text-primary)]">
                {log.stressScore}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      {log.notes && (
        <p className="text-xs text-[var(--text-muted)] italic border-t border-[var(--border)] pt-2">
          {log.notes}
        </p>
      )}
    </div>
  );
}

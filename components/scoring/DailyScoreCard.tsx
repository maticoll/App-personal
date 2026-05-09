"use client";

// ============================================================
// DailyScoreCard — Card de un día específico en el historial
// Muestra: fecha, score global, mini barras por módulo
// Sesión 2 — Dashboard + Scoring
// ============================================================

import { Moon, Dumbbell, Salad, FolderKanban } from "lucide-react";
import { cn, getScoreColor, getScoreBgColor, formatDate } from "@/lib/utils";
import type { HistoricalScoreEntry } from "@/lib/scoring";

interface DailyScoreCardProps {
  entry: HistoricalScoreEntry;
}

const MODULES = [
  { key: "sleep" as const, icon: Moon, color: "text-module-sleep", label: "Sueño" },
  { key: "fitness" as const, icon: Dumbbell, color: "text-module-fitness", label: "Fitness" },
  { key: "nutrition" as const, icon: Salad, color: "text-module-nutrition", label: "Nutrición" },
  { key: "projects" as const, icon: FolderKanban, color: "text-module-projects", label: "Proyectos" },
] as const;

export function DailyScoreCard({ entry }: DailyScoreCardProps) {
  const global = entry.global ?? 0;
  const dateLabel = formatDate(new Date(entry.date));

  return (
    <div className="card space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--text-secondary)] capitalize">
          {dateLabel}
        </span>
        {entry.global !== null ? (
          <span className={cn("text-lg font-bold", getScoreColor(global))}>
            {global}
            <span className="text-xs text-[var(--text-muted)] font-normal">/100</span>
          </span>
        ) : (
          <span className="text-sm text-[var(--text-muted)]">Sin datos</span>
        )}
      </div>

      {/* Mini barras por módulo */}
      <div className="space-y-2">
        {MODULES.map(({ key, icon: Icon, color, label }) => {
          const score = entry[key];
          return (
            <div key={key} className="flex items-center gap-2">
              <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", color)} />
              <span className="text-xs text-[var(--text-muted)] w-16 flex-shrink-0">
                {label}
              </span>
              <div className="flex-1 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                {score !== null ? (
                  <div
                    className={cn("h-full rounded-full", getScoreBgColor(score))}
                    style={{ width: `${score}%` }}
                  />
                ) : (
                  <div className="h-full w-full" />
                )}
              </div>
              {score !== null ? (
                <span className={cn("text-xs font-medium w-6 text-right", getScoreColor(score))}>
                  {score}
                </span>
              ) : (
                <span className="text-xs text-[var(--text-muted)] w-6 text-right">—</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

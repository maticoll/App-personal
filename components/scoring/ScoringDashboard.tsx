"use client";

// ============================================================
// ScoringDashboard — Componente completo de scoring para el dashboard
// Muestra: anillo global + cards por módulo con desplegables
// Se carga en la página / (Server Component llama a la API, pasa datos)
// Sesión 2 — Dashboard + Scoring
// ============================================================

import { Moon, Dumbbell, Salad, FolderKanban } from "lucide-react";
import { GlobalScoreRing } from "./GlobalScoreRing";
import { ScoreCardModule } from "./ScoreCardModule";
import { cn } from "@/lib/utils";
import type { DailyScoreData } from "@/lib/types";

interface ScoringDashboardProps {
  todayScore: DailyScoreData | null;
}

const MODULE_CONFIG = [
  {
    key: "sleep" as const,
    label: "Sueño",
    icon: Moon,
    color: "text-module-sleep",
    bgColor: "bg-purple-500/10",
  },
  {
    key: "fitness" as const,
    label: "Fitness",
    icon: Dumbbell,
    color: "text-module-fitness",
    bgColor: "bg-cyan-500/10",
  },
  {
    key: "nutrition" as const,
    label: "Nutrición",
    icon: Salad,
    color: "text-module-nutrition",
    bgColor: "bg-emerald-500/10",
  },
  {
    key: "projects" as const,
    label: "Proyectos",
    icon: FolderKanban,
    color: "text-module-projects",
    bgColor: "bg-amber-500/10",
  },
];

export function ScoringDashboard({ todayScore }: ScoringDashboardProps) {
  const global = todayScore?.global ?? null;
  const details = todayScore?.details;

  return (
    <div className="space-y-4">
      {/* ─── Mobile: score inline + lista con barras ─────────── */}
      <div className="block md:hidden space-y-3">
        {/* Score inline */}
        <div className="flex items-center gap-4 p-3 bg-[var(--surface-hover)] rounded-2xl">
          <GlobalScoreRing score={global} size="sm" />
          <div>
            <div className="text-3xl font-bold text-[var(--text-primary)] leading-none">
              {global !== null ? global : "—"}
              <span className="text-sm font-normal text-[var(--text-secondary)] ml-1">/100</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {global === null
                ? "Sin datos aún"
                : global >= 80
                ? "Excelente día 💪"
                : global >= 60
                ? "Buen ritmo"
                : "Podés mejorar"}
            </p>
          </div>
        </div>

        {/* Lista de módulos con barras */}
        <div className="space-y-2">
          {MODULE_CONFIG.map(({ key, label, icon: Icon, color, bgColor }) => {
            const score =
              key === "sleep"
                ? todayScore?.sleep
                : key === "fitness"
                ? todayScore?.fitness
                : key === "nutrition"
                ? todayScore?.nutrition
                : todayScore?.projects;

            const s = score ?? null;

            return (
              <div key={key} className="flex items-center gap-3 py-1">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", bgColor)}>
                  <Icon className={cn("w-4 h-4", color)} />
                </div>
                <span className="text-sm text-[var(--text-secondary)] w-20 shrink-0">{label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-[var(--surface-alt)] overflow-hidden">
                  {s !== null && (
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${s}%`,
                        background: `hsl(${s * 1.2}, 65%, 50%)`,
                      }}
                    />
                  )}
                </div>
                <span className="text-sm font-semibold text-[var(--text-primary)] w-8 text-right shrink-0">
                  {s !== null ? s : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Desktop: anillo grande + cards expandibles ──────── */}
      <div className="hidden md:block space-y-4">
        <div className="flex justify-center py-2">
          <GlobalScoreRing score={global} size="lg" />
        </div>
        <div className="space-y-2">
          {MODULE_CONFIG.map(({ key, label, icon, color, bgColor }) => {
            const score =
              key === "sleep"
                ? todayScore?.sleep
                : key === "fitness"
                ? todayScore?.fitness
                : key === "nutrition"
                ? todayScore?.nutrition
                : todayScore?.projects;

            const moduleDetails = details?.[key];

            return (
              <ScoreCardModule
                key={key}
                label={label}
                icon={icon}
                score={score ?? null}
                color={color}
                bgColor={bgColor}
                met={moduleDetails?.met ?? []}
                missed={moduleDetails?.missed ?? []}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

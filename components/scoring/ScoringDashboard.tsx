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
      {/* Anillo global */}
      <div className="flex justify-center py-2">
        <GlobalScoreRing score={global} size="lg" />
      </div>

      {/* Cards por módulo */}
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
  );
}

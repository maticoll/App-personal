"use client";

// ============================================================
// ScoreCardModule — Card de score por módulo con desplegable
// Muestra: barra de progreso + lista de qué se cumplió/no cumplió
// Sesión 2 — Dashboard + Scoring
// ============================================================

import { useState } from "react";
import { ChevronDown, CheckCircle2, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn, getScoreColor } from "@/lib/utils";
import { ScoreBar } from "@/components/ui/ScoreBar";

export interface ModuleScoreCardProps {
  label: string;
  icon: LucideIcon;
  score: number | null;
  color: string;        // CSS class: "text-module-sleep"
  bgColor: string;      // CSS class: "bg-purple-500/10"
  met?: string[];
  missed?: string[];
  defaultExpanded?: boolean;
}

export function ScoreCardModule({
  label,
  icon: Icon,
  score,
  color,
  bgColor,
  met = [],
  missed = [],
  defaultExpanded = false,
}: ModuleScoreCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasDetails = met.length > 0 || missed.length > 0;
  const hasScore = score !== null;

  return (
    <div className="card p-0 overflow-hidden">
      {/* Header — siempre visible */}
      <button
        className={cn(
          "w-full flex items-center gap-3 p-4 text-left transition-colors",
          hasDetails && "hover:bg-[var(--surface-hover)]"
        )}
        onClick={() => hasDetails && setExpanded((v) => !v)}
        disabled={!hasDetails}
        aria-expanded={expanded}
      >
        {/* Ícono del módulo */}
        <div
          className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
            bgColor
          )}
        >
          <Icon className={cn("w-4 h-4", color)} />
        </div>

        {/* Nombre + barra */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {label}
            </span>
            {hasScore ? (
              <span className={cn("text-sm font-bold", getScoreColor(score!))}>
                {score}
                <span className="text-[var(--text-muted)] font-normal text-xs">/100</span>
              </span>
            ) : (
              <span className="text-xs text-[var(--text-muted)]">Sin datos</span>
            )}
          </div>
          <ScoreBar score={score} showValue={false} size="sm" />
        </div>

        {/* Chevron si hay detalle */}
        {hasDetails && (
          <ChevronDown
            className={cn(
              "w-4 h-4 text-[var(--text-muted)] flex-shrink-0 transition-transform duration-200",
              expanded && "rotate-180"
            )}
          />
        )}
      </button>

      {/* Detalle desplegable */}
      {hasDetails && (
        <div
          className={cn(
            "overflow-hidden transition-all duration-300 ease-in-out",
            expanded ? "max-h-96" : "max-h-0"
          )}
        >
          <div className="px-4 pb-4 space-y-2 border-t border-[var(--border)] pt-3">
            {/* Items cumplidos */}
            {met.map((item, i) => (
              <div key={`met-${i}`} className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-score-excellent flex-shrink-0 mt-0.5" />
                <span className="text-xs text-[var(--text-secondary)]">{item}</span>
              </div>
            ))}

            {/* Items no cumplidos */}
            {missed.map((item, i) => (
              <div key={`missed-${i}`} className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-score-poor flex-shrink-0 mt-0.5" />
                <span className="text-xs text-[var(--text-muted)]">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

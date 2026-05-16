"use client";

// ============================================================
// ModuleSummaryCard — Card de resumen rápido de un módulo
// Para el dashboard principal (/)
// Sesión 2 — Dashboard + Scoring
// ============================================================

import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ScoreBar } from "@/components/ui/ScoreBar";

interface ModuleSummaryCardProps {
  href: string;
  label: string;
  icon: ReactNode;     // JSX ya renderizado — compatible con Server Components
  bgColor: string;     // "bg-purple-500/10"
  score: number | null;
  summary: string;     // Línea de resumen: "7h 30min · Calidad 82"
  badge?: string;      // Badge opcional: "🏋️ Gym"
}

export function ModuleSummaryCard({
  href,
  label,
  icon,
  bgColor,
  score,
  summary,
  badge,
}: ModuleSummaryCardProps) {
  return (
    <Link
      href={href}
      className="card hover:bg-surface-container-high active:scale-[0.98] transition-all duration-150 group block min-h-[56px]"
    >
      {/* Mobile: layout horizontal */}
      <div className="flex items-center gap-3 md:hidden">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", bgColor)}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-on-surface text-sm">{label}</p>
            {badge && (
              <span className="text-xs bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-full shrink-0">
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs text-outline mt-0.5 line-clamp-1">{summary}</p>
          {score !== null && (
            <div className="mt-1.5 h-1 rounded-full bg-surface-container-high overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${score}%`,
                  background: `hsl(${score * 1.2}, 65%, 50%)`,
                }}
              />
            </div>
          )}
        </div>
        {score !== null && (
          <span className="text-sm font-bold text-on-surface shrink-0 w-8 text-right">
            {score}
          </span>
        )}
      </div>

      {/* Desktop: layout vertical (original) */}
      <div className="hidden md:block space-y-3">
        <div className="flex items-start justify-between">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", bgColor)}>
            {icon}
          </div>
          {badge && (
            <span className="text-xs bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-full">
              {badge}
            </span>
          )}
        </div>
        <div>
          <p className="font-medium text-on-surface text-sm">{label}</p>
          <p className="text-xs text-outline mt-0.5 line-clamp-1">{summary}</p>
        </div>
        {score !== null && (
          <ScoreBar score={score} size="sm" showValue={false} />
        )}
      </div>
    </Link>
  );
}

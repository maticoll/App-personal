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
      className="card hover:bg-[var(--surface-hover)] active:scale-[0.98] transition-all duration-150 group block"
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", bgColor)}>
            {icon}
          </div>
          {badge && (
            <span className="text-xs bg-[var(--surface-hover)] text-[var(--text-secondary)] px-2 py-0.5 rounded-full">
              {badge}
            </span>
          )}
        </div>

        {/* Nombre */}
        <div>
          <p className="font-medium text-[var(--text-primary)] text-sm">{label}</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-1">{summary}</p>
        </div>

        {/* Barra de score */}
        {score !== null && (
          <ScoreBar score={score} size="sm" showValue={false} />
        )}
      </div>
    </Link>
  );
}

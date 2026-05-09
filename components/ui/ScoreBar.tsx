"use client";

// ============================================================
// ScoreBar — Barra de progreso de scoring
// TODO: Sesión 2 — animaciones y lógica de score real
// ============================================================

import { cn, getScoreBgColor } from "@/lib/utils";

interface ScoreBarProps {
  score: number | null | undefined;
  label?: string;
  showValue?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ScoreBar({
  score,
  label,
  showValue = true,
  size = "md",
  className,
}: ScoreBarProps) {
  const value = score ?? 0;
  const colorClass = getScoreBgColor(value);

  const heights = {
    sm: "h-1.5",
    md: "h-2",
    lg: "h-3",
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {(label || showValue) && (
        <div className="flex justify-between items-center">
          {label && (
            <span className="text-sm font-medium text-[var(--text-secondary)]">
              {label}
            </span>
          )}
          {showValue && (
            <span className="text-sm font-bold text-[var(--text-primary)]">
              {value}
              <span className="text-[var(--text-muted)] font-normal text-xs">/100</span>
            </span>
          )}
        </div>
      )}
      <div className={cn("score-bar-track w-full", heights[size])}>
        <div
          className={cn("h-full rounded-full transition-all duration-700", colorClass)}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

"use client";

// ============================================================
// PeriodSelector — Tabs para cambiar entre vistas de scoring
// Sesión 2 — Dashboard + Scoring
// ============================================================

import { cn } from "@/lib/utils";

export type Period = "daily" | "weekly" | "monthly";

const PERIODS: { value: Period; label: string }[] = [
  { value: "daily", label: "Diario" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensual" },
];

interface PeriodSelectorProps {
  value: Period;
  onChange: (period: Period) => void;
  className?: string;
}

export function PeriodSelector({
  value,
  onChange,
  className,
}: PeriodSelectorProps) {
  return (
    <div
      className={cn(
        "flex gap-1 bg-surface-container border border-outline-variant/20 rounded-xl p-1",
        className
      )}
    >
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={cn(
            "flex-1 text-sm font-medium px-3 py-1.5 rounded-lg transition-all duration-200",
            value === p.value
              ? "bg-primary text-on-primary shadow-sm"
              : "text-outline hover:text-on-surface-variant hover:bg-surface-container-high"
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

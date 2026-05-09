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
        "flex gap-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-1",
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
              ? "bg-accent text-white shadow-sm"
              : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

"use client";

// ============================================================
// ModuleToggle — Selector de módulos para el gráfico de tendencia
// Sesión 2 — Dashboard + Scoring
// ============================================================

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type ModuleKey = "sleep" | "fitness" | "nutrition" | "projects";

const MODULE_CONFIG: {
  key: ModuleKey;
  label: string;
  color: string;
  border: string;
}[] = [
  { key: "sleep", label: "Sueño", color: "bg-purple-500", border: "border-purple-500/50" },
  { key: "fitness", label: "Fitness", color: "bg-cyan-500", border: "border-cyan-500/50" },
  { key: "nutrition", label: "Nutrición", color: "bg-emerald-500", border: "border-emerald-500/50" },
  { key: "projects", label: "Proyectos", color: "bg-amber-500", border: "border-amber-500/50" },
];

interface ModuleToggleProps {
  active: ModuleKey[];
  onChange: (active: ModuleKey[]) => void;
  className?: string;
}

export function ModuleToggle({ active, onChange, className }: ModuleToggleProps) {
  const toggle = (key: ModuleKey) => {
    if (active.includes(key)) {
      onChange(active.filter((k) => k !== key));
    } else {
      onChange([...active, key]);
    }
  };

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {MODULE_CONFIG.map(({ key, label, color, border }) => {
        const isActive = active.includes(key);
        return (
          <button
            key={key}
            onClick={() => toggle(key)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all duration-150",
              isActive
                ? `${border} bg-surface-container-high text-on-surface`
                : "border-outline-variant/30 text-outline hover:border-outline"
            )}
          >
            <span className={cn("w-2 h-2 rounded-full", isActive ? color : "bg-outline-variant")} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

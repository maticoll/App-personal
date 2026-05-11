"use client";

import type { WeeklyProjectStats } from "@/lib/projects";

type Props = {
  stats: WeeklyProjectStats;
};

export default function WeeklyProjectStats({ stats }: Props) {
  const cards = [
    { label: "Proyectos activos", value: stats.activeProjects, icon: "🚀", color: "text-amber-400" },
    { label: "Tareas esta semana", value: stats.tasksCompleted, icon: "✅", color: "text-green-400" },
    { label: "Proyectos avanzados", value: stats.projectsAdvanced, icon: "📈", color: "text-blue-400" },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map((card) => (
        <div key={card.label} className="card p-3 text-center">
          <div className="text-2xl mb-1">{card.icon}</div>
          <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5 leading-tight">{card.label}</div>
        </div>
      ))}
    </div>
  );
}

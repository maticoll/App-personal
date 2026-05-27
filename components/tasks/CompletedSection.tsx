"use client";

import { useState } from "react";
import type { TaskItem, TaskPeriod } from "@/lib/tasks";

const PERIOD_LABELS: Record<TaskPeriod, string> = {
  this_week: "Esta semana",
  last_week: "Semana pasada",
  this_month: "Este mes",
  all: "Todo",
};

const PERIODS: TaskPeriod[] = ["this_week", "last_week", "this_month", "all"];

type Props = {
  initialTasks: TaskItem[];
  initialPeriod?: TaskPeriod;
};

export default function CompletedSection({
  initialTasks,
  initialPeriod = "this_week",
}: Props) {
  const [period, setPeriod] = useState<TaskPeriod>(initialPeriod);
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks);
  const [loading, setLoading] = useState(false);

  async function changePeriod(p: TaskPeriod) {
    setPeriod(p);
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks?view=completed&period=${p}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  function formatDate(date: Date | string) {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return "Hoy";
    if (d.toDateString() === yesterday.toDateString()) return "Ayer";
    return d.toLocaleDateString("es-UY", { day: "numeric", month: "short" });
  }

  return (
    <div className="space-y-3">
      {/* Filtros de período */}
      <div className="flex gap-1.5 flex-wrap">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => changePeriod(p)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              period === p
                ? "bg-amber-500/10 border-amber-500/40 text-amber-400"
                : "border-outline-variant/30 text-outline hover:border-outline hover:text-on-surface-variant"
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="card p-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-surface-container-high rounded animate-pulse" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-on-surface-variant">
            Sin tareas terminadas en este período
          </p>
        </div>
      ) : (
        <div className="card divide-y divide-outline-variant/20">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-start gap-3 py-2.5 px-3">
              {/* Check icono */}
              <div className="mt-0.5 w-5 h-5 rounded-full bg-green-500/10 border border-green-500/30 shrink-0 flex items-center justify-center">
                <svg className="w-3 h-3 text-green-500" fill="none" viewBox="0 0 12 12">
                  <path
                    d="M2 6l3 3 5-5"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              {/* Título + meta */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-on-surface-variant line-through leading-snug truncate">
                  {task.title}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs text-outline">{task.projectName}</span>
                  {task.source === "notion" && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                      Notion
                    </span>
                  )}
                </div>
              </div>

              {/* Fecha completada */}
              <span className="text-xs text-outline shrink-0 pt-0.5">
                {formatDate(task.updatedAt)}
              </span>
            </div>
          ))}
        </div>
      )}

      {tasks.length > 0 && (
        <p className="text-xs text-outline text-right">
          {tasks.length} tarea{tasks.length !== 1 ? "s" : ""} terminada{tasks.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

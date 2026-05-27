"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { TaskItem, TaskPeriod } from "@/lib/tasks";
import type { ProjectWithTasks } from "@/lib/projects";
import type { WeeklyProjectStats } from "@/lib/projects";
import ThisWeekSection from "./ThisWeekSection";
import CompletedSection from "./CompletedSection";
import NotionSyncButton from "@/components/projects/NotionSyncButton";
import TimelineView from "@/components/projects/TimelineView";

// Kanban requiere SSR desactivado por @hello-pangea/dnd
const KanbanBoard = dynamic(() => import("@/components/projects/KanbanBoard"), {
  ssr: false,
  loading: () => (
    <div className="h-64 bg-surface-container-high rounded-2xl animate-pulse" />
  ),
});

type BoardTab = "kanban" | "timeline";

type Props = {
  initialTasks: TaskItem[];
  initialCompletedTasks: TaskItem[];
  initialProjects: ProjectWithTasks[];
  initialStats: WeeklyProjectStats;
};

export default function TasksPageClient({
  initialTasks,
  initialCompletedTasks,
  initialProjects,
  initialStats,
}: Props) {
  const [boardTab, setBoardTab] = useState<BoardTab>("kanban");
  const [projects, setProjects] = useState<ProjectWithTasks[]>(initialProjects);

  const pendingCount = initialTasks.filter((t) => !t.done).length;

  async function refreshProjects() {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const d = await res.json();
        setProjects(d.projects ?? []);
      }
    } catch { /* silently */ }
  }

  return (
    <div className="space-y-8">

      {/* ── Sección A: Tareas pendientes ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-outline uppercase tracking-widest">
            Pendientes
          </p>
          {pendingCount > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">
              {pendingCount}
            </span>
          )}
        </div>
        <ThisWeekSection initialTasks={initialTasks} />
      </section>

      {/* ── Sección B: Tablero (Kanban / Timeline) ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-outline uppercase tracking-widest">
            Tablero
          </p>
          <div className="flex items-center gap-2">
            <NotionSyncButton onSynced={refreshProjects} />
            <div className="flex gap-1 bg-surface-container-high rounded-xl p-1">
              {(["kanban", "timeline"] as BoardTab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setBoardTab(t)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors capitalize ${
                    boardTab === t
                      ? "bg-surface-container text-on-surface shadow-sm"
                      : "text-outline hover:text-on-surface-variant"
                  }`}
                >
                  {t === "kanban" ? "Kanban" : "Timeline"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {boardTab === "kanban" && (
          <KanbanBoard
            projects={projects}
            onProjectsChange={setProjects}
            onRefresh={refreshProjects}
          />
        )}
        {boardTab === "timeline" && (
          <TimelineView projects={projects} onRefresh={refreshProjects} />
        )}
      </section>

      {/* ── Sección C: Tareas terminadas ── */}
      <section>
        <div className="mb-3">
          <p className="text-xs text-outline uppercase tracking-widest">
            Tareas terminadas
          </p>
        </div>
        <CompletedSection
          initialTasks={initialCompletedTasks}
          initialPeriod={"this_week" as TaskPeriod}
        />
      </section>
    </div>
  );
}

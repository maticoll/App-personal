"use client";

import { useState, useCallback } from "react";
import type { ProjectWithTasks, WeeklyProjectStats } from "@/lib/projects";
import KanbanBoard from "./KanbanBoard";
import TimelineView from "./TimelineView";
import NotionSyncButton from "./NotionSyncButton";
import ProjectsQuickActions from "./ProjectsQuickActions";
import WeeklyProjectStatsComponent from "./WeeklyProjectStats";

type Tab = "kanban" | "timeline";

type Props = {
  initialProjects: ProjectWithTasks[];
  initialStats: WeeklyProjectStats;
};

export default function ProjectsModuleClient({ initialProjects, initialStats }: Props) {
  const [tab, setTab] = useState<Tab>("kanban");
  const [projects, setProjects] = useState<ProjectWithTasks[]>(initialProjects);
  const [stats, setStats] = useState<WeeklyProjectStats>(initialStats);

  const refreshAll = useCallback(async () => {
    try {
      const [projectsRes, statsRes] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/projects/weekly-stats"),
      ]);
      if (projectsRes.ok) {
        const d = await projectsRes.json();
        setProjects(d.projects ?? []);
      }
      if (statsRes.ok) {
        const d = await statsRes.json();
        setStats(d.stats ?? { projectsAdvanced: 0, tasksCompleted: 0, activeProjects: 0 });
      }
    } catch { /* silently fail */ }
  }, []);

  const TABS: { id: Tab; label: string }[] = [
    { id: "kanban", label: "Kanban" },
    { id: "timeline", label: "Timeline" },
  ];

  return (
    <div className="space-y-4">
      <WeeklyProjectStatsComponent stats={stats} />

      <div className="flex items-center gap-3">
        <div className="flex gap-1 bg-surface-container-high rounded-xl p-1 flex-1">
          {TABS.map((t) => (
            <button
              key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? "bg-surface-container text-on-surface shadow-sm" : "text-outline hover:text-on-surface-variant"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <NotionSyncButton onSynced={refreshAll} />
      </div>

      {tab === "kanban" && <KanbanBoard projects={projects} onProjectsChange={setProjects} onRefresh={refreshAll} />}
      {tab === "timeline" && <TimelineView projects={projects} onRefresh={refreshAll} />}

      <ProjectsQuickActions onCreated={refreshAll} />
    </div>
  );
}

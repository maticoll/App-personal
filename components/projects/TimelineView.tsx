"use client";

import { useState } from "react";
import { Calendar } from "lucide-react";
import type { ProjectWithTasks } from "@/lib/projects";
import { STATUS_COLORS, STATUS_LABELS } from "./ProjectCard";
import ProjectDetail from "./ProjectDetail";

type Props = {
  projects: ProjectWithTasks[];
  onRefresh: () => void;
};

export default function TimelineView({ projects, onRefresh }: Props) {
  const [selectedProject, setSelectedProject] = useState<ProjectWithTasks | null>(null);

  const withDeadline = projects
    .filter((p) => p.deadline && p.status !== "ARCHIVED")
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime());

  const withoutDeadline = projects.filter((p) => !p.deadline && p.status !== "ARCHIVED");

  function getTimeProgress(project: ProjectWithTasks): number {
    if (!project.deadline) return 0;
    const start = project.createdAt.getTime();
    const end = new Date(project.deadline).getTime();
    const now = Date.now();
    if (now >= end) return 100;
    if (now <= start) return 0;
    return Math.round(((now - start) / (end - start)) * 100);
  }

  function isOverdue(project: ProjectWithTasks): boolean {
    return !!project.deadline && new Date(project.deadline) < new Date() && project.status !== "DONE";
  }

  function formatDate(date: Date) {
    return new Date(date).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
  }

  const allItems = [...withDeadline, ...withoutDeadline];

  return (
    <>
      <div className="space-y-3">
        {allItems.map((project) => {
          const progress = getTimeProgress(project);
          const overdue = isOverdue(project);
          const taskProgress = project.tasks.length > 0
            ? Math.round((project.tasks.filter((t) => t.done).length / project.tasks.length) * 100)
            : 0;

          return (
            <div key={project.id} onClick={() => setSelectedProject(project)} className="card p-4 cursor-pointer hover:border-amber-500/30 transition-all">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-on-surface truncate">{project.title}</span>
                    {project.notionId && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 flex-shrink-0">Notion</span>
                    )}
                  </div>
                  {project.description && (
                    <p className="text-xs text-outline mt-0.5 line-clamp-1">{project.description}</p>
                  )}
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLORS[project.status]}`}>
                  {STATUS_LABELS[project.status]}
                </span>
              </div>

              {project.deadline ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className={`flex items-center gap-1 ${overdue ? "text-red-400" : "text-outline"}`}>
                      <Calendar className="w-3 h-3" />
                      {overdue ? "Vencido: " : "Deadline: "}{formatDate(project.deadline)}
                    </div>
                    <span className="text-outline">Tiempo: {progress}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-container-high overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${overdue ? "bg-red-500" : progress > 75 ? "bg-orange-500" : "bg-amber-500"}`} style={{ width: `${Math.min(progress, 100)}%` }} />
                  </div>
                  {project.tasks.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 rounded-full bg-surface-container-high">
                        <div className="h-full rounded-full bg-green-500" style={{ width: `${taskProgress}%` }} />
                      </div>
                      <span className="text-[10px] text-outline flex-shrink-0">
                        {project.tasks.filter((t) => t.done).length}/{project.tasks.length} tareas
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-outline italic">
                  Sin fecha límite{project.tasks.length > 0 && ` · ${project.tasks.filter((t) => t.done).length}/${project.tasks.length} tareas`}
                </div>
              )}
            </div>
          );
        })}
        {allItems.length === 0 && (
          <div className="text-center py-12 text-outline">
            <p className="text-sm">Sin proyectos activos</p>
            <p className="text-xs mt-1">Creá tu primer proyecto con el botón +</p>
          </div>
        )}
      </div>

      {selectedProject && (
        <ProjectDetail
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onUpdated={onRefresh}
          onDeleted={(_id) => { setSelectedProject(null); onRefresh(); }}
        />
      )}
    </>
  );
}

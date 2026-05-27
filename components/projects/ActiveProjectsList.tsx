"use client";

import { useState } from "react";
import type { ProjectWithTasks } from "@/lib/projects";
import ProjectCard, { STATUS_LABELS, STATUS_COLORS } from "./ProjectCard";
import ProjectDetail from "./ProjectDetail";
import ProjectsQuickActions from "./ProjectsQuickActions";

type Props = {
  initialProjects: ProjectWithTasks[];
};

export default function ActiveProjectsList({ initialProjects }: Props) {
  const [projects, setProjects] = useState<ProjectWithTasks[]>(initialProjects);
  const [selected, setSelected] = useState<ProjectWithTasks | null>(null);

  async function refresh() {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const d = await res.json();
        const all: ProjectWithTasks[] = d.projects ?? [];
        setProjects(all.filter((p) => p.status === "TODO" || p.status === "IN_PROGRESS"));
      }
    } catch { /* silently */ }
  }

  if (projects.length === 0) {
    return (
      <div className="space-y-4">
        <div className="card p-8 text-center">
          <p className="text-3xl mb-2">📁</p>
          <p className="text-sm text-on-surface-variant mb-1">Sin proyectos activos</p>
          <p className="text-xs text-outline">Creá uno con el botón de abajo</p>
        </div>
        <ProjectsQuickActions onCreated={refresh} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats rápidos */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-3 text-center">
          <div className="text-2xl font-bold text-amber-400">{projects.length}</div>
          <div className="text-xs text-outline mt-0.5">Proyectos activos</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-2xl font-bold text-primary">
            {projects.reduce((acc, p) => acc + p.tasks.filter((t) => !t.done).length, 0)}
          </div>
          <div className="text-xs text-outline mt-0.5">Tareas pendientes</div>
        </div>
      </div>

      {/* Lista de proyectos */}
      <div className="space-y-2">
        {projects.map((project) => {
          const pending = project.tasks.filter((t) => !t.done).length;
          const total = project.tasks.length;
          const progress = total > 0 ? Math.round(((total - pending) / total) * 100) : 0;

          return (
            <button
              key={project.id}
              onClick={() => setSelected(project)}
              className="card p-4 w-full text-left hover:bg-surface-container-high transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {/* Color dot */}
                    {project.color && (
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: project.color }}
                      />
                    )}
                    <p className="text-sm font-medium text-on-surface truncate">
                      {project.title}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[project.status]}`}
                    >
                      {STATUS_LABELS[project.status]}
                    </span>
                    {project.notionId && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 font-semibold">
                        Notion
                      </span>
                    )}
                    <span className="text-xs text-outline">
                      {pending > 0 ? `${pending} pendiente${pending !== 1 ? "s" : ""}` : "Todo listo"}
                    </span>
                  </div>
                </div>

                {/* Progreso */}
                {total > 0 && (
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold text-on-surface">{progress}%</p>
                    <div className="w-16 h-1.5 bg-surface-container-highest rounded-full mt-1">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Crear nuevo proyecto */}
      <ProjectsQuickActions onCreated={refresh} />

      {/* Modal de detalle */}
      {selected && (
        <ProjectDetail
          project={selected}
          onClose={() => setSelected(null)}
          onUpdated={async () => {
            await refresh();
            setSelected(null);
          }}
          onDeleted={(id) => {
            setProjects((prev) => prev.filter((p) => p.id !== id));
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}

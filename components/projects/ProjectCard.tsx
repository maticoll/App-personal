"use client";

import { Calendar, ChevronRight } from "lucide-react";
import type { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import type { ProjectWithTasks } from "@/lib/projects";

export const STATUS_COLORS: Record<string, string> = {
  TODO: "text-gray-400 bg-gray-400/10",
  IN_PROGRESS: "text-amber-400 bg-amber-400/10",
  DONE: "text-green-400 bg-green-400/10",
  ARCHIVED: "text-gray-500 bg-gray-500/10",
};

export const STATUS_LABELS: Record<string, string> = {
  TODO: "Por hacer",
  IN_PROGRESS: "En progreso",
  DONE: "Hecho",
  ARCHIVED: "Archivado",
};

type Props = {
  project: ProjectWithTasks;
  onClick: (project: ProjectWithTasks) => void;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
};

export default function ProjectCard({ project, onClick, dragHandleProps }: Props) {
  const taskCount = project.tasks.length;
  const doneCount = project.tasks.filter((t) => t.done).length;
  const progress = taskCount > 0 ? Math.round((doneCount / taskCount) * 100) : 0;

  const isOverdue =
    project.deadline &&
    new Date(project.deadline) < new Date() &&
    project.status !== "DONE" &&
    project.status !== "ARCHIVED";

  const formatDeadline = (date: Date) =>
    new Date(date).toLocaleDateString("es-AR", { day: "numeric", month: "short" });

  return (
    <div
      {...(dragHandleProps ?? {})}
      onClick={() => onClick(project)}
      className="card p-3 cursor-pointer hover:border-amber-500/30 active:scale-[0.98] transition-all group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {project.color && (
              <span
                className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: project.color.startsWith("#") ? project.color : project.color === "amber-600" ? "#d97706" : "#f59e0b" }}
              />
            )}
            <span className="text-sm font-medium text-[var(--text-primary)] truncate">{project.title}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {project.notionId && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">Notion</span>
            )}
            {project.deadline && (
              <span className={`flex items-center gap-0.5 text-[10px] ${isOverdue ? "text-red-400" : "text-[var(--text-muted)]"}`}>
                <Calendar className="w-3 h-3" />
                {formatDeadline(project.deadline)}
                {isOverdue && " ⚠"}
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0 group-hover:text-[var(--text-secondary)] transition-colors" />
      </div>

      {taskCount > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-[var(--text-muted)]">{doneCount}/{taskCount} tareas</span>
            <span className="text-[10px] text-[var(--text-muted)]">{progress}%</span>
          </div>
          <div className="h-1 rounded-full bg-[var(--surface-hover)]">
            <div className="h-1 rounded-full bg-amber-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

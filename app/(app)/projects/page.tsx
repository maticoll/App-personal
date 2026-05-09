// ============================================================
// Módulo de Proyectos — /projects
// TODO: Sesión 6 — Kanban, timeline, Notion integration
// ============================================================

import { FolderKanban } from "lucide-react";

export default function ProjectsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <FolderKanban className="w-5 h-5 text-module-projects" />
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Proyectos</h2>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          Personales, trabajo y deadlines
        </p>
      </div>

      {/* Placeholder — TODO: Sesión 6 */}
      <div className="card text-center py-12">
        <FolderKanban className="w-12 h-12 text-module-projects mx-auto mb-4 opacity-40" />
        <p className="font-medium text-[var(--text-primary)]">Módulo en construcción</p>
        <p className="text-sm text-[var(--text-muted)] mt-1">Se implementa en la Sesión 6</p>
      </div>

      {/* TODO: Sesión 6
        - KanbanBoard: columnas Todo / In Progress / Done
        - TimelineView: proyectos con deadline
        - NotionSyncButton: pull tareas IT
        - ProjectCard: tarjeta de proyecto con tareas
      */}
    </div>
  );
}

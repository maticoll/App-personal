"use client";

import { useState } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import type { ProjectWithTasks } from "@/lib/projects";
import type { ProjectStatus } from "@prisma/client";
import ProjectCard, { STATUS_COLORS, STATUS_LABELS } from "./ProjectCard";
import ProjectDetail from "./ProjectDetail";

type Props = {
  projects: ProjectWithTasks[];
  onProjectsChange: (projects: ProjectWithTasks[]) => void;
  onRefresh: () => void;
};

const COLUMNS: ProjectStatus[] = ["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"];

export default function KanbanBoard({ projects, onProjectsChange, onRefresh }: Props) {
  const [selectedProject, setSelectedProject] = useState<ProjectWithTasks | null>(null);

  function getProjectsByStatus(status: ProjectStatus) {
    return projects.filter((p) => p.status === status);
  }

  async function handleDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;
    if (!destination) return;

    const sourceStatus = source.droppableId as ProjectStatus;
    const destStatus = destination.droppableId as ProjectStatus;

    const newProjects = [...projects];
    const movedProject = newProjects.find((p) => p.id === draggableId);
    if (!movedProject) return;

    movedProject.status = destStatus;
    onProjectsChange([...newProjects]);

    if (sourceStatus !== destStatus) {
      await fetch(`/api/projects/${draggableId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: destStatus }),
      });
    }

    const projectsInDest = newProjects
      .filter((p) => p.status === destStatus)
      .map((p) => p.id);

    if (projectsInDest.length > 0) {
      await fetch("/api/projects/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectIds: projectsInDest }),
      });
    }
  }

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {COLUMNS.map((status) => {
            const colProjects = getProjectsByStatus(status);
            return (
              <div key={status} className="min-h-[200px]">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[status]}`}>
                    {STATUS_LABELS[status]}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">{colProjects.length}</span>
                </div>
                <Droppable droppableId={status}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-[120px] rounded-xl p-2 transition-colors ${snapshot.isDraggingOver ? "bg-amber-500/5 border border-amber-500/20" : "bg-[var(--surface-hover)]/30"}`}
                    >
                      <div className="space-y-2">
                        {colProjects.map((project, index) => (
                          <Draggable key={project.id} draggableId={project.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                style={{ ...provided.draggableProps.style, opacity: snapshot.isDragging ? 0.8 : 1 }}
                              >
                                <ProjectCard
                                  project={project}
                                  onClick={setSelectedProject}
                                  dragHandleProps={provided.dragHandleProps}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))}
                      </div>
                      {provided.placeholder}
                      {colProjects.length === 0 && !snapshot.isDraggingOver && (
                        <div className="text-center py-6 text-[var(--text-muted)] text-xs">Sin proyectos</div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {selectedProject && (
        <ProjectDetail
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onUpdated={onRefresh}
          onDeleted={(id) => { setSelectedProject(null); onProjectsChange(projects.filter((p) => p.id !== id)); onRefresh(); }}
        />
      )}
    </>
  );
}

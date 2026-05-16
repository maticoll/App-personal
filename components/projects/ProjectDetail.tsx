"use client";

import { useState, useEffect } from "react";
import { X, Trash2, Plus, Check, Calendar } from "lucide-react";
import type { ProjectWithTasks, ProjectTaskData } from "@/lib/projects";
import type { ProjectStatus } from "@prisma/client";
import { STATUS_LABELS } from "./ProjectCard";

type Props = {
  project: ProjectWithTasks;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: (id: string) => void;
};

const STATUSES: ProjectStatus[] = ["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"];

export default function ProjectDetail({ project, onClose, onUpdated, onDeleted }: Props) {
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [deadline, setDeadline] = useState(
    project.deadline ? new Date(project.deadline).toISOString().split("T")[0] : ""
  );
  const [tasks, setTasks] = useState<ProjectTaskData[]>(project.tasks);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(project.title);
    setDescription(project.description ?? "");
    setStatus(project.status);
    setDeadline(project.deadline ? new Date(project.deadline).toISOString().split("T")[0] : "");
    setTasks(project.tasks);
  }, [project]);

  async function saveProject(fields: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (res.ok) onUpdated();
    } finally { setSaving(false); }
  }

  async function handleTitleBlur() {
    if (title.trim() && title !== project.title) await saveProject({ title: title.trim() });
  }

  async function handleDescriptionBlur() {
    if (description !== (project.description ?? "")) await saveProject({ description: description.trim() });
  }

  async function handleStatusChange(newStatus: ProjectStatus) {
    setStatus(newStatus);
    await saveProject({ status: newStatus });
  }

  async function handleDeadlineChange(value: string) {
    setDeadline(value);
    await saveProject({ deadline: value || null });
  }

  async function handleAddTask() {
    if (!newTaskTitle.trim()) return;
    const res = await fetch(`/api/projects/${project.id}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTaskTitle.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      setTasks((prev) => [...prev, data.task]);
      setNewTaskTitle("");
      onUpdated();
    }
  }

  async function handleToggleTask(task: ProjectTaskData) {
    const res = await fetch(`/api/projects/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !task.done }),
    });
    if (res.ok) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)));
      onUpdated();
    }
  }

  async function handleDeleteTask(taskId: string) {
    const res = await fetch(`/api/projects/tasks/${taskId}`, { method: "DELETE" });
    if (res.ok) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      onUpdated();
    }
  }

  async function handleDeleteProject() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    if (res.ok) onDeleted(project.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-container border border-outline-variant/20 rounded-t-2xl md:rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-outline-variant/20">
          <input
            value={title} onChange={(e) => setTitle(e.target.value)} onBlur={handleTitleBlur}
            className="text-lg font-semibold text-on-surface bg-transparent border-none outline-none focus:ring-0 flex-1 min-w-0 truncate"
            placeholder="Nombre del proyecto"
          />
          <button onClick={onClose} className="ml-2 p-1 rounded-lg hover:bg-surface-container-high text-outline flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-outline block mb-1">Descripción</label>
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)} onBlur={handleDescriptionBlur}
              placeholder="Agrega una descripción..." rows={2}
              className="w-full px-3 py-2 text-sm rounded-lg bg-surface-container-high border border-outline-variant/20 text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-amber-500/30 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-outline block mb-1">Estado</label>
              <select
                value={status} onChange={(e) => handleStatusChange(e.target.value as ProjectStatus)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-surface-container-high border border-outline-variant/20 text-on-surface focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              >
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-outline block mb-1">Deadline</label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-outline pointer-events-none" />
                <input
                  type="date" value={deadline} onChange={(e) => handleDeadlineChange(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm rounded-lg bg-surface-container-high border border-outline-variant/20 text-on-surface focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-outline block mb-2">
              Tareas ({tasks.filter((t) => t.done).length}/{tasks.length})
            </label>
            <div className="space-y-1 mb-2">
              {tasks.map((task) => (
                <div key={task.id} className="flex items-center gap-2 group px-2 py-1.5 rounded-lg hover:bg-surface-container-high">
                  <button
                    onClick={() => handleToggleTask(task)}
                    className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${task.done ? "bg-amber-500 border-amber-500" : "border-outline-variant/30 hover:border-amber-400"}`}
                  >
                    {task.done && <Check className="w-3 h-3 text-white" />}
                  </button>
                  <span className={`flex-1 text-sm ${task.done ? "line-through text-outline" : "text-on-surface"}`}>
                    {task.title}
                  </span>
                  <button onClick={() => handleDeleteTask(task.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-red-400 transition-opacity">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                placeholder="Nueva tarea..."
                className="flex-1 px-3 py-1.5 text-sm rounded-lg bg-surface-container-high border border-outline-variant/20 text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
              <button
                onClick={handleAddTask} disabled={!newTaskTitle.trim()}
                className="px-3 py-1.5 text-sm rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-outline-variant/20">
          <button
            onClick={handleDeleteProject}
            className={`w-full py-2 text-sm rounded-lg transition-colors flex items-center justify-center gap-2 ${confirmDelete ? "bg-red-500 text-white" : "text-red-400 hover:bg-red-500/10"}`}
          >
            <Trash2 className="w-4 h-4" />
            {confirmDelete ? "Confirmar eliminación" : "Eliminar proyecto"}
          </button>
        </div>

        {saving && <div className="absolute top-3 right-12 text-xs text-outline">Guardando...</div>}
      </div>
    </div>
  );
}

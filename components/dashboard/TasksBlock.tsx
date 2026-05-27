"use client";

import { useState } from "react";
import Link from "next/link";
import type { TaskItem } from "@/lib/tasks";
import type { ProjectWithTasks } from "@/lib/projects";

type Props = {
  initialTasks: TaskItem[];
  projects: ProjectWithTasks[];
};

export default function TasksBlock({ initialTasks, projects }: Props) {
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [newTitle, setNewTitle] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    projects[0]?.id ?? ""
  );
  const [creating, setCreating] = useState(false);

  const pending = tasks.filter((t) => !t.done).slice(0, 5);
  const totalPending = tasks.filter((t) => !t.done).length;

  async function handleToggle(id: string) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, done: true, updatedAt: new Date() } : t
      )
    );
    setTogglingIds((prev) => new Set(prev).add(id));
    try {
      await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: true }),
      });
      setTimeout(() => {
        setTasks((prev) => prev.filter((t) => t.id !== id));
      }, 600);
    } catch {
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, done: false } : t))
      );
    } finally {
      setTogglingIds((prev) => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title || !selectedProjectId || creating) return;

    setCreating(true);
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (res.ok) {
        const { task } = await res.json();
        const project = projects.find((p) => p.id === selectedProjectId);
        const newTask: TaskItem = {
          id: task.id,
          title: task.title,
          done: false,
          source: task.notionId ? "notion" : "manual",
          notionId: task.notionId ?? null,
          projectId: selectedProjectId,
          projectName: project?.title ?? "—",
          projectColor: project?.color ?? null,
          projectNotionId: project?.notionId ?? null,
          createdAt: new Date(task.createdAt),
          updatedAt: new Date(task.updatedAt),
        };
        setTasks((prev) => [newTask, ...prev]);
        setNewTitle("");
      }
    } finally {
      setCreating(false);
    }
  }

  const hasProjects = projects.length > 0;

  return (
    <section className="glass-card rounded-2xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-amber-400 text-[20px]">
            checklist
          </span>
          <h3 className="text-sm font-bold text-on-surface tracking-tight">
            Tareas
          </h3>
          {totalPending > 0 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400">
              {totalPending}
            </span>
          )}
        </div>
        <Link
          href="/tasks"
          className="text-xs text-amber-400 hover:underline"
        >
          Ver todas →
        </Link>
      </div>

      {/* Lista de pendientes */}
      {pending.length === 0 ? (
        <div className="py-4 text-center">
          <p className="text-xs text-on-surface-variant">
            🎉 Sin tareas pendientes
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-outline-variant/10 mb-3">
          {pending.map((task) => {
            const loading = togglingIds.has(task.id);
            return (
              <li
                key={task.id}
                className={`flex items-start gap-3 py-2 transition-opacity duration-500 ${
                  task.done ? "opacity-40" : "opacity-100"
                }`}
              >
                <button
                  onClick={() => handleToggle(task.id)}
                  disabled={task.done || loading}
                  className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                    task.done
                      ? "border-green-500 bg-green-500"
                      : "border-outline hover:border-amber-400"
                  }`}
                  aria-label="Marcar tarea como hecha"
                >
                  {task.done && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                      <path
                        d="M2 6l3 3 5-5"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm leading-snug ${
                      task.done
                        ? "line-through text-on-surface-variant/50"
                        : "text-on-surface"
                    }`}
                  >
                    {task.title}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {task.projectColor && (
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: task.projectColor }}
                      />
                    )}
                    <span className="text-[10px] text-outline truncate">
                      {task.projectName}
                    </span>
                    {task.source === "notion" && (
                      <span className="text-[9px] font-semibold px-1 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                        Notion
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Form de agregar tarea */}
      {hasProjects ? (
        <form onSubmit={handleCreate} className="flex flex-col gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Nueva tarea..."
            className="w-full text-sm bg-surface-container-high/50 border border-outline-variant/20 rounded-lg px-3 py-2 text-on-surface placeholder:text-outline focus:outline-none focus:border-amber-400/50 transition-colors"
            disabled={creating}
          />
          <div className="flex gap-2">
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="flex-1 text-xs bg-surface-container-high/50 border border-outline-variant/20 rounded-lg px-2 py-1.5 text-on-surface-variant focus:outline-none focus:border-amber-400/50 transition-colors"
              disabled={creating}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={!newTitle.trim() || creating}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-semibold hover:bg-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {creating ? "..." : "Agregar"}
            </button>
          </div>
        </form>
      ) : (
        <p className="text-xs text-outline text-center py-2">
          Creá un proyecto primero para agregar tareas
        </p>
      )}
    </section>
  );
}

"use client";

import { useState } from "react";
import type { TaskItem } from "@/lib/tasks";
import TaskRow from "./TaskRow";

type Props = {
  initialTasks: TaskItem[];
};

export default function ThisWeekSection({ initialTasks }: Props) {
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  const pending = tasks.filter((t) => !t.done);
  const doneToday = tasks.filter((t) => t.done);

  async function handleToggle(id: string, done: boolean) {
    // Optimistic update inmediato
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, done, updatedAt: new Date() } : t
      )
    );
    setTogglingIds((prev) => new Set(prev).add(id));

    try {
      await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done }),
      });
    } catch {
      // Revertir si falla
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, done: !done } : t))
      );
    } finally {
      setTogglingIds((prev) => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
    }
  }

  // Después del fade-out (~1.3s), removemos la tarea completada del estado
  function handleFaded(id: string) {
    setTimeout(() => {
      setTasks((prev) => prev.filter((t) => t.id !== id));
    }, 1300);
  }

  if (pending.length === 0 && doneToday.length === 0) {
    return (
      <div className="card p-6 text-center">
        <p className="text-3xl mb-2">🎉</p>
        <p className="text-sm text-on-surface-variant">
          Sin tareas pendientes por ahora
        </p>
      </div>
    );
  }

  return (
    <div className="card divide-y divide-outline-variant/20">
      {pending.map((task) => (
        <TaskRowWithFade
          key={task.id}
          task={task}
          onToggle={handleToggle}
          onFaded={handleFaded}
          loading={togglingIds.has(task.id)}
        />
      ))}
      {doneToday.map((task) => (
        <TaskRowWithFade
          key={task.id}
          task={task}
          onToggle={handleToggle}
          onFaded={handleFaded}
          loading={togglingIds.has(task.id)}
        />
      ))}
    </div>
  );
}

// Wrapper que dispara el fade-out y notifica al padre
function TaskRowWithFade({
  task,
  onToggle,
  onFaded,
  loading,
}: {
  task: TaskItem;
  onToggle: (id: string, done: boolean) => void;
  onFaded: (id: string) => void;
  loading: boolean;
}) {
  const [fading, setFading] = useState(false);

  async function handleToggle(id: string, done: boolean) {
    if (done) {
      // Disparamos fade-out antes de notificar al padre
      setFading(true);
      setTimeout(() => onFaded(id), 1200);
    }
    onToggle(id, done);
  }

  return (
    <div
      className={`transition-all duration-500 overflow-hidden ${
        fading ? "opacity-0 max-h-0 py-0" : "opacity-100 max-h-24"
      }`}
    >
      <TaskRow
        task={task}
        onToggle={handleToggle}
        showProject={true}
      />
      {loading && (
        <div className="px-9 pb-1">
          <div className="h-0.5 w-full bg-amber-500/20 rounded animate-pulse" />
        </div>
      )}
    </div>
  );
}

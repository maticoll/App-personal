"use client";

import { useState, useEffect } from "react";
import type { TaskItem } from "@/lib/tasks";

type Props = {
  task: TaskItem;
  onToggle: (id: string, done: boolean) => void;
  showProject?: boolean;
};

export default function TaskRow({ task, onToggle, showProject = true }: Props) {
  const [fading, setFading] = useState(false);

  // Si la tarea ya viene como done (completada hoy), arrancamos el fade-out
  useEffect(() => {
    if (task.done) {
      const timer = setTimeout(() => setFading(true), 800);
      return () => clearTimeout(timer);
    }
  }, [task.done]);

  function handleToggle() {
    if (task.done) return; // no se puede deshacer desde esta sección
    onToggle(task.id, true);
  }

  return (
    <div
      className={`flex items-start gap-3 py-2.5 px-1 transition-opacity duration-500 ${
        fading ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Checkbox */}
      <button
        onClick={handleToggle}
        disabled={task.done}
        className={`mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
          task.done
            ? "border-green-500 bg-green-500"
            : "border-outline hover:border-amber-400"
        }`}
        aria-label={task.done ? "Tarea completada" : "Marcar como hecha"}
      >
        {task.done && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
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

      {/* Contenido */}
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

        {showProject && (
          <div className="flex items-center gap-1.5 mt-0.5">
            {/* Proyecto */}
            <span className="text-xs text-outline truncate">
              {task.projectName}
            </span>

            {/* Badge Notion */}
            {task.source === "notion" && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                Notion
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

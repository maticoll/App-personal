// ============================================================
// lib/tasks.ts — Módulo de Tareas
// Lógica separada de lib/projects.ts
// Usa updatedAt como proxy de completedAt (no hay campo dedicado en schema)
// ============================================================

import { db } from "@/lib/db";

// -------------------------------------------------------
// Tipos
// -------------------------------------------------------

export type TaskSource = "notion" | "manual";

export type TaskPeriod = "this_week" | "last_week" | "this_month" | "all";

export type TaskItem = {
  id: string;
  title: string;
  done: boolean;
  source: TaskSource;
  notionId: string | null;
  projectId: string;
  projectName: string;
  projectColor: string | null;
  projectNotionId: string | null; // para saber si el proyecto vino de Notion
  createdAt: Date;
  updatedAt: Date; // usado como completedAt cuando done=true
};

export type TasksStats = {
  pending: number;
  completedThisWeek: number;
  notionPending: number;
};

// -------------------------------------------------------
// Helpers de fecha
// -------------------------------------------------------

function startOfDay(d = new Date()): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function startOfWeek(d = new Date()): Date {
  const r = new Date(d);
  const day = r.getDay();
  const diff = day === 0 ? -6 : 1 - day; // lunes como inicio
  r.setDate(r.getDate() + diff);
  r.setHours(0, 0, 0, 0);
  return r;
}

function startOfLastWeek(d = new Date()): Date {
  const r = startOfWeek(d);
  r.setDate(r.getDate() - 7);
  return r;
}

function startOfMonth(d = new Date()): Date {
  const r = new Date(d);
  r.setDate(1);
  r.setHours(0, 0, 0, 0);
  return r;
}

// -------------------------------------------------------
// Mapper interno
// -------------------------------------------------------

type RawTask = {
  id: string;
  title: string;
  done: boolean;
  notionId: string | null;
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
  project: { title: string; color: string | null; notionId: string | null };
};

function mapTask(t: RawTask): TaskItem {
  return {
    id: t.id,
    title: t.title,
    done: t.done,
    source: t.notionId ? "notion" : "manual",
    notionId: t.notionId,
    projectId: t.projectId,
    projectName: t.project.title,
    projectColor: t.project.color,
    projectNotionId: t.project.notionId,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

const taskInclude = {
  project: { select: { title: true, color: true, notionId: true } },
} as const;

// -------------------------------------------------------
// Sección A — Tareas de esta semana
// Muestra: todas las pendientes + las completadas HOY
// Las completadas de días anteriores NO aparecen aquí
// -------------------------------------------------------

export async function getThisWeekTasks(userId: string): Promise<TaskItem[]> {
  const todayStart = startOfDay();

  const tasks = await db.projectTask.findMany({
    where: {
      project: { userId },
      OR: [
        // Todas las pendientes
        { done: false },
        // Solo las completadas hoy (para dar feedback visual antes del fade-out)
        { done: true, updatedAt: { gte: todayStart } },
      ],
    },
    include: taskInclude,
    orderBy: [{ done: "asc" }, { createdAt: "asc" }],
  });

  return tasks.map(mapTask);
}

// -------------------------------------------------------
// Sección C — Tareas terminadas
// Filtradas por período usando updatedAt como completedAt
// -------------------------------------------------------

export async function getCompletedTasks(
  userId: string,
  period: TaskPeriod
): Promise<TaskItem[]> {
  const now = new Date();

  let dateWhere: Record<string, Date> = {};
  if (period === "this_week") {
    dateWhere = { gte: startOfWeek(now) };
  } else if (period === "last_week") {
    dateWhere = { gte: startOfLastWeek(now), lt: startOfWeek(now) };
  } else if (period === "this_month") {
    dateWhere = { gte: startOfMonth(now) };
  }
  // "all" = sin filtro de fecha

  const tasks = await db.projectTask.findMany({
    where: {
      project: { userId },
      done: true,
      ...(Object.keys(dateWhere).length > 0 ? { updatedAt: dateWhere } : {}),
    },
    include: taskInclude,
    orderBy: { updatedAt: "desc" },
  });

  return tasks.map(mapTask);
}

// -------------------------------------------------------
// Stats para los badges
// -------------------------------------------------------

export async function getTasksStats(userId: string): Promise<TasksStats> {
  const weekStart = startOfWeek();

  const [pending, completedThisWeek, notionPending] = await Promise.all([
    db.projectTask.count({ where: { project: { userId }, done: false } }),
    db.projectTask.count({
      where: { project: { userId }, done: true, updatedAt: { gte: weekStart } },
    }),
    db.projectTask.count({
      where: { project: { userId }, done: false, notionId: { not: null } },
    }),
  ]);

  return { pending, completedThisWeek, notionPending };
}

// -------------------------------------------------------
// Togglear estado de una tarea (con verificación de owner)
// -------------------------------------------------------

export async function toggleTask(
  taskId: string,
  userId: string,
  done: boolean
): Promise<void> {
  const task = await db.projectTask.findFirst({
    where: { id: taskId, project: { userId } },
  });
  if (!task) throw new Error("Tarea no encontrada");

  await db.projectTask.update({
    where: { id: taskId },
    data: { done, updatedAt: new Date() },
  });
}

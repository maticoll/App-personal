// ============================================================
// lib/projects.ts — Módulo de Proyectos
// Sesión 6 — CRUD, stats, resúmenes para agente
// ============================================================

import { db } from "@/lib/db";
import type { ProjectStatus } from "@prisma/client";

// -------------------------------------------------------
// Tipos exportados
// -------------------------------------------------------

export type ProjectWithTasks = {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  deadline: Date | null;
  order: number;
  color: string | null;
  notionId: string | null;
  tasks: ProjectTaskData[];
  createdAt: Date;
  updatedAt: Date;
};

export type ProjectTaskData = {
  id: string;
  projectId: string;
  title: string;
  done: boolean;
  order: number;
  notionId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type WeeklyProjectStats = {
  projectsAdvanced: number;
  tasksCompleted: number;
  activeProjects: number;
};

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

const taskSelect = {
  id: true,
  projectId: true,
  title: true,
  done: true,
  order: true,
  notionId: true,
  createdAt: true,
  updatedAt: true,
} as const;

const projectWithTasksInclude = {
  tasks: {
    select: taskSelect,
    orderBy: { order: "asc" as const },
  },
} as const;

// -------------------------------------------------------
// Lectura
// -------------------------------------------------------

export async function getAllProjects(userId: string): Promise<ProjectWithTasks[]> {
  return db.project.findMany({
    where: { userId },
    include: projectWithTasksInclude,
    orderBy: { order: "asc" },
  });
}

export async function getProjectsByStatus(
  userId: string,
  status: ProjectStatus
): Promise<ProjectWithTasks[]> {
  return db.project.findMany({
    where: { userId, status },
    include: projectWithTasksInclude,
    orderBy: { order: "asc" },
  });
}

export async function getProject(
  userId: string,
  projectId: string
): Promise<ProjectWithTasks | null> {
  return db.project.findFirst({
    where: { id: projectId, userId },
    include: projectWithTasksInclude,
  });
}

// -------------------------------------------------------
// Creación
// -------------------------------------------------------

export async function createProject(
  userId: string,
  data: {
    title: string;
    description?: string;
    deadline?: Date;
    color?: string;
  }
): Promise<ProjectWithTasks> {
  const maxOrder = await db.project.aggregate({
    where: { userId },
    _max: { order: true },
  });

  return db.project.create({
    data: {
      userId,
      title: data.title,
      description: data.description,
      deadline: data.deadline,
      color: data.color,
      order: (maxOrder._max.order ?? 0) + 1,
      status: "TODO",
    },
    include: projectWithTasksInclude,
  });
}

// -------------------------------------------------------
// Actualización
// -------------------------------------------------------

export async function updateProject(
  userId: string,
  projectId: string,
  data: {
    title?: string;
    description?: string;
    status?: ProjectStatus;
    deadline?: Date | null;
    color?: string;
    order?: number;
  }
): Promise<ProjectWithTasks> {
  const project = await db.project.findFirst({
    where: { id: projectId, userId },
  });
  if (!project) throw new Error("Proyecto no encontrado");

  return db.project.update({
    where: { id: projectId },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.deadline !== undefined && { deadline: data.deadline }),
      ...(data.color !== undefined && { color: data.color }),
      ...(data.order !== undefined && { order: data.order }),
    },
    include: projectWithTasksInclude,
  });
}

// -------------------------------------------------------
// Eliminación
// -------------------------------------------------------

export async function deleteProject(
  userId: string,
  projectId: string
): Promise<void> {
  const project = await db.project.findFirst({
    where: { id: projectId, userId },
  });
  if (!project) throw new Error("Proyecto no encontrado");

  await db.project.delete({ where: { id: projectId } });
}

// -------------------------------------------------------
// Reordenar
// -------------------------------------------------------

export async function reorderProjects(
  userId: string,
  projectIds: string[]
): Promise<void> {
  const projects = await db.project.findMany({
    where: { userId, id: { in: projectIds } },
    select: { id: true },
  });

  if (projects.length !== projectIds.length) {
    throw new Error("Algunos proyectos no pertenecen al usuario");
  }

  await db.$transaction(
    projectIds.map((id, index) =>
      db.project.update({
        where: { id },
        data: { order: index },
      })
    )
  );
}

// -------------------------------------------------------
// Tareas
// -------------------------------------------------------

export async function createTask(
  projectId: string,
  userId: string,
  title: string
): Promise<ProjectTaskData> {
  const project = await db.project.findFirst({
    where: { id: projectId, userId },
  });
  if (!project) throw new Error("Proyecto no encontrado");

  const maxOrder = await db.projectTask.aggregate({
    where: { projectId },
    _max: { order: true },
  });

  return db.projectTask.create({
    data: {
      projectId,
      title,
      order: (maxOrder._max.order ?? 0) + 1,
    },
    select: taskSelect,
  });
}

export async function updateTask(
  userId: string,
  taskId: string,
  data: { done?: boolean; title?: string; order?: number }
): Promise<ProjectTaskData> {
  const task = await db.projectTask.findFirst({
    where: { id: taskId, project: { userId } },
  });
  if (!task) throw new Error("Tarea no encontrada");

  return db.projectTask.update({
    where: { id: taskId },
    data: {
      ...(data.done !== undefined && { done: data.done }),
      ...(data.title !== undefined && { title: data.title }),
      ...(data.order !== undefined && { order: data.order }),
    },
    select: taskSelect,
  });
}

export async function deleteTask(userId: string, taskId: string): Promise<void> {
  const task = await db.projectTask.findFirst({
    where: { id: taskId, project: { userId } },
  });
  if (!task) throw new Error("Tarea no encontrada");

  await db.projectTask.delete({ where: { id: taskId } });
}

// -------------------------------------------------------
// Stats semanales
// -------------------------------------------------------

export async function getWeeklyStats(userId: string): Promise<WeeklyProjectStats> {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [tasksCompleted, activeProjects, projectsAdvanced] = await Promise.all([
    db.projectTask.count({
      where: {
        done: true,
        project: { userId },
        updatedAt: { gte: weekAgo },
      },
    }),
    db.project.count({
      where: { userId, status: "IN_PROGRESS" },
    }),
    db.project.count({
      where: {
        userId,
        updatedAt: { gte: weekAgo },
        status: { not: "ARCHIVED" },
      },
    }),
  ]);

  return { tasksCompleted, activeProjects, projectsAdvanced };
}

// -------------------------------------------------------
// Resumen compacto para dashboard y Morning Summary
// -------------------------------------------------------

export async function getTodayProjectsSummary(userId: string): Promise<string> {
  const today = new Date();

  const [activeProjects, tasksToday] = await Promise.all([
    db.project.findMany({
      where: { userId, status: "IN_PROGRESS" },
      select: { title: true },
      take: 3,
    }),
    db.projectTask.count({
      where: {
        done: true,
        project: { userId },
        updatedAt: {
          gte: startOfDay(today),
          lte: endOfDay(today),
        },
      },
    }),
  ]);

  if (activeProjects.length === 0) {
    return "Sin proyectos activos";
  }

  const names = activeProjects.map((p) => p.title).join(", ");
  const tasksPart =
    tasksToday > 0
      ? ` · ${tasksToday} tarea${tasksToday > 1 ? "s" : ""} hoy`
      : "";
  return `${activeProjects.length} en progreso (${names})${tasksPart}`;
}

# Projects Module Implementation Plan — Sesión 6

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el Módulo de Proyectos completo con Kanban board, CRUD de proyectos y tareas, integración Notion (read-only), scoring actualizado, y agente NLP.

**Architecture:** Server Components para carga inicial de datos + Client Components para interactividad. Business logic en `lib/projects.ts` y `lib/notion.ts`. 11 API routes REST. 8 componentes React en `/components/projects/`. Drag-and-drop con `@hello-pangea/dnd`.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS, Prisma 5 + Supabase, NextAuth v5, @hello-pangea/dnd, @notionhq/client, Claude Haiku (NLP del agente), lucide-react, date-fns.

---

## Mapa de archivos

### Crear (nuevos)
- `lib/projects.ts` — lógica de negocio: CRUD proyectos, tareas, stats
- `lib/notion.ts` — integración Notion read-only
- `app/api/projects/route.ts` — GET todos / POST crear
- `app/api/projects/reorder/route.ts` — POST reordenar
- `app/api/projects/weekly-stats/route.ts` — GET stats semanales
- `app/api/projects/sync-notion/route.ts` — POST sync Notion
- `app/api/projects/[id]/route.ts` — GET / PATCH / DELETE
- `app/api/projects/[id]/tasks/route.ts` — POST crear tarea
- `app/api/projects/tasks/[taskId]/route.ts` — PATCH / DELETE tarea
- `components/projects/ProjectsModuleClient.tsx` — wrapper con tabs
- `components/projects/KanbanBoard.tsx` — tablero drag-and-drop
- `components/projects/ProjectCard.tsx` — card arrastrable
- `components/projects/ProjectDetail.tsx` — panel lateral / modal
- `components/projects/TimelineView.tsx` — vista cronológica
- `components/projects/NotionSyncButton.tsx` — botón sync con estado
- `components/projects/ProjectsQuickActions.tsx` — FAB "+"
- `components/projects/WeeklyProjectStats.tsx` — 3 stat cards

### Modificar (existentes)
- `prisma/schema.prisma` — agregar `notionToken` y `notionDbId` a `UserSettings`
- `lib/scoring.ts` — reemplazar `calcProjectsScore` con criterios nuevos + exportar `calcProjectsScoreForDate`
- `app/(app)/projects/page.tsx` — reemplazar placeholder con Server Component real
- `agents/projects/index.ts` — implementar agente NLP completo
- `.env.local.example` — agregar `NOTION_TOKEN` y `NOTION_DB_ID`

---

## Task 1: Instalar dependencias y actualizar schema Prisma

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `prisma/schema.prisma:429-461`

- [ ] **Step 1: Instalar dependencias nuevas**

```bash
cd "C:\Users\Usuario\OneDrive\Desktop\CLAUDIO\App personal"
npm install @hello-pangea/dnd @notionhq/client
npm install --save-dev @types/react  # ya existe pero reforzar
```

- [ ] **Step 2: Agregar campos a UserSettings en el schema**

En `prisma/schema.prisma`, dentro del model `UserSettings` (después del campo `garminSessionExp`), agregar:

```prisma
  // Integración Notion (Sesión 6)
  notionToken String?   // Integration token de Notion
  notionDbId  String?   // ID de la base de datos de Notion
```

- [ ] **Step 3: Aplicar cambios al schema en producción**

```bash
cd "C:\Users\Usuario\OneDrive\Desktop\CLAUDIO\App personal"
npm run db:push
npm run db:generate
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma package.json package-lock.json
git commit -m "feat(projects): add @hello-pangea/dnd, @notionhq/client, notionToken/notionDbId to UserSettings"
```

---

## Task 2: lib/projects.ts — Lógica de negocio

**Files:**
- Create: `lib/projects.ts`

- [ ] **Step 1: Crear lib/projects.ts completo**

```typescript
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

// ProjectSummary ya existe en lib/types.ts con campos distintos — NO redeclarar aquí.
// Si se necesita en el futuro, usar el tipo de lib/types.ts o renombrar a ProjectListItem.

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
  // Obtener el order máximo actual
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
  // Verificar ownership
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

  // Cascade está configurado en Prisma — elimina tasks automáticamente
  await db.project.delete({ where: { id: projectId } });
}

// -------------------------------------------------------
// Reordenar
// -------------------------------------------------------

export async function reorderProjects(
  userId: string,
  projectIds: string[]
): Promise<void> {
  // Verificar que todos los projectIds pertenecen al usuario
  const projects = await db.project.findMany({
    where: { userId, id: { in: projectIds } },
    select: { id: true },
  });

  if (projects.length !== projectIds.length) {
    throw new Error("Algunos proyectos no pertenecen al usuario");
  }

  // Actualizar order en transacción
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
  // Verificar ownership del proyecto
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
  // Verificar ownership via join
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
  const tasksPart = tasksToday > 0 ? ` · ${tasksToday} tarea${tasksToday > 1 ? "s" : ""} hoy` : "";
  return `${activeProjects.length} en progreso (${names})${tasksPart}`;
}
```

- [ ] **Step 2: Verificar que el archivo TypeScript no tiene errores obvios**

```bash
cd "C:\Users\Usuario\OneDrive\Desktop\CLAUDIO\App personal"
npx tsc --noEmit --skipLibCheck 2>&1 | grep "lib/projects" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add lib/projects.ts
git commit -m "feat(projects): add lib/projects.ts with full CRUD and stats"
```

---

## Task 3: lib/notion.ts — Integración Notion (read-only)

**Files:**
- Create: `lib/notion.ts`

- [ ] **Step 1: Crear lib/notion.ts**

```typescript
// ============================================================
// lib/notion.ts — Integración Notion API (READ-ONLY)
// Sesión 6 — Pull de tareas IT desde base de datos de Notion
// ============================================================

import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { db } from "@/lib/db";
import type { ProjectStatus } from "@prisma/client";

// -------------------------------------------------------
// Tipos
// -------------------------------------------------------

export type NotionTask = {
  notionId: string;
  title: string;
  status: ProjectStatus;
  deadline?: Date;
};

export type NotionSyncResult = {
  synced: number;
  created: number;
  updated: number;
  errors: string[];
};

// -------------------------------------------------------
// Cliente Notion
// -------------------------------------------------------

export function getNotionClient(token: string): Client {
  return new Client({ auth: token });
}

// -------------------------------------------------------
// Mapeo de status de Notion → ProjectStatus
// -------------------------------------------------------

function mapNotionStatus(statusName: string | undefined): ProjectStatus {
  if (!statusName) return "TODO";

  const lower = statusName.toLowerCase();

  if (
    lower.includes("in progress") ||
    lower.includes("doing") ||
    lower === "en progreso"
  ) {
    return "IN_PROGRESS";
  }

  if (
    lower.includes("done") ||
    lower.includes("completed") ||
    lower.includes("completado") ||
    lower.includes("hecho")
  ) {
    return "DONE";
  }

  // "Not started", "To Do", "todo", sin status → TODO
  return "TODO";
}

// -------------------------------------------------------
// Extraer texto de una propiedad Title de Notion
// -------------------------------------------------------

function extractTitle(page: PageObjectResponse): string {
  const titleProp = Object.values(page.properties).find(
    (p) => p.type === "title"
  );
  if (!titleProp || titleProp.type !== "title") return "Sin título";

  return (
    titleProp.title.map((t) => t.plain_text).join("") || "Sin título"
  );
}

// -------------------------------------------------------
// Extraer status de Notion (busca propiedad de tipo "status" o "select")
// -------------------------------------------------------

function extractStatus(page: PageObjectResponse): string | undefined {
  for (const prop of Object.values(page.properties)) {
    if (prop.type === "status" && prop.status?.name) {
      return prop.status.name;
    }
    if (prop.type === "select" && prop.select?.name) {
      return prop.select.name;
    }
  }
  return undefined;
}

// -------------------------------------------------------
// Extraer deadline (busca propiedad de tipo "date")
// -------------------------------------------------------

function extractDeadline(page: PageObjectResponse): Date | undefined {
  for (const prop of Object.values(page.properties)) {
    if (prop.type === "date" && prop.date?.start) {
      return new Date(prop.date.start);
    }
  }
  return undefined;
}

// -------------------------------------------------------
// Fetch de todas las páginas de la DB de Notion
// -------------------------------------------------------

export async function fetchNotionTasks(
  token: string,
  databaseId: string
): Promise<NotionTask[]> {
  const client = getNotionClient(token);
  const tasks: NotionTask[] = [];

  let cursor: string | undefined = undefined;

  do {
    const response = await client.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
      page_size: 100,
    });

    for (const page of response.results) {
      if (page.object !== "page") continue;
      const fullPage = page as PageObjectResponse;

      tasks.push({
        notionId: fullPage.id,
        title: extractTitle(fullPage),
        status: mapNotionStatus(extractStatus(fullPage)),
        deadline: extractDeadline(fullPage),
      });
    }

    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return tasks;
}

// -------------------------------------------------------
// Sync: Notion → Projects (upsert por notionId)
// -------------------------------------------------------

export async function syncNotionToProjects(userId: string): Promise<NotionSyncResult> {
  const result: NotionSyncResult = {
    synced: 0,
    created: 0,
    updated: 0,
    errors: [],
  };

  // Leer credenciales desde UserSettings (fuente principal) con fallback a env
  const settings = await db.userSettings.findUnique({
    where: { userId },
    select: { notionToken: true, notionDbId: true },
  });

  const token = settings?.notionToken ?? process.env.NOTION_TOKEN;
  const databaseId = settings?.notionDbId ?? process.env.NOTION_DB_ID;

  if (!token || !databaseId) {
    result.errors.push("Notion no configurado");
    return result;
  }

  let tasks: NotionTask[];
  try {
    tasks = await fetchNotionTasks(token, databaseId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    result.errors.push(`Error al leer Notion: ${message}`);
    return result;
  }

  // Obtener el order máximo actual para nuevos proyectos
  const maxOrderAgg = await db.project.aggregate({
    where: { userId },
    _max: { order: true },
  });
  let nextOrder = (maxOrderAgg._max.order ?? 0) + 1;

  for (const task of tasks) {
    try {
      const existing = await db.project.findUnique({
        where: { notionId: task.notionId },
      });

      if (existing) {
        // Actualizar si pertenece al usuario
        if (existing.userId === userId) {
          await db.project.update({
            where: { id: existing.id },
            data: {
              title: task.title,
              status: task.status,
              deadline: task.deadline ?? null,
            },
          });
          result.updated++;
        }
      } else {
        // Crear nuevo proyecto desde Notion
        await db.project.create({
          data: {
            userId,
            title: task.title,
            status: task.status,
            deadline: task.deadline ?? null,
            notionId: task.notionId,
            color: "amber-600", // Color distintivo para proyectos de Notion
            order: nextOrder++,
          },
        });
        result.created++;
      }

      result.synced++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      result.errors.push(`Error en tarea "${task.title}": ${message}`);
    }
  }

  return result;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/notion.ts
git commit -m "feat(projects): add lib/notion.ts read-only Notion integration"
```

---

## Task 4: lib/scoring.ts — Actualizar calcProjectsScore

**Files:**
- Modify: `lib/scoring.ts` — reemplazar función `calcProjectsScore` (líneas 424-507) y agregar export

Los criterios ACTUALES (scoring Sesión 2) son incorrectos. La spec de Sesión 6 define:

```
Actividad (60 pts):
  - Al menos 1 tarea completada hoy: 40 pts
  - 2 o más tareas completadas: +20 pts adicionales

Estado de proyectos (40 pts):
  - Tiene al menos 1 proyecto IN_PROGRESS: 20 pts
  - Tiene proyectos sin deadline vencido: +20 pts

Null: si no hay ningún proyecto creado
0: si hay proyectos pero no hubo actividad hoy
```

- [ ] **Step 1: Reemplazar calcProjectsScore en lib/scoring.ts**

Reemplazar el bloque completo desde `// Score de PROYECTOS` (línea ~417) hasta el final de la función `calcProjectsScore` (línea ~507), por:

```typescript
// -------------------------------------------------------
// Score de PROYECTOS — Criterios actualizados Sesión 6
//
// Actividad (60 pts):
//   +40  Al menos 1 tarea completada hoy
//   +20  2 o más tareas completadas hoy
//
// Estado (40 pts):
//   +20  Tiene al menos 1 proyecto IN_PROGRESS
//   +20  Tiene proyectos sin deadline vencido
//
// Null: sin proyectos creados
// 0:    hay proyectos pero sin actividad hoy
// -------------------------------------------------------

async function calcProjectsScore(
  userId: string,
  date: Date
): Promise<ModuleScoreResult> {
  const met: string[] = [];
  const missed: string[] = [];
  const now = new Date();

  const [totalProjects, tasksCompletedToday, activeProjects, overdueProjects] =
    await Promise.all([
      db.project.count({ where: { userId } }),
      db.projectTask.findMany({
        where: {
          done: true,
          project: { userId },
          updatedAt: {
            gte: startOfDay(date),
            lte: endOfDay(date),
          },
        },
        select: { id: true, title: true },
      }),
      db.project.count({
        where: { userId, status: "IN_PROGRESS" },
      }),
      db.project.count({
        where: {
          userId,
          deadline: { lt: now },
          status: { notIn: ["DONE", "ARCHIVED"] },
        },
      }),
    ]);

  // Null si no hay ningún proyecto
  if (totalProjects === 0) {
    return { score: null, met: [], missed: ["Sin proyectos creados"] };
  }

  // Si hay proyectos pero no hubo actividad de tareas:
  // El score de actividad (60 pts) es 0, pero el estado de proyectos (40 pts) igual se evalúa.
  // El mínimo posible es 0 (sin progreso + con deadlines vencidos), el máximo sin actividad es 40.
  if (tasksCompletedToday.length === 0) {
    const stateScore = activeProjects > 0 ? 20 : 0;
    const deadlineScore = overdueProjects === 0 ? 20 : 0;

    if (activeProjects > 0) {
      met.push(`${activeProjects} proyecto${activeProjects > 1 ? "s" : ""} en progreso`);
    } else {
      missed.push("Sin proyectos en progreso");
    }

    if (overdueProjects === 0) {
      met.push("Sin deadlines vencidos");
    } else {
      missed.push(`${overdueProjects} proyecto${overdueProjects > 1 ? "s" : ""} con deadline vencido`);
    }

    missed.push("Sin tareas completadas hoy");

    return { score: stateScore + deadlineScore, met, missed };
  }

  let score = 0;

  // === Actividad (60 pts) ===
  score += 40;
  met.push(`${tasksCompletedToday.length} tarea${tasksCompletedToday.length > 1 ? "s" : ""} completada${tasksCompletedToday.length > 1 ? "s" : ""} hoy`);

  if (tasksCompletedToday.length >= 2) {
    score += 20;
    met.push("Gran productividad: 2+ tareas ✓");
  } else {
    missed.push("Completá 2 o más tareas para el bonus de productividad");
  }

  // === Estado de proyectos (40 pts) ===
  if (activeProjects > 0) {
    score += 20;
    met.push(`${activeProjects} proyecto${activeProjects > 1 ? "s" : ""} en progreso`);
  } else {
    missed.push("Sin proyectos en progreso");
  }

  if (overdueProjects === 0) {
    score += 20;
    met.push("Sin deadlines vencidos ✓");
  } else {
    missed.push(`${overdueProjects} proyecto${overdueProjects > 1 ? "s" : ""} con deadline vencido`);
  }

  return { score: Math.min(score, 100), met, missed };
}

/**
 * Función exportada para que el agente de proyectos pueda calcular el score
 * sin cargar el módulo de scoring completo.
 */
export async function calcProjectsScoreForDate(
  userId: string,
  date: Date
): Promise<ModuleScoreResult> {
  return calcProjectsScore(userId, date);
}
```

- [ ] **Step 2: Verificar que calcProjectsScore sigue siendo llamada en calculateFullScore**

La función `calculateFullScore` (línea ~513) ya llama `calcProjectsScore(userId, date)` — no hay que cambiarla, solo nos aseguramos que el nombre interno no cambió.

- [ ] **Step 3: Commit**

```bash
git add lib/scoring.ts
git commit -m "feat(projects): update calcProjectsScore with Session 6 criteria, export calcProjectsScoreForDate"
```

---

## Task 5: API Routes

**Files:**
- Create: `app/api/projects/route.ts`
- Create: `app/api/projects/reorder/route.ts`
- Create: `app/api/projects/weekly-stats/route.ts`
- Create: `app/api/projects/sync-notion/route.ts`
- Create: `app/api/projects/[id]/route.ts`
- Create: `app/api/projects/[id]/tasks/route.ts`
- Create: `app/api/projects/tasks/[taskId]/route.ts`

- [ ] **Step 1: Crear app/api/projects/route.ts (GET todos / POST crear)**

```typescript
// GET /api/projects — todos los proyectos con tareas
// POST /api/projects — crear proyecto

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAllProjects, createProject } from "@/lib/projects";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const projects = await getAllProjects(session.user.id);
    return NextResponse.json({ projects });
  } catch (err) {
    console.error("[GET /api/projects]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const { title, description, deadline, color } = body;

    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "Título requerido" }, { status: 400 });
    }

    const project = await createProject(session.user.id, {
      title: title.trim(),
      description: description?.trim(),
      deadline: deadline ? new Date(deadline) : undefined,
      color,
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/projects]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Crear app/api/projects/[id]/route.ts (GET / PATCH / DELETE)**

```typescript
// GET /api/projects/[id] — proyecto con tareas
// PATCH /api/projects/[id] — actualizar proyecto
// DELETE /api/projects/[id] — eliminar proyecto

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getProject, updateProject, deleteProject } from "@/lib/projects";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const project = await getProject(session.user.id, id);
    if (!project) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (err) {
    console.error("[GET /api/projects/[id]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { title, description, status, deadline, color, order } = body;

    const project = await updateProject(session.user.id, id, {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(status !== undefined && { status }),
      ...(deadline !== undefined && {
        deadline: deadline ? new Date(deadline) : null,
      }),
      ...(color !== undefined && { color }),
      ...(order !== undefined && { order }),
    });

    return NextResponse.json({ project });
  } catch (err) {
    console.error("[PATCH /api/projects/[id]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    await deleteProject(session.user.id, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/projects/[id]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Crear app/api/projects/[id]/tasks/route.ts (POST crear tarea)**

```typescript
// POST /api/projects/[id]/tasks — crear tarea en un proyecto

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createTask } from "@/lib/projects";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id: projectId } = await params;
    const body = await req.json();
    const { title } = body;

    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "Título requerido" }, { status: 400 });
    }

    const task = await createTask(projectId, session.user.id, title.trim());
    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/projects/[id]/tasks]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Crear app/api/projects/tasks/[taskId]/route.ts (PATCH / DELETE tarea)**

```typescript
// PATCH /api/projects/tasks/[taskId] — actualizar tarea
// DELETE /api/projects/tasks/[taskId] — eliminar tarea

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { updateTask, deleteTask } from "@/lib/projects";

type Params = { params: Promise<{ taskId: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { taskId } = await params;
    const body = await req.json();
    const { done, title, order } = body;

    const task = await updateTask(session.user.id, taskId, {
      ...(done !== undefined && { done }),
      ...(title !== undefined && { title }),
      ...(order !== undefined && { order }),
    });

    return NextResponse.json({ task });
  } catch (err) {
    console.error("[PATCH /api/projects/tasks/[taskId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { taskId } = await params;
    await deleteTask(session.user.id, taskId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/projects/tasks/[taskId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
```

- [ ] **Step 5: Crear app/api/projects/reorder/route.ts**

```typescript
// POST /api/projects/reorder — reordenar proyectos en el Kanban

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { reorderProjects } from "@/lib/projects";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const { projectIds } = body;

    if (!Array.isArray(projectIds)) {
      return NextResponse.json({ error: "projectIds debe ser un array" }, { status: 400 });
    }

    await reorderProjects(session.user.id, projectIds);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/projects/reorder]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
```

- [ ] **Step 6: Crear app/api/projects/weekly-stats/route.ts**

```typescript
// GET /api/projects/weekly-stats

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getWeeklyStats } from "@/lib/projects";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const stats = await getWeeklyStats(session.user.id);
    return NextResponse.json({ stats });
  } catch (err) {
    console.error("[GET /api/projects/weekly-stats]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
```

- [ ] **Step 7: Crear app/api/projects/sync-notion/route.ts**

```typescript
// POST /api/projects/sync-notion — disparar sync desde Notion

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { syncNotionToProjects } from "@/lib/notion";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const result = await syncNotionToProjects(session.user.id);
    return NextResponse.json({ result });
  } catch (err) {
    console.error("[POST /api/projects/sync-notion]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
```

- [ ] **Step 8: Commit todas las API routes**

```bash
git add app/api/projects/
git commit -m "feat(projects): add all 11 API routes for projects module"
```

---

## Task 6: Componentes React

**Files:**
- Create: `components/projects/WeeklyProjectStats.tsx`
- Create: `components/projects/NotionSyncButton.tsx`
- Create: `components/projects/ProjectsQuickActions.tsx`
- Create: `components/projects/ProjectCard.tsx`
- Create: `components/projects/ProjectDetail.tsx`
- Create: `components/projects/KanbanBoard.tsx`
- Create: `components/projects/TimelineView.tsx`
- Create: `components/projects/ProjectsModuleClient.tsx`

### Sub-task 6a: Componentes simples (sin dependencias entre sí)

- [ ] **Step 1: Crear components/projects/WeeklyProjectStats.tsx**

```tsx
"use client";

import type { WeeklyProjectStats } from "@/lib/projects";

type Props = {
  stats: WeeklyProjectStats;
};

export default function WeeklyProjectStats({ stats }: Props) {
  const cards = [
    {
      label: "Proyectos activos",
      value: stats.activeProjects,
      icon: "🚀",
      color: "text-amber-400",
    },
    {
      label: "Tareas esta semana",
      value: stats.tasksCompleted,
      icon: "✅",
      color: "text-green-400",
    },
    {
      label: "Proyectos avanzados",
      value: stats.projectsAdvanced,
      icon: "📈",
      color: "text-blue-400",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map((card) => (
        <div key={card.label} className="card p-3 text-center">
          <div className="text-2xl mb-1">{card.icon}</div>
          <div className={`text-2xl font-bold ${card.color}`}>
            {card.value}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5 leading-tight">
            {card.label}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Crear components/projects/NotionSyncButton.tsx**

```tsx
"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle, AlertCircle } from "lucide-react";

type SyncResult = {
  synced: number;
  created: number;
  updated: number;
  errors: string[];
};

type Props = {
  onSynced?: () => void;
};

export default function NotionSyncButton({ onSynced }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/projects/sync-notion", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Error al sincronizar");
        return;
      }

      setResult(data.result);
      if (data.result.errors.length === 0) {
        onSynced?.();
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleSync}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg
          bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 
          disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Sincronizando..." : "Sync Notion"}
      </button>

      {result && (
        <div className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
          {result.errors.length === 0 ? (
            <>
              <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />
              {result.created} creados · {result.updated} actualizados
            </>
          ) : (
            <>
              <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
              {result.errors[0]}
            </>
          )}
        </div>
      )}

      {error && (
        <div className="text-xs text-red-400 flex items-center gap-1">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Crear components/projects/ProjectsQuickActions.tsx**

```tsx
"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

type Props = {
  onCreated: () => void;
};

export default function ProjectsQuickActions({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!title.trim()) return;
    setLoading(true);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });

      if (res.ok) {
        setTitle("");
        setOpen(false);
        onCreated();
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-30
          w-12 h-12 rounded-full bg-amber-500 text-white shadow-lg
          flex items-center justify-center hover:bg-amber-600
          transition-colors active:scale-95"
        aria-label="Nuevo proyecto"
      >
        <Plus className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-30
      bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl p-4 w-72">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-[var(--text-primary)]">
          Nuevo proyecto
        </span>
        <button
          onClick={() => { setOpen(false); setTitle(""); }}
          className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        placeholder="Nombre del proyecto..."
        className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--surface-hover)]
          border border-[var(--border)] text-[var(--text-primary)]
          placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2
          focus:ring-amber-500/50 mb-3"
        autoFocus
      />

      <button
        onClick={handleCreate}
        disabled={!title.trim() || loading}
        className="w-full py-2 text-sm font-medium rounded-lg
          bg-amber-500 text-white hover:bg-amber-600
          disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Creando..." : "Crear proyecto"}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Commit componentes simples**

```bash
git add components/projects/WeeklyProjectStats.tsx components/projects/NotionSyncButton.tsx components/projects/ProjectsQuickActions.tsx
git commit -m "feat(projects): add WeeklyProjectStats, NotionSyncButton, ProjectsQuickActions"
```

### Sub-task 6b: ProjectCard

- [ ] **Step 5: Crear components/projects/ProjectCard.tsx**

```tsx
"use client";

import { Calendar, ChevronRight } from "lucide-react";
import type { ProjectWithTasks } from "@/lib/projects";

import type { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";

type Props = {
  project: ProjectWithTasks;
  onClick: (project: ProjectWithTasks) => void;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
};

// Nota: spread de null en JSX es válido en TypeScript y es no-op en runtime.
// Usar {..*(dragHandleProps ?? {})} para mayor claridad.

const STATUS_COLORS: Record<string, string> = {
  TODO: "text-gray-400 bg-gray-400/10",
  IN_PROGRESS: "text-amber-400 bg-amber-400/10",
  DONE: "text-green-400 bg-green-400/10",
  ARCHIVED: "text-gray-500 bg-gray-500/10",
};

const STATUS_LABELS: Record<string, string> = {
  TODO: "Por hacer",
  IN_PROGRESS: "En progreso",
  DONE: "Hecho",
  ARCHIVED: "Archivado",
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

  const formatDeadline = (date: Date) => {
    return new Date(date).toLocaleDateString("es-AR", {
      day: "numeric",
      month: "short",
    });
  };

  return (
    <div
      {...dragHandleProps}
      {...(dragHandleProps ?? {})}
      onClick={() => onClick(project)}
      className="card p-3 cursor-pointer hover:border-amber-500/30 
        active:scale-[0.98] transition-all group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {project.color && (
              <span
                className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{
                  backgroundColor:
                    project.color.startsWith("#")
                      ? project.color
                      : project.color === "amber-600"
                      ? "#d97706"
                      : "#f59e0b",
                }}
              />
            )}
            <span className="text-sm font-medium text-[var(--text-primary)] truncate">
              {project.title}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {project.notionId && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded
                bg-amber-500/10 text-amber-400">
                Notion
              </span>
            )}
            {project.deadline && (
              <span
                className={`flex items-center gap-0.5 text-[10px] ${
                  isOverdue ? "text-red-400" : "text-[var(--text-muted)]"
                }`}
              >
                <Calendar className="w-3 h-3" />
                {formatDeadline(project.deadline)}
                {isOverdue && " ⚠"}
              </span>
            )}
          </div>
        </div>

        <ChevronRight className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0
          group-hover:text-[var(--text-secondary)] transition-colors" />
      </div>

      {taskCount > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-[var(--text-muted)]">
              {doneCount}/{taskCount} tareas
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">
              {progress}%
            </span>
          </div>
          <div className="h-1 rounded-full bg-[var(--surface-hover)]">
            <div
              className="h-1 rounded-full bg-amber-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export { STATUS_COLORS, STATUS_LABELS };
```

### Sub-task 6c: ProjectDetail (panel lateral / modal)

- [ ] **Step 6: Crear components/projects/ProjectDetail.tsx**

```tsx
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
    project.deadline
      ? new Date(project.deadline).toISOString().split("T")[0]
      : ""
  );
  const [tasks, setTasks] = useState<ProjectTaskData[]>(project.tasks);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sinc con prop si cambia de proyecto
  useEffect(() => {
    setTitle(project.title);
    setDescription(project.description ?? "");
    setStatus(project.status);
    setDeadline(
      project.deadline
        ? new Date(project.deadline).toISOString().split("T")[0]
        : ""
    );
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
    } finally {
      setSaving(false);
    }
  }

  async function handleTitleBlur() {
    if (title.trim() && title !== project.title) {
      await saveProject({ title: title.trim() });
    }
  }

  async function handleDescriptionBlur() {
    if (description !== (project.description ?? "")) {
      await saveProject({ description: description.trim() });
    }
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
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t))
      );
      onUpdated();
    }
  }

  async function handleDeleteTask(taskId: string) {
    const res = await fetch(`/api/projects/tasks/${taskId}`, {
      method: "DELETE",
    });

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

    const res = await fetch(`/api/projects/${project.id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      onDeleted(project.id);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative bg-[var(--surface)] border border-[var(--border)]
        rounded-t-2xl md:rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col
        shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            className="text-lg font-semibold text-[var(--text-primary)] bg-transparent
              border-none outline-none focus:ring-0 flex-1 min-w-0 truncate"
            placeholder="Nombre del proyecto"
          />
          <button
            onClick={onClose}
            className="ml-2 p-1 rounded-lg hover:bg-[var(--surface-hover)]
              text-[var(--text-muted)] flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Descripción */}
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)] block mb-1">
              Descripción
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleDescriptionBlur}
              placeholder="Agrega una descripción..."
              rows={2}
              className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--surface-hover)]
                border border-[var(--border)] text-[var(--text-primary)]
                placeholder:text-[var(--text-muted)] focus:outline-none
                focus:ring-2 focus:ring-amber-500/30 resize-none"
            />
          </div>

          {/* Status + Deadline */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[var(--text-muted)] block mb-1">
                Estado
              </label>
              <select
                value={status}
                onChange={(e) => handleStatusChange(e.target.value as ProjectStatus)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--surface-hover)]
                  border border-[var(--border)] text-[var(--text-primary)]
                  focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-[var(--text-muted)] block mb-1">
                Deadline
              </label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5
                  text-[var(--text-muted)] pointer-events-none" />
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => handleDeadlineChange(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm rounded-lg bg-[var(--surface-hover)]
                    border border-[var(--border)] text-[var(--text-primary)]
                    focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />
              </div>
            </div>
          </div>

          {/* Tareas */}
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)] block mb-2">
              Tareas ({tasks.filter((t) => t.done).length}/{tasks.length})
            </label>

            <div className="space-y-1 mb-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-2 group px-2 py-1.5 rounded-lg
                    hover:bg-[var(--surface-hover)]"
                >
                  <button
                    onClick={() => handleToggleTask(task)}
                    className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center
                      justify-center transition-colors ${
                        task.done
                          ? "bg-amber-500 border-amber-500"
                          : "border-[var(--border)] hover:border-amber-400"
                      }`}
                  >
                    {task.done && <Check className="w-3 h-3 text-white" />}
                  </button>
                  <span
                    className={`flex-1 text-sm ${
                      task.done
                        ? "line-through text-[var(--text-muted)]"
                        : "text-[var(--text-primary)]"
                    }`}
                  >
                    {task.title}
                  </span>
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded
                      hover:bg-red-500/10 text-red-400 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>

            {/* Agregar tarea */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                placeholder="Nueva tarea..."
                className="flex-1 px-3 py-1.5 text-sm rounded-lg bg-[var(--surface-hover)]
                  border border-[var(--border)] text-[var(--text-primary)]
                  placeholder:text-[var(--text-muted)] focus:outline-none
                  focus:ring-2 focus:ring-amber-500/30"
              />
              <button
                onClick={handleAddTask}
                disabled={!newTaskTitle.trim()}
                className="px-3 py-1.5 text-sm rounded-lg bg-amber-500 text-white
                  hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer — eliminar */}
        <div className="p-4 border-t border-[var(--border)]">
          <button
            onClick={handleDeleteProject}
            className={`w-full py-2 text-sm rounded-lg transition-colors flex items-center
              justify-center gap-2 ${
                confirmDelete
                  ? "bg-red-500 text-white"
                  : "text-red-400 hover:bg-red-500/10"
              }`}
          >
            <Trash2 className="w-4 h-4" />
            {confirmDelete ? "Confirmar eliminación" : "Eliminar proyecto"}
          </button>
        </div>

        {saving && (
          <div className="absolute top-3 right-12 text-xs text-[var(--text-muted)]">
            Guardando...
          </div>
        )}
      </div>
    </div>
  );
}
```

### Sub-task 6d: KanbanBoard

- [ ] **Step 7: Crear components/projects/KanbanBoard.tsx**

```tsx
"use client";

import { useState } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
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

    // Construir nuevo estado optimista
    const newProjects = [...projects];
    const movedProject = newProjects.find((p) => p.id === draggableId);
    if (!movedProject) return;

    movedProject.status = destStatus;

    onProjectsChange([...newProjects]);

    // Persistir cambio de status si cambió de columna
    if (sourceStatus !== destStatus) {
      await fetch(`/api/projects/${draggableId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: destStatus }),
      });
    }

    // Persistir nuevo orden
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

  function handleProjectClick(project: ProjectWithTasks) {
    setSelectedProject(project);
  }

  function handleDetailClose() {
    setSelectedProject(null);
  }

  function handleProjectUpdated() {
    onRefresh();
    // Actualizar el proyecto seleccionado desde los proyectos actualizados
  }

  function handleProjectDeleted(id: string) {
    setSelectedProject(null);
    onProjectsChange(projects.filter((p) => p.id !== id));
    onRefresh();
  }

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {COLUMNS.map((status) => {
            const colProjects = getProjectsByStatus(status);

            return (
              <div key={status} className="min-h-[200px]">
                {/* Header de columna */}
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[status]}`}
                  >
                    {STATUS_LABELS[status]}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {colProjects.length}
                  </span>
                </div>

                {/* Columna droppable */}
                <Droppable droppableId={status}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-[120px] rounded-xl p-2 transition-colors ${
                        snapshot.isDraggingOver
                          ? "bg-amber-500/5 border border-amber-500/20"
                          : "bg-[var(--surface-hover)]/30"
                      }`}
                    >
                      <div className="space-y-2">
                        {colProjects.map((project, index) => (
                          <Draggable
                            key={project.id}
                            draggableId={project.id}
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                style={{
                                  ...provided.draggableProps.style,
                                  opacity: snapshot.isDragging ? 0.8 : 1,
                                }}
                              >
                                <ProjectCard
                                  project={project}
                                  onClick={handleProjectClick}
                                  dragHandleProps={provided.dragHandleProps ?? undefined}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))}
                      </div>
                      {provided.placeholder}

                      {colProjects.length === 0 && !snapshot.isDraggingOver && (
                        <div className="text-center py-6 text-[var(--text-muted)] text-xs">
                          Sin proyectos
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {/* ProjectDetail modal */}
      {selectedProject && (
        <ProjectDetail
          project={selectedProject}
          onClose={handleDetailClose}
          onUpdated={handleProjectUpdated}
          onDeleted={handleProjectDeleted}
        />
      )}
    </>
  );
}
```

### Sub-task 6e: TimelineView

- [ ] **Step 8: Crear components/projects/TimelineView.tsx**

```tsx
"use client";

import { useState } from "react";
import { Calendar } from "lucide-react";
import type { ProjectWithTasks } from "@/lib/projects";
import { STATUS_COLORS, STATUS_LABELS } from "./ProjectCard";
import ProjectDetail from "./ProjectDetail";

type Props = {
  projects: ProjectWithTasks[];
  onRefresh: () => void;
};

export default function TimelineView({ projects, onRefresh }: Props) {
  const [selectedProject, setSelectedProject] = useState<ProjectWithTasks | null>(null);

  const withDeadline = projects
    .filter((p) => p.deadline && p.status !== "ARCHIVED")
    .sort(
      (a, b) =>
        new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime()
    );

  const withoutDeadline = projects.filter(
    (p) => !p.deadline && p.status !== "ARCHIVED"
  );

  function getTimeProgress(project: ProjectWithTasks): number {
    if (!project.deadline) return 0;
    const start = project.createdAt.getTime();
    const end = new Date(project.deadline).getTime();
    const now = Date.now();
    if (now >= end) return 100;
    if (now <= start) return 0;
    return Math.round(((now - start) / (end - start)) * 100);
  }

  function isOverdue(project: ProjectWithTasks): boolean {
    return (
      !!project.deadline &&
      new Date(project.deadline) < new Date() &&
      project.status !== "DONE"
    );
  }

  function formatDate(date: Date) {
    return new Date(date).toLocaleDateString("es-AR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  const allItems = [...withDeadline, ...withoutDeadline];

  return (
    <>
      <div className="space-y-3">
        {allItems.map((project) => {
          const progress = getTimeProgress(project);
          const overdue = isOverdue(project);
          const taskProgress =
            project.tasks.length > 0
              ? Math.round(
                  (project.tasks.filter((t) => t.done).length /
                    project.tasks.length) *
                    100
                )
              : 0;

          return (
            <div
              key={project.id}
              onClick={() => setSelectedProject(project)}
              className="card p-4 cursor-pointer hover:border-amber-500/30 transition-all"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-[var(--text-primary)] truncate">
                      {project.title}
                    </span>
                    {project.notionId && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded
                        bg-amber-500/10 text-amber-400 flex-shrink-0">
                        Notion
                      </span>
                    )}
                  </div>

                  {project.description && (
                    <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-1">
                      {project.description}
                    </p>
                  )}
                </div>

                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLORS[project.status]}`}
                >
                  {STATUS_LABELS[project.status]}
                </span>
              </div>

              {project.deadline ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className={`flex items-center gap-1 ${overdue ? "text-red-400" : "text-[var(--text-muted)]"}`}>
                      <Calendar className="w-3 h-3" />
                      {overdue ? "Vencido: " : "Deadline: "}
                      {formatDate(project.deadline)}
                    </div>
                    <span className="text-[var(--text-muted)]">
                      Tiempo: {progress}%
                    </span>
                  </div>

                  {/* Barra de progreso de tiempo */}
                  <div className="h-1.5 rounded-full bg-[var(--surface-hover)] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        overdue
                          ? "bg-red-500"
                          : progress > 75
                          ? "bg-orange-500"
                          : "bg-amber-500"
                      }`}
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>

                  {/* Barra de progreso de tareas */}
                  {project.tasks.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 rounded-full bg-[var(--surface-hover)]">
                        <div
                          className="h-full rounded-full bg-green-500"
                          style={{ width: `${taskProgress}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)] flex-shrink-0">
                        {project.tasks.filter((t) => t.done).length}/{project.tasks.length} tareas
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-[var(--text-muted)] italic">
                  Sin fecha límite
                  {project.tasks.length > 0 && ` · ${project.tasks.filter((t) => t.done).length}/${project.tasks.length} tareas`}
                </div>
              )}
            </div>
          );
        })}

        {allItems.length === 0 && (
          <div className="text-center py-12 text-[var(--text-muted)]">
            <p className="text-sm">Sin proyectos activos</p>
            <p className="text-xs mt-1">Creá tu primer proyecto con el botón +</p>
          </div>
        )}
      </div>

      {selectedProject && (
        <ProjectDetail
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onUpdated={onRefresh}
          onDeleted={(_id) => {
            setSelectedProject(null);
            onRefresh();
          }}
        />
      )}
    </>
  );
}
```

### Sub-task 6f: ProjectsModuleClient (wrapper principal)

- [ ] **Step 9: Crear components/projects/ProjectsModuleClient.tsx**

```tsx
"use client";

import { useState, useCallback } from "react";
import type { ProjectWithTasks, WeeklyProjectStats } from "@/lib/projects";
import KanbanBoard from "./KanbanBoard";
import TimelineView from "./TimelineView";
import NotionSyncButton from "./NotionSyncButton";
import ProjectsQuickActions from "./ProjectsQuickActions";
import WeeklyProjectStatsComponent from "./WeeklyProjectStats";

type Tab = "kanban" | "timeline";

type Props = {
  initialProjects: ProjectWithTasks[];
  initialStats: WeeklyProjectStats;
};

export default function ProjectsModuleClient({
  initialProjects,
  initialStats,
}: Props) {
  const [tab, setTab] = useState<Tab>("kanban");
  const [projects, setProjects] = useState<ProjectWithTasks[]>(initialProjects);
  const [stats, setStats] = useState<WeeklyProjectStats>(initialStats);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [projectsRes, statsRes] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/projects/weekly-stats"),
      ]);

      if (projectsRes.ok) {
        const d = await projectsRes.json();
        setProjects(d.projects ?? []);
      }
      if (statsRes.ok) {
        const d = await statsRes.json();
        setStats(d.stats ?? { projectsAdvanced: 0, tasksCompleted: 0, activeProjects: 0 });
      }
    } catch {
      // silently fail
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const TABS: { id: Tab; label: string }[] = [
    { id: "kanban", label: "Kanban" },
    { id: "timeline", label: "Timeline" },
  ];

  return (
    <div className="space-y-4">
      {/* Stats */}
      <WeeklyProjectStatsComponent stats={stats} />

      {/* Tab navigation + Notion sync */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1 bg-[var(--surface-hover)] rounded-xl p-1 flex-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id
                  ? "bg-[var(--surface)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <NotionSyncButton onSynced={refreshAll} />
      </div>

      {/* Tabs */}
      {tab === "kanban" && (
        <KanbanBoard
          projects={projects}
          onProjectsChange={setProjects}
          onRefresh={refreshAll}
        />
      )}

      {tab === "timeline" && (
        <TimelineView projects={projects} onRefresh={refreshAll} />
      )}

      {/* FAB */}
      <ProjectsQuickActions onCreated={refreshAll} />
    </div>
  );
}
```

- [ ] **Step 10: Commit todos los componentes**

```bash
git add components/projects/
git commit -m "feat(projects): add all 8 React components (KanbanBoard, ProjectDetail, Timeline, etc.)"
```

---

## Task 7: Página + Agente

**Files:**
- Modify: `app/(app)/projects/page.tsx`
- Modify: `agents/projects/index.ts`
- Modify: `.env.local.example`

- [ ] **Step 1: Actualizar app/(app)/projects/page.tsx**

```tsx
// ============================================================
// Módulo de Proyectos — /projects — Sesión 6
// Server Component: carga datos iniciales en paralelo
// ============================================================

import { FolderKanban } from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getAllProjects, getWeeklyStats } from "@/lib/projects";
import ProjectsModuleClient from "@/components/projects/ProjectsModuleClient";

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  const [projects, stats] = await Promise.all([
    getAllProjects(userId).catch(() => []),
    getWeeklyStats(userId).catch(() => ({
      projectsAdvanced: 0,
      tasksCompleted: 0,
      activeProjects: 0,
    })),
  ]);

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

      <ProjectsModuleClient initialProjects={projects} initialStats={stats} />
    </div>
  );
}
```

- [ ] **Step 2: Implementar agents/projects/index.ts**

```typescript
// ============================================================
// Agente de Proyectos — agents/projects/index.ts
// Sesión 6 — NLP para CRUD de proyectos y tareas
// ============================================================

import { db } from "@/lib/db";
import {
  getAllProjects,
  createProject,
  updateProject,
  updateTask,
  getTodayProjectsSummary,
} from "@/lib/projects";
import { syncNotionToProjects } from "@/lib/notion";
import type { AgentInput, AgentOutput } from "@/lib/types";

// -------------------------------------------------------
// Normalización de texto (sin acentos)
// -------------------------------------------------------

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .split("")
    .filter((c) => {
      const code = c.charCodeAt(0);
      return code < 0x0300 || code > 0x036f;
    })
    .join("");
}

// -------------------------------------------------------
// Detección de intención
// -------------------------------------------------------

type Intention =
  | "create"
  | "update_status"
  | "task_done"
  | "query"
  | "sync_notion"
  | "unknown";

function detectIntention(text: string): Intention {
  const n = normalize(text);

  if (/sync notion|actualiza notion|traer tareas|importar notion/.test(n)) {
    return "sync_notion";
  }

  if (
    /nuevo proyecto|crear proyecto|agregar proyecto|quiero hacer un proyecto/.test(n)
  ) {
    return "create";
  }

  if (
    /movi|cambie|pase a|complete el proyecto|termine el proyecto|marcar como/.test(n)
  ) {
    return "update_status";
  }

  if (
    /hice|termine la tarea|complete la tarea|check|listo la tarea|marque como hecho/.test(
      n
    )
  ) {
    return "task_done";
  }

  if (
    /mis proyectos|que tengo|como voy|cuantos proyectos|resumen proyectos/.test(
      n
    )
  ) {
    return "query";
  }

  return "unknown";
}

// -------------------------------------------------------
// Handlers por intención
// -------------------------------------------------------

async function handleCreate(userId: string, text: string): Promise<string> {
  // Extraer título: lo que viene después de "nuevo/crear/agregar proyecto"
  const match = text.match(
    /(?:nuevo|crear?|agregar?)\s+proyecto[:\s]+(.+)/i
  );
  const title = match?.[1]?.trim();

  if (!title) {
    return "¿Cómo se llama el proyecto que querés crear?";
  }

  await createProject(userId, { title });
  return `✅ Proyecto "${title}" creado en la columna TODO.`;
}

async function handleUpdateStatus(userId: string, text: string): Promise<string> {
  const projects = await getAllProjects(userId);

  if (projects.length === 0) {
    return "No tenés proyectos creados.";
  }

  const n = normalize(text);

  // Detectar el nuevo status
  let newStatus: "TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED" | null = null;
  if (/en progreso|empece|inicio|comenzar|in.progress/.test(n)) newStatus = "IN_PROGRESS";
  else if (/termin|complet|hecho|done|listo/.test(n)) newStatus = "DONE";
  else if (/archiv/.test(n)) newStatus = "ARCHIVED";
  else if (/todo|pendiente|por hacer/.test(n)) newStatus = "TODO";

  if (!newStatus) {
    return "No entendí el estado. Decime: en progreso, terminado, archivado o pendiente.";
  }

  // Buscar el proyecto mencionado
  let projectToUpdate = projects.find((p) =>
    normalize(text).includes(normalize(p.title))
  );

  if (!projectToUpdate) {
    // Si hay un solo proyecto, actualizar ese
    if (projects.length === 1) {
      projectToUpdate = projects[0];
    } else {
      const activeProjects = projects.filter(
        (p) => p.status === "TODO" || p.status === "IN_PROGRESS"
      );
      if (activeProjects.length === 1) {
        projectToUpdate = activeProjects[0];
      } else {
        return `¿Cuál proyecto querés mover? Tenés: ${projects
          .slice(0, 3)
          .map((p) => `"${p.title}"`)
          .join(", ")}`;
      }
    }
  }

  await updateProject(userId, projectToUpdate.id, { status: newStatus });

  const statusLabel = {
    TODO: "Por hacer",
    IN_PROGRESS: "En progreso",
    DONE: "Terminado",
    ARCHIVED: "Archivado",
  }[newStatus];

  return `✅ "${projectToUpdate.title}" movido a ${statusLabel}.`;
}

async function handleTaskDone(userId: string, text: string): Promise<string> {
  const projects = await getAllProjects(userId);
  const n = normalize(text);

  // Buscar la tarea más mencionada
  let taskToUpdate: { id: string; title: string } | null = null;
  let projectTitle = "";

  for (const project of projects) {
    for (const task of project.tasks) {
      if (!task.done && normalize(task.title).split(" ").some((word) => word.length > 3 && n.includes(word))) {
        taskToUpdate = task;
        projectTitle = project.title;
        break;
      }
    }
    if (taskToUpdate) break;
  }

  if (!taskToUpdate) {
    // Buscar en todos los proyectos por nombre parcial
    const allTasks = projects.flatMap((p) =>
      p.tasks
        .filter((t) => !t.done)
        .map((t) => ({ ...t, projectTitle: p.title }))
    );

    if (allTasks.length === 0) {
      return "No tenés tareas pendientes en tus proyectos.";
    }

    return `¿Cuál tarea completaste? Las pendientes son:\n${allTasks
      .slice(0, 5)
      .map((t) => `• "${t.title}" (${t.projectTitle})`)
      .join("\n")}`;
  }

  await updateTask(userId, taskToUpdate.id, { done: true });
  return `✅ Tarea "${taskToUpdate.title}" marcada como completada en "${projectTitle}".`;
}

async function handleQuery(userId: string): Promise<string> {
  const projects = await getAllProjects(userId);

  if (projects.length === 0) {
    return "No tenés proyectos creados. Creá uno con \"nuevo proyecto: [nombre]\".";
  }

  const byStatus = {
    TODO: projects.filter((p) => p.status === "TODO"),
    IN_PROGRESS: projects.filter((p) => p.status === "IN_PROGRESS"),
    DONE: projects.filter((p) => p.status === "DONE"),
  };

  const lines: string[] = ["📋 *Tus proyectos:*\n"];

  if (byStatus.IN_PROGRESS.length > 0) {
    lines.push(`*En progreso (${byStatus.IN_PROGRESS.length}):*`);
    byStatus.IN_PROGRESS.forEach((p) => {
      const doneCount = p.tasks.filter((t) => t.done).length;
      const total = p.tasks.length;
      const progress = total > 0 ? ` ${doneCount}/${total}` : "";
      lines.push(`  • ${p.title}${progress}`);
    });
    lines.push("");
  }

  if (byStatus.TODO.length > 0) {
    lines.push(`*Pendientes (${byStatus.TODO.length}):*`);
    byStatus.TODO.slice(0, 3).forEach((p) => lines.push(`  • ${p.title}`));
    if (byStatus.TODO.length > 3) {
      lines.push(`  ...y ${byStatus.TODO.length - 3} más`);
    }
    lines.push("");
  }

  if (byStatus.DONE.length > 0) {
    lines.push(`*Terminados esta semana: ${byStatus.DONE.length}* ✓`);
  }

  return lines.join("\n").trim();
}

async function handleSyncNotion(userId: string): Promise<string> {
  const result = await syncNotionToProjects(userId);

  if (result.errors.length > 0 && result.synced === 0) {
    return `❌ ${result.errors[0]}`;
  }

  const parts = [];
  if (result.created > 0) parts.push(`${result.created} creados`);
  if (result.updated > 0) parts.push(`${result.updated} actualizados`);

  if (parts.length === 0) {
    return "✅ Notion sincronizado — sin cambios nuevos.";
  }

  return `✅ Notion sincronizado: ${parts.join(", ")}.`;
}

// -------------------------------------------------------
// Función principal exportada
// -------------------------------------------------------

export async function processProjectsMessage(
  userId: string,
  text: string
): Promise<string> {
  const intention = detectIntention(text);

  switch (intention) {
    case "create":
      return handleCreate(userId, text);
    case "update_status":
      return handleUpdateStatus(userId, text);
    case "task_done":
      return handleTaskDone(userId, text);
    case "query":
      return handleQuery(userId);
    case "sync_notion":
      return handleSyncNotion(userId);
    default:
      return (
        "No entendí. Podés decirme:\n" +
        "• \"nuevo proyecto: [nombre]\"\n" +
        "• \"moví [proyecto] a en progreso\"\n" +
        "• \"terminé la tarea [nombre]\"\n" +
        "• \"mis proyectos\"\n" +
        "• \"sync notion\""
      );
  }
}

/**
 * Resumen compacto para el Morning Summary (Sesión 8)
 */
export async function getProjectsSummaryText(
  userId: string,
  _date?: Date
): Promise<string> {
  return getTodayProjectsSummary(userId);
}

// -------------------------------------------------------
// Objeto agente (compatible con interfaz del orquestrador)
// -------------------------------------------------------

export const projectsAgent = {
  name: "projects",
  description: "Gestiona proyectos personales y tareas de trabajo",

  async process(input: AgentInput): Promise<AgentOutput> {
    try {
      const response = await processProjectsMessage(input.userId, input.message);
      return { success: true, message: response };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      return { success: false, message: `Error en módulo de proyectos: ${message}` };
    }
  },

  async syncNotion(userId: string): Promise<void> {
    await syncNotionToProjects(userId);
  },

  async calculateScore(userId: string, date: Date): Promise<number> {
    const { calcProjectsScoreForDate } = await import("@/lib/scoring");
    const result = await calcProjectsScoreForDate(userId, date);
    return result.score ?? 0;
  },
};
```

- [ ] **Step 3: Actualizar .env.local.example**

Agregar al final del archivo `.env.local.example`:

```env
# Notion Integration (Sesión 6)
# Estos valores se guardan en UserSettings por usuario
# Las vars de entorno son fallback si el usuario no configuró sus credenciales
NOTION_TOKEN=   # Integration token de Notion (secret_xxx)
NOTION_DB_ID=   # ID de la base de datos de Notion (xxxxxxxx-xxxx-...)
```

- [ ] **Step 4: Commit página y agente**

```bash
git add app/(app)/projects/page.tsx agents/projects/index.ts .env.local.example
git commit -m "feat(projects): implement projects page Server Component and NLP agent"
```

---

## Task 8: Build, corrección de TypeScript, y skill

**Files:**
- Create: `skills/projects.md`

- [ ] **Step 1: Correr build completo**

```bash
cd "C:\Users\Usuario\OneDrive\Desktop\CLAUDIO\App personal"
npm run build 2>&1 | tail -50
```

- [ ] **Step 2: Corregir errores de TypeScript**

Si hay errores, corregirlos archivo por archivo. Los más comunes en este proyecto:

1. **`@hello-pangea/dnd` DragHandleProps**: El tipo correcto es `DraggableProvidedDragHandleProps | null`. Corregir en `ProjectCard.tsx` si el spread falla.

2. **`ProjectStatus` import**: Verificar que los componentes que usan `ProjectStatus` lo importen de `@prisma/client`, no de `@/lib/projects`.

3. **`notionToken`/`notionDbId` en UserSettings**: Si el `db.userSettings.findUnique` no reconoce los campos nuevos, ejecutar `npm run db:generate` nuevamente.

4. **TimelineView `onDeleted` prop**: El handler recibe `id: string`, verificar que el callback no pase argumentos extra.

5. **`@notionhq/client` PageObjectResponse**: Si hay error de import, usar:
```typescript
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
```

- [ ] **Step 3: Re-run build hasta que pase sin errores**

```bash
npm run build
```

Expected: `✓ Compiled successfully`

- [ ] **Step 4: Crear skills/projects.md**

Ver contenido al final de este plan.

- [ ] **Step 5: Commit final**

```bash
git add skills/projects.md
git commit -m "feat(projects): Session 6 complete — Kanban board, Notion sync, NLP agent, scoring"
```

---

## Contenido de skills/projects.md

```markdown
# skills/projects.md
> Sesión 6 — Módulo de Proyectos
> Generado: Mayo 2026

---

## Cambios al Schema de Prisma

Campos nuevos en `UserSettings`:
- `notionToken String?` — Integration token de Notion por usuario
- `notionDbId  String?` — ID de la base de datos de Notion por usuario

Los modelos `Project` y `ProjectTask` ya existían desde Sesión 1.

Migración: `npm run db:push && npm run db:generate`

---

## lib/projects.ts

**Tipos exportados:**
- `ProjectWithTasks` — Project con tasks[] anidadas
- `ProjectTaskData` — ProjectTask individual
- `WeeklyProjectStats` — { projectsAdvanced, tasksCompleted, activeProjects }
- (Nota: `ProjectSummary` ya existe en `lib/types.ts` — no se redeclara aquí)

**Funciones:**
- `getAllProjects(userId)` → ordenados por order ASC
- `getProjectsByStatus(userId, status)` → filtrado por status
- `getProject(userId, projectId)` → con verificación de ownership
- `createProject(userId, data)` → order auto-calculado como max+1
- `updateProject(userId, projectId, data)` → con verificación de ownership
- `deleteProject(userId, projectId)` → cascade configurado en Prisma
- `reorderProjects(userId, projectIds)` → transacción atómica
- `createTask(projectId, userId, title)` → verifica ownership via join
- `updateTask(userId, taskId, data)` → verifica ownership via join
- `deleteTask(userId, taskId)` → verifica ownership via join
- `getWeeklyStats(userId)` → últimos 7 días
- `getTodayProjectsSummary(userId)` → string compacto para dashboard

---

## lib/notion.ts

Integración **READ-ONLY** con Notion API.

**Tipos:**
- `NotionTask` — { notionId, title, status, deadline? }
- `NotionSyncResult` — { synced, created, updated, errors[] }

**Funciones:**
- `getNotionClient(token)` → instancia de @notionhq/client
- `fetchNotionTasks(token, databaseId)` → paginación automática
- `syncNotionToProjects(userId)` → upsert por notionId

**Mapeo de status:**
- "In progress" / "Doing" → IN_PROGRESS
- "Done" / "Completed" → DONE
- Todo lo demás → TODO

**Credenciales:** lee de `UserSettings.notionToken` y `UserSettings.notionDbId`. Fallback a `process.env.NOTION_TOKEN` y `process.env.NOTION_DB_ID`. Si ninguno, retorna error sin tirar excepción.

**Proyectos de Notion:** tienen `color: "amber-600"` para distinción visual.

---

## lib/scoring.ts (actualización Sesión 6)

### calcProjectsScore — Criterios nuevos

| Bloque | Puntos | Criterio |
|--------|--------|----------|
| Actividad | 40 | Al menos 1 tarea completada hoy |
| Actividad bonus | +20 | 2 o más tareas completadas hoy |
| Estado | 20 | Al menos 1 proyecto IN_PROGRESS |
| Deadlines | 20 | Sin deadlines vencidos |

**Null vs 0:**
- `null` = sin proyectos creados
- `0` = hay proyectos pero sin actividad hoy (igual evalúa estado para el detalle)

### Exportación
```typescript
export async function calcProjectsScoreForDate(
  userId: string,
  date: Date
): Promise<ModuleScoreResult>
```

---

## API Routes

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/projects` | Todos los proyectos con tareas |
| POST | `/api/projects` | Crear proyecto |
| GET | `/api/projects/[id]` | Proyecto por ID |
| PATCH | `/api/projects/[id]` | Actualizar proyecto |
| DELETE | `/api/projects/[id]` | Eliminar proyecto |
| POST | `/api/projects/reorder` | Reordenar — body: `{ projectIds }` |
| POST | `/api/projects/[id]/tasks` | Crear tarea |
| PATCH | `/api/projects/tasks/[taskId]` | Actualizar tarea |
| DELETE | `/api/projects/tasks/[taskId]` | Eliminar tarea |
| GET | `/api/projects/weekly-stats` | Stats semanales |
| POST | `/api/projects/sync-notion` | Sync desde Notion |

**Sin cron jobs** — el sync de Notion es manual (botón en la UI).

---

## Componentes React

Todos en `components/projects/`. Todos son Client Components (`"use client"`).

| Componente | Props principales | Descripción |
|------------|-------------------|-------------|
| `ProjectsModuleClient` | `initialProjects`, `initialStats` | Wrapper con tabs Kanban/Timeline + FAB + stats |
| `KanbanBoard` | `projects`, `onProjectsChange`, `onRefresh` | Drag-and-drop con @hello-pangea/dnd, 4 columnas |
| `ProjectCard` | `project`, `onClick`, `dragHandleProps?` | Card arrastrable con barra de progreso + badge Notion |
| `ProjectDetail` | `project`, `onClose`, `onUpdated`, `onDeleted` | Modal/panel con edición inline de todo |
| `TimelineView` | `projects`, `onRefresh` | Cronología con barra de tiempo + barra de tareas |
| `NotionSyncButton` | `onSynced?` | Botón con estado de carga y resultado del sync |
| `ProjectsQuickActions` | `onCreated` | FAB "+" flotante con form inline |
| `WeeklyProjectStats` | `stats` | 3 stat cards: activos, tareas, avanzados |

### Drag-and-drop
- Usa `@hello-pangea/dnd` (fork de react-beautiful-dnd compatible con React 18+)
- Droppable por status (4 columnas)
- Al soltar: actualiza status si cambió de columna + reordena vía API
- Actualización optimista del estado local antes de persistir

### ProjectDetail — edición inline
- Título: `input` con `onBlur` → PATCH
- Descripción: `textarea` con `onBlur` → PATCH
- Status: `select` con `onChange` → PATCH
- Deadline: `input type="date"` con `onChange` → PATCH
- Tareas: toggle inmediato + add inline + delete con hover
- Delete proyecto: doble confirmación (click → confirma en 3s)

---

## Página /app/(app)/projects/page.tsx

Server Component. Carga en paralelo:
1. `getAllProjects(userId)` — con catch → []
2. `getWeeklyStats(userId)` — con catch → zeros

Pasa todo a `ProjectsModuleClient`.

---

## Agente /agents/projects/index.ts

**Intenciones detectadas** (normalización NFD):
- `create` — "nuevo/crear/agregar proyecto: [título]"
- `update_status` — "moví/cambié/pasé a/completé/terminé el proyecto"
- `task_done` — "hice/terminé la tarea/completé la tarea/check/listo"
- `query` — "mis proyectos/qué tengo/cómo voy/cuántos proyectos"
- `sync_notion` — "sync notion/actualiza notion/traer tareas"
- `unknown` — fallback con ayuda

**Funciones exportadas:**
- `processProjectsMessage(userId, text)` → string de respuesta
- `getProjectsSummaryText(userId, date?)` → string compacto para Morning Summary (Sesión 8)
- `projectsAgent` — objeto compatible con orquestrador

**Lógica de matching de proyectos/tareas:**
- Busca por nombre exacto en el texto
- Si hay un solo proyecto activo, lo usa por defecto
- Si hay ambigüedad, lista las opciones y pide aclaración

---

## Variables de entorno

```env
# Notion Integration (Sesión 6)
NOTION_TOKEN=   # Integration token de Notion (secret_xxx) — fallback global
NOTION_DB_ID=   # ID de la DB de Notion — fallback global
# Estos valores se guardan en UserSettings por usuario
```

---

## Dependencias nuevas

```json
"@hello-pangea/dnd": "^x.x.x",  // Drag and drop Kanban
"@notionhq/client": "^x.x.x"    // Notion API client
```

---

## Comandos

```bash
# Schema
npm run db:push
npm run db:generate

# Dev
npm run dev

# Build
npm run build

# Test sync Notion
curl -X POST http://localhost:3000/api/projects/sync-notion

# Test crear proyecto
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"title":"Mi nuevo proyecto"}'
```

---

*Sesión 6 completada — Mayo 2026*
```

---

## Notas importantes para el ejecutor

1. **Orden de ejecución**: Respetar el orden de las tasks. `lib/projects.ts` y `lib/notion.ts` son dependencias de las API routes y componentes.

2. **`@hello-pangea/dnd` SSR**: Este paquete puede tener issues con SSR. Los componentes que lo usan YA están marcados como `"use client"`, así que no debería haber problema. Si `build` falla con hydration errors, agregar `dynamic(() => import('./KanbanBoard'), { ssr: false })` en `ProjectsModuleClient`.

3. **Import de `ProjectStatus`**: Importar siempre de `@prisma/client`, no de `@/lib/projects`. El tipo de Prisma es el canónico.

4. **`dragHandleProps` en ProjectCard**: El tipo de `DraggableProvidedDragHandleProps` de `@hello-pangea/dnd` es `DraggableProvidedDragHandleProps | null`. El spread `{...dragHandleProps}` puede generar un warning de TypeScript si se pasa `undefined`. Verificar en el build y usar `dragHandleProps ?? {}` si es necesario.

5. **Notion API — paginación**: `fetchNotionTasks` implementa paginación via `cursor`. Si la DB tiene menos de 100 items, el loop se ejecuta una sola vez. Manejo correcto de `next_cursor: null`.

6. **Scoring null vs 0**: La función `calcProjectsScore` retorna `null` solo si `totalProjects === 0`. Si hay proyectos pero no hubo actividad, retorna un score positivo si tiene proyectos en progreso o sin deadlines vencidos (mínimo 0, máximo 40 sin actividad).

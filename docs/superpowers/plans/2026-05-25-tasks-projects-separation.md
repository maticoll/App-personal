# Tasks / Projects Separation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar `/projects` en dos páginas: `/tasks` (operacional — kanban, tareas de la semana, historial) y `/projects` (estratégico — lista limpia de proyectos activos).

**Architecture:** Se crea un módulo `lib/tasks.ts` independiente que consulta `ProjectTask` con los nuevos campos (`completedAt`, `dueDate`, `priority`). Los componentes de Kanban/Timeline se mueven intactos a `/tasks`. La página `/projects` queda como un overview estratégico minimalista. No se modifica `lib/projects.ts` ni los agentes de WhatsApp.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma 5 (Supabase/PostgreSQL), Tailwind CSS, lucide-react, Material Symbols, @hello-pangea/dnd (SSR-off).

---

## File Map

### Archivos nuevos
| Archivo | Responsabilidad |
|---|---|
| `prisma/schema.prisma` | +3 campos en `ProjectTask`: `completedAt`, `dueDate`, `priority` |
| `lib/tasks.ts` | Tipos + funciones de lectura/escritura de tareas (no toca lib/projects.ts) |
| `app/api/tasks/route.ts` | GET (this_week, completed) + POST (tarea standalone) |
| `app/api/tasks/[id]/route.ts` | PATCH (completar/editar) + DELETE |
| `app/(app)/tasks/page.tsx` | Server Component — carga inicial paralela |
| `components/tasks/NotionBadge.tsx` | Chip amber "N" para tareas de Notion |
| `components/tasks/TaskItem.tsx` | Fila de tarea reutilizable (checkbox, título, badges, acciones) |
| `components/tasks/TaskQuickAdd.tsx` | Formulario inline: título + dueDate opcional |
| `components/tasks/ThisWeekTasksList.tsx` | Section A: pendientes + completadas hoy con fade-out |
| `components/tasks/CompletedTasksSection.tsx` | Section C: historial con pills de período |
| `components/tasks/TasksPageClient.tsx` | Wrapper client con todo el estado de /tasks |

### Archivos modificados
| Archivo | Cambio |
|---|---|
| `app/(app)/projects/page.tsx` | Solo carga proyectos activos (IN_PROGRESS, PLANNING) |
| `components/projects/ProjectsModuleClient.tsx` | Elimina kanban/timeline/notion/stats; solo ProjectCard + ProjectDetail + FAB |
| `app/api/projects/tasks/[taskId]/route.ts` | PATCH también setea `completedAt` al marcar done=true |
| `components/layout/BottomNav.tsx` | Reemplaza Settings por Tareas (task_alt, amber) |
| `components/layout/Sidebar.tsx` | Agrega /tasks con CheckSquare amber después de /projects |

---

## Task 1: Schema — Agregar campos a ProjectTask

**Files:**
- Modify: `prisma/schema.prisma` (bloque ProjectTask, ~líneas 364-380)

- [ ] **Step 1: Editar `prisma/schema.prisma`** — agregar los 3 campos nuevos al modelo `ProjectTask`:

```prisma
model ProjectTask {
  id        String  @id @default(cuid())
  projectId String
  title     String
  done      Boolean @default(false)
  order     Int     @default(0)

  // Nuevos campos — Tasks module
  completedAt DateTime?   // cuándo se completó (null = pendiente)
  dueDate     DateTime?   // fecha límite opcional
  priority    String?     // "low" | "medium" | "high"

  // Integración Notion
  notionId String? @unique

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@map("project_tasks")
}
```

- [ ] **Step 2: Ejecutar SQL en Supabase** (NO usar `prisma db push`):

```sql
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMPTZ;
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMPTZ;
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS "priority" TEXT;
```

- [ ] **Step 3: Regenerar el cliente de Prisma:**

```bash
cd "C:\Users\Usuario\OneDrive\Desktop\CLAUDIO\App personal"
npx prisma generate
```

Expected: `✔ Generated Prisma Client` sin errores.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add completedAt, dueDate, priority to ProjectTask"
```

---

## Task 2: `lib/tasks.ts` — Módulo de tareas

**Files:**
- Create: `lib/tasks.ts`

- [ ] **Step 1: Crear `lib/tasks.ts`** con todos los tipos y funciones:

```typescript
// ============================================================
// lib/tasks.ts — Módulo de Tareas
// Lee ProjectTask con los campos nuevos (completedAt, dueDate, priority)
// NO modifica lib/projects.ts
// ============================================================

import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

// -------------------------------------------------------
// Tipos exportados
// -------------------------------------------------------

export type TaskStatus = "TODO" | "DONE";
export type TaskSource = "notion" | "manual";
export type TaskPeriod = "this_week" | "last_week" | "this_month" | "all";

export type TaskItem = {
  id: string;
  title: string;
  status: TaskStatus;
  dueDate: Date | null;
  completedAt: Date | null;
  priority: string | null;
  source: TaskSource;
  projectId: string | null;
  projectName: string | null;
  createdAt: Date;
};

export type CreateTaskInput = {
  title: string;
  dueDate?: Date;
  priority?: string;
  projectId?: string;
};

export type TasksStats = {
  pending: number;
  completedThisWeek: number;
  notionCount: number;
};

// -------------------------------------------------------
// Helpers de fecha
// -------------------------------------------------------

function getISOWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // Ajustar a lunes (ISO week empieza en lunes)
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getISOWeekEnd(weekStart: Date): Date {
  const sunday = new Date(weekStart);
  sunday.setDate(weekStart.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}

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

// -------------------------------------------------------
// Mapper: Prisma result → TaskItem
// -------------------------------------------------------

type RawTask = Prisma.ProjectTaskGetPayload<{
  include: { project: { select: { title: true } } };
}>;

function toTaskItem(raw: RawTask): TaskItem {
  return {
    id: raw.id,
    title: raw.title,
    status: raw.done ? "DONE" : "TODO",
    dueDate: raw.dueDate ?? null,
    completedAt: raw.completedAt ?? null,
    priority: raw.priority ?? null,
    source: raw.notionId ? "notion" : "manual",
    projectId: raw.projectId,
    projectName: raw.project?.title ?? null,
    createdAt: raw.createdAt,
  };
}

const taskInclude = {
  project: { select: { title: true } },
} as const;

// -------------------------------------------------------
// Lectura
// -------------------------------------------------------

/**
 * Tareas de esta semana:
 * - Pendientes con dueDate en la semana ISO actual
 * - Pendientes sin dueDate creadas esta semana
 * - Completadas hoy (para feedback visual antes del fade-out)
 */
export async function getThisWeekTasks(userId: string): Promise<TaskItem[]> {
  const now = new Date();
  const weekStart = getISOWeekStart(now);
  const weekEnd = getISOWeekEnd(weekStart);
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const rows = await db.projectTask.findMany({
    where: {
      project: { userId },
      OR: [
        // Pendientes con dueDate esta semana
        {
          done: false,
          dueDate: { gte: weekStart, lte: weekEnd },
        },
        // Pendientes sin dueDate, creadas esta semana
        {
          done: false,
          dueDate: null,
          createdAt: { gte: weekStart, lte: weekEnd },
        },
        // Completadas hoy (feedback visual)
        {
          done: true,
          completedAt: { gte: todayStart, lte: todayEnd },
        },
      ],
    },
    include: taskInclude,
    orderBy: [{ done: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }],
  });

  return rows.map(toTaskItem);
}

/**
 * Tareas completadas por período
 */
export async function getCompletedTasks(
  userId: string,
  period: TaskPeriod
): Promise<TaskItem[]> {
  const now = new Date();
  let dateFilter: Prisma.ProjectTaskWhereInput["completedAt"];

  switch (period) {
    case "this_week": {
      const weekStart = getISOWeekStart(now);
      const weekEnd = getISOWeekEnd(weekStart);
      dateFilter = { gte: weekStart, lte: weekEnd };
      break;
    }
    case "last_week": {
      const thisWeekStart = getISOWeekStart(now);
      const lastWeekStart = new Date(thisWeekStart);
      lastWeekStart.setDate(thisWeekStart.getDate() - 7);
      const lastWeekEnd = getISOWeekEnd(lastWeekStart);
      dateFilter = { gte: lastWeekStart, lte: lastWeekEnd };
      break;
    }
    case "this_month": {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      dateFilter = { gte: monthStart, lte: monthEnd };
      break;
    }
    case "all":
    default:
      dateFilter = { not: null };
      break;
  }

  const rows = await db.projectTask.findMany({
    where: {
      project: { userId },
      done: true,
      completedAt: dateFilter,
    },
    include: taskInclude,
    orderBy: { completedAt: "desc" },
  });

  return rows.map(toTaskItem);
}

// -------------------------------------------------------
// Escritura
// -------------------------------------------------------

export async function createStandaloneTask(
  userId: string,
  data: CreateTaskInput
): Promise<TaskItem> {
  // Si no hay projectId, se necesita un proyecto "Standalone"
  // Pero el schema requiere projectId — creamos/buscamos un proyecto especial
  let projectId = data.projectId;

  if (!projectId) {
    // Buscar o crear proyecto "Tareas sueltas"
    let standalone = await db.project.findFirst({
      where: { userId, title: "Tareas sueltas" },
    });
    if (!standalone) {
      standalone = await db.project.create({
        data: { userId, title: "Tareas sueltas", status: "IN_PROGRESS", order: 9999 },
      });
    }
    projectId = standalone.id;
  } else {
    // Verificar ownership
    const project = await db.project.findFirst({
      where: { id: projectId, userId },
    });
    if (!project) throw new Error("Proyecto no encontrado");
  }

  const maxOrder = await db.projectTask.aggregate({
    where: { projectId },
    _max: { order: true },
  });

  const row = await db.projectTask.create({
    data: {
      projectId,
      title: data.title,
      dueDate: data.dueDate ?? null,
      priority: data.priority ?? null,
      order: (maxOrder._max.order ?? 0) + 1,
    },
    include: taskInclude,
  });

  return toTaskItem(row);
}

export async function completeTask(taskId: string, userId: string): Promise<void> {
  const task = await db.projectTask.findFirst({
    where: { id: taskId, project: { userId } },
  });
  if (!task) throw new Error("Tarea no encontrada");

  await db.projectTask.update({
    where: { id: taskId },
    data: { done: true, completedAt: new Date() },
  });
}

export async function uncompleteTask(taskId: string, userId: string): Promise<void> {
  const task = await db.projectTask.findFirst({
    where: { id: taskId, project: { userId } },
  });
  if (!task) throw new Error("Tarea no encontrada");

  await db.projectTask.update({
    where: { id: taskId },
    data: { done: false, completedAt: null },
  });
}

export async function deleteTask(taskId: string, userId: string): Promise<void> {
  const task = await db.projectTask.findFirst({
    where: { id: taskId, project: { userId } },
  });
  if (!task) throw new Error("Tarea no encontrada");

  await db.projectTask.delete({ where: { id: taskId } });
}

export async function getTasksStats(userId: string): Promise<TasksStats> {
  const now = new Date();
  const weekStart = getISOWeekStart(now);
  const weekEnd = getISOWeekEnd(weekStart);

  const [pending, completedThisWeek, notionCount] = await Promise.all([
    db.projectTask.count({
      where: { project: { userId }, done: false },
    }),
    db.projectTask.count({
      where: {
        project: { userId },
        done: true,
        completedAt: { gte: weekStart, lte: weekEnd },
      },
    }),
    db.projectTask.count({
      where: { project: { userId }, done: false, notionId: { not: null } },
    }),
  ]);

  return { pending, completedThisWeek, notionCount };
}
```

- [ ] **Step 2: Verificar que TypeScript compila:**

```bash
cd "C:\Users\Usuario\OneDrive\Desktop\CLAUDIO\App personal"
npx tsc --noEmit
```

Expected: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add lib/tasks.ts
git commit -m "feat(tasks): add lib/tasks.ts with TaskItem types and week/completed queries"
```

---

## Task 3: API Routes — `/api/tasks`

**Files:**
- Create: `app/api/tasks/route.ts`
- Create: `app/api/tasks/[id]/route.ts`

- [ ] **Step 1: Crear `app/api/tasks/route.ts`:**

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getThisWeekTasks,
  getCompletedTasks,
  createStandaloneTask,
  type TaskPeriod,
} from "@/lib/tasks";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const userId = session.user.id;
    const { searchParams } = new URL(req.url);
    const view = searchParams.get("view");
    const period = (searchParams.get("period") ?? "this_week") as TaskPeriod;

    if (view === "completed") {
      const tasks = await getCompletedTasks(userId, period);
      return NextResponse.json({ tasks });
    }

    // default: this_week
    const tasks = await getThisWeekTasks(userId);
    return NextResponse.json({ tasks });
  } catch (err) {
    console.error("[GET /api/tasks]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const body = await req.json() as {
      title: string;
      dueDate?: string;
      priority?: string;
      projectId?: string;
    };
    if (!body.title?.trim()) {
      return NextResponse.json({ error: "Título requerido" }, { status: 400 });
    }
    const task = await createStandaloneTask(session.user.id, {
      title: body.title.trim(),
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      priority: body.priority,
      projectId: body.projectId,
    });
    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/tasks]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Crear `app/api/tasks/[id]/route.ts`:**

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { completeTask, uncompleteTask, deleteTask } from "@/lib/tasks";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const { id } = await params;
    const body = await req.json() as {
      status?: string;
      title?: string;
      dueDate?: string | null;
      priority?: string | null;
      completedAt?: string | null;
    };

    // Si cambia status, usar funciones dedicadas
    if (body.status === "DONE") {
      await completeTask(id, session.user.id);
    } else if (body.status === "TODO") {
      await uncompleteTask(id, session.user.id);
    } else {
      // Actualización de campos
      const task = await db.projectTask.findFirst({
        where: { id, project: { userId: session.user.id } },
      });
      if (!task) {
        return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
      }
      await db.projectTask.update({
        where: { id },
        data: {
          ...(body.title !== undefined && { title: body.title }),
          ...(body.dueDate !== undefined && {
            dueDate: body.dueDate ? new Date(body.dueDate) : null,
          }),
          ...(body.priority !== undefined && { priority: body.priority }),
          ...(body.completedAt !== undefined && {
            completedAt: body.completedAt ? new Date(body.completedAt) : null,
          }),
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PATCH /api/tasks/[id]]", err);
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
    await deleteTask(id, session.user.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/tasks/[id]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Actualizar `app/api/projects/tasks/[taskId]/route.ts`** para que también setee `completedAt` cuando `done = true` (compatibilidad con Kanban):

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { updateTask, deleteTask } from "@/lib/projects";
import { db } from "@/lib/db";

type Params = { params: Promise<{ taskId: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const { taskId } = await params;
    const body = await req.json() as { done?: boolean; title?: string; order?: number };
    const { done, title, order } = body;

    const task = await updateTask(session.user.id, taskId, {
      ...(done !== undefined && { done }),
      ...(title !== undefined && { title }),
      ...(order !== undefined && { order }),
    });

    // Setear completedAt en sincronía con done (no lo hace lib/projects.ts)
    if (done !== undefined) {
      await db.projectTask.update({
        where: { id: taskId },
        data: { completedAt: done ? new Date() : null },
      });
    }

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

- [ ] **Step 4: Verificar TypeScript:**

```bash
npx tsc --noEmit
```

Expected: 0 errores.

- [ ] **Step 5: Commit**

```bash
git add app/api/tasks/route.ts app/api/tasks/[id]/route.ts app/api/projects/tasks/[taskId]/route.ts
git commit -m "feat(api): add /api/tasks routes + sync completedAt in projects PATCH"
```

---

## Task 4: Componentes base — `NotionBadge` + `TaskItem`

**Files:**
- Create: `components/tasks/NotionBadge.tsx`
- Create: `components/tasks/TaskItem.tsx`

- [ ] **Step 1: Crear `components/tasks/NotionBadge.tsx`:**

```typescript
// Chip amber pequeño para tareas sincronizadas desde Notion
export default function NotionBadge() {
  return (
    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-600/20 text-amber-500 text-[9px] font-bold flex-shrink-0">
      N
    </span>
  );
}
```

- [ ] **Step 2: Crear `components/tasks/TaskItem.tsx`:**

```typescript
"use client";

import { useState } from "react";
import { Trash2, Calendar } from "lucide-react";
import NotionBadge from "./NotionBadge";
import type { TaskItem as TaskItemType } from "@/lib/tasks";

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-slate-500",
};

type Props = {
  task: TaskItemType;
  onComplete: (id: string) => void;
  onUncomplete?: (id: string) => void;
  onDelete: (id: string) => void;
  fading?: boolean; // tarea en proceso de fade-out
};

export default function TaskItem({ task, onComplete, onUncomplete, onDelete, fading }: Props) {
  const [deleting, setDeleting] = useState(false);

  const isDone = task.status === "DONE";
  const priorityDot = task.priority ? PRIORITY_DOT[task.priority] : null;

  const formatDate = (d: Date) =>
    new Date(d).toLocaleDateString("es-AR", { day: "numeric", month: "short" });

  const handleCheck = () => {
    if (isDone && onUncomplete) {
      onUncomplete(task.id);
    } else if (!isDone) {
      onComplete(task.id);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    onDelete(task.id);
  };

  return (
    <div
      className={`flex items-center gap-3 py-2.5 px-3 rounded-xl bg-[#1A1D27] border border-white/5 transition-opacity ${
        fading ? "opacity-0 duration-400" : "opacity-100"
      } ${deleting ? "opacity-50" : ""}`}
    >
      {/* Checkbox */}
      <button
        onClick={handleCheck}
        className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
          isDone
            ? "bg-amber-500 border-amber-500"
            : "border-outline hover:border-amber-400"
        }`}
      >
        {isDone && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Priority dot */}
      {priorityDot && (
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${priorityDot}`} />
      )}

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <span
          className={`text-sm ${
            isDone ? "text-slate-500 line-through" : "text-on-surface"
          }`}
        >
          {task.title}
        </span>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {task.projectName && (
            <span className="text-[10px] text-outline">{task.projectName}</span>
          )}
          {task.dueDate && !isDone && (
            <span className="flex items-center gap-0.5 text-[10px] text-outline">
              <Calendar className="w-3 h-3" />
              {formatDate(task.dueDate)}
            </span>
          )}
          {task.completedAt && isDone && (
            <span className="text-[10px] text-slate-600">
              {formatDate(task.completedAt)}
            </span>
          )}
        </div>
      </div>

      {/* Notion badge */}
      {task.source === "notion" && <NotionBadge />}

      {/* Delete */}
      <button
        onClick={handleDelete}
        className="p-1 rounded-lg text-outline hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Verificar TypeScript:**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add components/tasks/NotionBadge.tsx components/tasks/TaskItem.tsx
git commit -m "feat(tasks): add NotionBadge and TaskItem components"
```

---

## Task 5: `TaskQuickAdd.tsx` — Formulario inline

**Files:**
- Create: `components/tasks/TaskQuickAdd.tsx`

- [ ] **Step 1: Crear `components/tasks/TaskQuickAdd.tsx`:**

```typescript
"use client";

import { useState, useRef } from "react";
import { Plus } from "lucide-react";

type Props = {
  onAdd: (title: string, dueDate?: Date) => Promise<void>;
};

export default function TaskQuickAdd({ onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const openForm = () => {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      await onAdd(title.trim(), dueDate ? new Date(dueDate) : undefined);
      setTitle("");
      setDueDate("");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      setTitle("");
      setDueDate("");
    }
  };

  if (!open) {
    return (
      <button
        onClick={openForm}
        className="flex items-center gap-2 w-full py-2.5 px-3 rounded-xl border border-dashed border-outline/30 text-outline hover:border-amber-500/50 hover:text-amber-400 transition-colors text-sm"
      >
        <Plus className="w-4 h-4" />
        Agregar tarea
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="bg-[#1A1D27] rounded-xl border border-amber-500/30 p-3 space-y-2">
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Nombre de la tarea..."
        className="w-full bg-transparent text-sm text-on-surface placeholder:text-outline outline-none"
      />
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="flex-1 bg-surface-container-high text-xs text-on-surface-variant rounded-lg px-2 py-1.5 outline-none border border-outline/20 focus:border-amber-500/50"
        />
        <button
          type="submit"
          disabled={!title.trim() || loading}
          className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-medium disabled:opacity-50 hover:bg-amber-500 transition-colors"
        >
          {loading ? "..." : "Agregar"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setTitle(""); setDueDate(""); }}
          className="px-3 py-1.5 rounded-lg bg-surface-container-high text-outline text-xs hover:text-on-surface transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Verificar TypeScript:**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/tasks/TaskQuickAdd.tsx
git commit -m "feat(tasks): add TaskQuickAdd inline form component"
```

---

## Task 6: `ThisWeekTasksList.tsx` — Section A

**Files:**
- Create: `components/tasks/ThisWeekTasksList.tsx`

- [ ] **Step 1: Crear `components/tasks/ThisWeekTasksList.tsx`:**

```typescript
"use client";

import { useState, useCallback } from "react";
import TaskItem from "./TaskItem";
import TaskQuickAdd from "./TaskQuickAdd";
import type { TaskItem as TaskItemType } from "@/lib/tasks";

type Props = {
  initialTasks: TaskItemType[];
  onTasksChange?: () => void;
};

export default function ThisWeekTasksList({ initialTasks, onTasksChange }: Props) {
  const [tasks, setTasks] = useState<TaskItemType[]>(initialTasks);
  const [fadingIds, setFadingIds] = useState<Set<string>>(new Set());

  const handleComplete = useCallback(async (id: string) => {
    // Optimistic update: marcar como done y agregar a fadingIds
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, status: "DONE" as const, completedAt: new Date() }
          : t
      )
    );
    setFadingIds((prev) => new Set(prev).add(id));

    // Llamar API
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "DONE" }),
    });

    // Remover del DOM después del fade (400ms)
    setTimeout(() => {
      setTasks((prev) => prev.filter((t) => t.id !== id || t.completedAt !== null));
      setFadingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      onTasksChange?.();
    }, 450);
  }, [onTasksChange]);

  const handleUncomplete = useCallback(async (id: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, status: "TODO" as const, completedAt: null } : t
      )
    );
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "TODO" }),
    });
    onTasksChange?.();
  }, [onTasksChange]);

  const handleDelete = useCallback(async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    onTasksChange?.();
  }, [onTasksChange]);

  const handleAdd = useCallback(async (title: string, dueDate?: Date) => {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, dueDate: dueDate?.toISOString() }),
    });
    if (res.ok) {
      const { task } = await res.json() as { task: TaskItemType };
      setTasks((prev) => [task, ...prev]);
    }
  }, []);

  const pending = tasks.filter((t) => t.status === "TODO");
  const completedToday = tasks.filter((t) => t.status === "DONE");

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 tracking-widest uppercase">
        Tareas de esta semana
      </p>

      <div className="space-y-2">
        {pending.length === 0 && completedToday.length === 0 && (
          <p className="text-sm text-outline py-4 text-center">
            No hay tareas para esta semana
          </p>
        )}
        {pending.map((task) => (
          <div key={task.id} className="group">
            <TaskItem
              task={task}
              onComplete={handleComplete}
              onDelete={handleDelete}
              fading={fadingIds.has(task.id)}
            />
          </div>
        ))}
        {completedToday.map((task) => (
          <div key={task.id} className="group">
            <TaskItem
              task={task}
              onComplete={handleComplete}
              onUncomplete={handleUncomplete}
              onDelete={handleDelete}
              fading={fadingIds.has(task.id)}
            />
          </div>
        ))}
      </div>

      <TaskQuickAdd onAdd={handleAdd} />
    </div>
  );
}
```

- [ ] **Step 2: Verificar TypeScript:**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/tasks/ThisWeekTasksList.tsx
git commit -m "feat(tasks): add ThisWeekTasksList with fade-out on completion"
```

---

## Task 7: `CompletedTasksSection.tsx` — Section C

**Files:**
- Create: `components/tasks/CompletedTasksSection.tsx`

- [ ] **Step 1: Crear `components/tasks/CompletedTasksSection.tsx`:**

```typescript
"use client";

import { useState, useEffect } from "react";
import TaskItem from "./TaskItem";
import type { TaskItem as TaskItemType, TaskPeriod } from "@/lib/tasks";

const PERIODS: { id: TaskPeriod; label: string }[] = [
  { id: "this_week", label: "Esta semana" },
  { id: "last_week", label: "Semana pasada" },
  { id: "this_month", label: "Este mes" },
  { id: "all", label: "Todo" },
];

type Props = {
  initialTasks: TaskItemType[];
};

export default function CompletedTasksSection({ initialTasks }: Props) {
  const [period, setPeriod] = useState<TaskPeriod>("this_week");
  const [tasks, setTasks] = useState<TaskItemType[]>(initialTasks);
  const [loading, setLoading] = useState(false);

  const fetchCompleted = async (p: TaskPeriod) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks?view=completed&period=${p}`);
      if (res.ok) {
        const data = await res.json() as { tasks: TaskItemType[] };
        setTasks(data.tasks);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodChange = (p: TaskPeriod) => {
    setPeriod(p);
    fetchCompleted(p);
  };

  const handleDelete = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 tracking-widest uppercase">
        Tareas terminadas
      </p>

      {/* Pills de período */}
      <div className="flex gap-1.5 flex-wrap">
        {PERIODS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => handlePeriodChange(id)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              period === id
                ? "bg-amber-600/20 text-amber-400 border border-amber-600/30"
                : "bg-surface-container-high text-outline hover:text-on-surface-variant border border-transparent"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {loading && (
          <div className="py-4 text-center text-sm text-outline">Cargando...</div>
        )}
        {!loading && tasks.length === 0 && (
          <p className="text-sm text-outline py-4 text-center">
            Sin tareas terminadas en este período
          </p>
        )}
        {!loading &&
          tasks.map((task) => (
            <div key={task.id} className="group">
              <TaskItem
                task={task}
                onComplete={() => {}}
                onDelete={handleDelete}
              />
            </div>
          ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar TypeScript:**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/tasks/CompletedTasksSection.tsx
git commit -m "feat(tasks): add CompletedTasksSection with period filter pills"
```

---

## Task 8: `TasksPageClient.tsx` — Wrapper principal

**Files:**
- Create: `components/tasks/TasksPageClient.tsx`

- [ ] **Step 1: Crear `components/tasks/TasksPageClient.tsx`:**

```typescript
"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { ProjectWithTasks, WeeklyProjectStats } from "@/lib/projects";
import type { TaskItem, TasksStats } from "@/lib/tasks";
import ThisWeekTasksList from "./ThisWeekTasksList";
import CompletedTasksSection from "./CompletedTasksSection";
import NotionSyncButton from "@/components/projects/NotionSyncButton";
import WeeklyProjectStatsComponent from "@/components/projects/WeeklyProjectStats";

const KanbanBoard = dynamic(() => import("@/components/projects/KanbanBoard"), {
  ssr: false,
  loading: () => (
    <div className="h-48 flex items-center justify-center text-outline text-sm">
      Cargando tablero...
    </div>
  ),
});
const TimelineView = dynamic(() => import("@/components/projects/TimelineView"), {
  ssr: false,
});

type BoardTab = "kanban" | "timeline";

type Props = {
  thisWeekTasks: TaskItem[];
  completedTasks: TaskItem[];
  stats: TasksStats;
  projects: ProjectWithTasks[];
  weeklyStats: WeeklyProjectStats;
};

export default function TasksPageClient({
  thisWeekTasks,
  completedTasks,
  stats,
  projects,
  weeklyStats,
}: Props) {
  const [boardTab, setBoardTab] = useState<BoardTab>("kanban");
  const [currentProjects, setCurrentProjects] = useState(projects);
  const [currentWeeklyStats, setCurrentWeeklyStats] = useState(weeklyStats);

  const refreshProjects = async () => {
    try {
      const [pRes, sRes] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/projects/weekly-stats"),
      ]);
      if (pRes.ok) {
        const d = await pRes.json() as { projects: ProjectWithTasks[] };
        setCurrentProjects(d.projects ?? []);
      }
      if (sRes.ok) {
        const d = await sRes.json() as { stats: WeeklyProjectStats };
        setCurrentWeeklyStats(d.stats ?? { projectsAdvanced: 0, tasksCompleted: 0, activeProjects: 0 });
      }
    } catch { /* silently fail */ }
  };

  const BOARD_TABS: { id: BoardTab; label: string }[] = [
    { id: "kanban", label: "Kanban" },
    { id: "timeline", label: "Timeline" },
  ];

  return (
    <div className="space-y-8">
      {/* Stats resumen */}
      <div className="flex items-center gap-4 text-sm text-outline">
        <span><span className="text-on-surface font-semibold">{stats.pending}</span> pendientes</span>
        <span><span className="text-amber-400 font-semibold">{stats.completedThisWeek}</span> completadas esta semana</span>
        {stats.notionCount > 0 && (
          <span><span className="text-on-surface font-semibold">{stats.notionCount}</span> de Notion</span>
        )}
      </div>

      {/* Section A — Tareas de esta semana */}
      <ThisWeekTasksList initialTasks={thisWeekTasks} />

      {/* Section B — Kanban + Timeline */}
      <div className="space-y-4">
        <p className="text-xs text-slate-500 tracking-widest uppercase">
          Proyectos
        </p>

        <WeeklyProjectStatsComponent stats={currentWeeklyStats} />

        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-surface-container-high rounded-xl p-1 flex-1">
            {BOARD_TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setBoardTab(t.id)}
                className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  boardTab === t.id
                    ? "bg-surface-container text-on-surface shadow-sm"
                    : "text-outline hover:text-on-surface-variant"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <NotionSyncButton onSynced={refreshProjects} />
        </div>

        {boardTab === "kanban" && (
          <KanbanBoard
            projects={currentProjects}
            onProjectsChange={setCurrentProjects}
            onRefresh={refreshProjects}
          />
        )}
        {boardTab === "timeline" && (
          <TimelineView projects={currentProjects} onRefresh={refreshProjects} />
        )}
      </div>

      {/* Section C — Tareas terminadas */}
      <CompletedTasksSection initialTasks={completedTasks} />
    </div>
  );
}
```

- [ ] **Step 2: Verificar TypeScript:**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/tasks/TasksPageClient.tsx
git commit -m "feat(tasks): add TasksPageClient wrapper with kanban/timeline + sections"
```

---

## Task 9: `app/(app)/tasks/page.tsx` — Server Component

**Files:**
- Create: `app/(app)/tasks/page.tsx`

- [ ] **Step 1: Crear `app/(app)/tasks/page.tsx`:**

```typescript
import { CheckSquare } from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getThisWeekTasks, getCompletedTasks, getTasksStats } from "@/lib/tasks";
import { getAllProjects, getWeeklyStats } from "@/lib/projects";
import TasksPageClient from "@/components/tasks/TasksPageClient";

export default async function TasksPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  const [thisWeekTasks, completedTasks, stats, projects, weeklyStats] =
    await Promise.all([
      getThisWeekTasks(userId).catch(() => []),
      getCompletedTasks(userId, "this_week").catch(() => []),
      getTasksStats(userId).catch(() => ({
        pending: 0,
        completedThisWeek: 0,
        notionCount: 0,
      })),
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
          <CheckSquare className="w-5 h-5 text-amber-500" />
          <h2 className="text-xl font-bold text-on-surface">Tareas</h2>
        </div>
        <p className="text-sm text-on-surface-variant">
          Lo que hay que hacer esta semana
        </p>
      </div>

      <TasksPageClient
        thisWeekTasks={thisWeekTasks}
        completedTasks={completedTasks}
        stats={stats}
        projects={projects}
        weeklyStats={weeklyStats}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verificar TypeScript:**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/tasks/page.tsx
git commit -m "feat(tasks): add /tasks Server Component page"
```

---

## Task 10: Refactorizar `/projects` — solo proyectos activos

**Files:**
- Modify: `app/(app)/projects/page.tsx`
- Modify: `components/projects/ProjectsModuleClient.tsx`

- [ ] **Step 1: Reemplazar `app/(app)/projects/page.tsx`:**

```typescript
import { FolderKanban, Plus } from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import ProjectsModuleClient from "@/components/projects/ProjectsModuleClient";

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  // Solo proyectos activos: IN_PROGRESS o PLANNING
  const projects = await db.project.findMany({
    where: {
      userId,
      status: { in: ["IN_PROGRESS", "PLANNING"] },
    },
    include: {
      tasks: {
        select: {
          id: true,
          title: true,
          done: true,
          order: true,
          notionId: true,
          projectId: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { order: "asc" },
      },
    },
    orderBy: { order: "asc" },
  }).catch(() => []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <FolderKanban className="w-5 h-5 text-module-projects" />
          <h2 className="text-xl font-bold text-on-surface">Proyectos</h2>
        </div>
        <p className="text-sm text-on-surface-variant">
          Vista estratégica de proyectos activos
        </p>
      </div>

      <ProjectsModuleClient initialProjects={projects} />
    </div>
  );
}
```

- [ ] **Step 2: Reemplazar `components/projects/ProjectsModuleClient.tsx`** — solo ProjectCard + ProjectDetail + FAB nuevo proyecto:

```typescript
"use client";

import { useState, useCallback } from "react";
import { Plus } from "lucide-react";
import type { ProjectWithTasks } from "@/lib/projects";
import ProjectCard from "./ProjectCard";
import ProjectDetail from "./ProjectDetail";

type Props = {
  initialProjects: ProjectWithTasks[];
};

export default function ProjectsModuleClient({ initialProjects }: Props) {
  const [projects, setProjects] = useState<ProjectWithTasks[]>(initialProjects);
  const [selectedProject, setSelectedProject] = useState<ProjectWithTasks | null>(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const refreshProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const d = await res.json() as { projects: ProjectWithTasks[] };
        // Filtrar solo activos en el cliente también
        const active = (d.projects ?? []).filter(
          (p: ProjectWithTasks) => p.status === "IN_PROGRESS" || p.status === "PLANNING"
        );
        setProjects(active);
      }
    } catch { /* silently fail */ }
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      if (res.ok) {
        setNewTitle("");
        setShowNewProject(false);
        await refreshProjects();
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      {projects.length === 0 && (
        <div className="py-12 text-center text-sm text-outline">
          No hay proyectos activos
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onClick={(p) => setSelectedProject(p)}
          />
        ))}
      </div>

      {/* FAB / inline new project */}
      {showNewProject ? (
        <form onSubmit={handleCreateProject} className="bg-[#1A1D27] rounded-xl border border-amber-500/30 p-3 space-y-2">
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Nombre del proyecto..."
            className="w-full bg-transparent text-sm text-on-surface placeholder:text-outline outline-none"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setShowNewProject(false); setNewTitle(""); }}
              className="px-3 py-1.5 rounded-lg bg-surface-container-high text-outline text-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!newTitle.trim() || creating}
              className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-medium disabled:opacity-50"
            >
              {creating ? "..." : "Crear"}
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowNewProject(true)}
          className="flex items-center gap-2 w-full py-2.5 px-3 rounded-xl border border-dashed border-outline/30 text-outline hover:border-amber-500/50 hover:text-amber-400 transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Nuevo proyecto
        </button>
      )}

      {/* ProjectDetail modal */}
      {selectedProject && (
        <ProjectDetail
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onUpdated={refreshProjects}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verificar TypeScript:**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/\(app\)/projects/page.tsx components/projects/ProjectsModuleClient.tsx
git commit -m "refactor(projects): strip to active projects overview, move kanban to /tasks"
```

---

## Task 11: Actualizar navegación

**Files:**
- Modify: `components/layout/BottomNav.tsx`
- Modify: `components/layout/Sidebar.tsx`

- [ ] **Step 1: Reemplazar el contenido completo de `components/layout/BottomNav.tsx`:**

```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const MOBILE_NAV = [
  { href: "/", icon: "dashboard", label: "Inicio" },
  { href: "/fitness", icon: "fitness_center", label: "Fitness" },
  { href: "/sleep", icon: "bedtime", label: "Sueño" },
  { href: "/projects", icon: "list_alt", label: "Proyectos" },
  { href: "/tasks", icon: "task_alt", label: "Tareas" },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-md z-50 flex justify-around items-center h-16 px-4 py-2 bg-surface-container/60 backdrop-blur-md border border-outline-variant/20 rounded-full shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0px)" }}
    >
      {MOBILE_NAV.map(({ href, icon, label }) => {
        const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center justify-center transition-all active:scale-90 duration-150",
              isActive
                ? href === "/tasks"
                  ? "text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                  : "text-primary drop-shadow-[0_0_8px_rgba(192,193,255,0.5)]"
                : "text-on-surface-variant opacity-60 hover:opacity-100"
            )}
          >
            <span
              className="material-symbols-outlined"
              style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {icon}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Actualizar `components/layout/Sidebar.tsx`** — agregar /tasks con CheckSquare después de /projects:

Agregar al import:
```typescript
import { CheckSquare } from "lucide-react";
```

Agregar al array `NAV_ITEMS` después de `/projects`:
```typescript
{ href: "/tasks", label: "Tareas", icon: CheckSquare, color: "text-amber-500" },
```

- [ ] **Step 3: Verificar TypeScript:**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add components/layout/BottomNav.tsx components/layout/Sidebar.tsx
git commit -m "feat(nav): add /tasks to BottomNav (replaces Settings) and Sidebar"
```

---

## Task 12: Verificación final

- [ ] **Step 1: TypeScript clean build:**

```bash
npx tsc --noEmit 2>&1
```

Expected: `0 errors`

- [ ] **Step 2: Build de producción (verifica todo):**

```bash
npm run build 2>&1 | tail -30
```

Expected: sin errores de compilación (pueden haber warnings de ESLint no críticos).

- [ ] **Step 3: Smoke test en dev:**

```bash
npm run dev
```

Verificar manualmente:
- [ ] `/tasks` carga sin errores
- [ ] `/projects` solo muestra proyectos IN_PROGRESS/PLANNING
- [ ] BottomNav muestra Tareas en lugar de Perfil
- [ ] Sidebar muestra /tasks entre Proyectos y las demás rutas
- [ ] Marcar una tarea como done → fade-out 400ms → desaparece
- [ ] Section C muestra tareas completadas con pills de período

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "chore: final cleanup and verification tasks/projects separation"
```

---

## SQL Reference (pegar en Supabase SQL Editor)

```sql
-- Nuevos campos en project_tasks
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMPTZ;
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMPTZ;
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS "priority" TEXT;
```

---

## Resumen de entregables

| Item | Estado esperado |
|---|---|
| `lib/tasks.ts` | Creado con TaskItem, 7 funciones |
| `app/api/tasks/route.ts` | GET + POST |
| `app/api/tasks/[id]/route.ts` | PATCH + DELETE |
| `app/(app)/tasks/page.tsx` | Server Component |
| `components/tasks/` (6 archivos) | NotionBadge, TaskItem, TaskQuickAdd, ThisWeekTasksList, CompletedTasksSection, TasksPageClient |
| `/projects` page | Solo proyectos activos, sin kanban |
| `ProjectsModuleClient.tsx` | Solo ProjectCard + ProjectDetail + FAB |
| `BottomNav.tsx` | Settings → Tareas (task_alt, amber) |
| `Sidebar.tsx` | +/tasks después de /projects |
| `prisma/schema.prisma` | +completedAt, +dueDate, +priority en ProjectTask |
| `npx tsc --noEmit` | 0 errores |

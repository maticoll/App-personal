# Spec: Separación Tasks / Projects

**Fecha:** 2026-05-25  
**Estado:** Aprobado por usuario  
**Rama:** master  

---

## Objetivo

Separar la página `/projects` en dos páginas con propósitos distintos:

- `/tasks` → Operacional. Trabajo diario, qué hay que hacer, kanban, timeline, historial de completadas.
- `/projects` → Estratégico. Lista limpia de proyectos activos. Sin gestión de tareas.

---

## Schema — Cambios en `ProjectTask`

El modelo actual solo tiene `done: Boolean`. Se agregan 3 campos:

```prisma
model ProjectTask {
  // campos existentes...
  completedAt  DateTime?   // cuándo se completó (null = pendiente)
  dueDate      DateTime?   // fecha límite opcional
  priority     String?     // "low" | "medium" | "high" | null
}
```

**SQL para Supabase (no usar `prisma db push`):**
```sql
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMPTZ;
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMPTZ;
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS "priority" TEXT;
```

---

## Página `/tasks` (NUEVA)

### Section A — "Tareas de esta semana"
- Tareas pendientes (`done = false`) cuya `dueDate` cae en la semana ISO actual (lun–dom), O que no tienen `dueDate` y fueron `createdAt` esta semana.
- Tareas completadas **hoy** también aparecen aquí (se ven brevemente antes de desaparecer).
- Tareas de Notion: misma sección, con badge amber pequeño (`N`).
- **Comportamiento al tickear:** optimistic update → fade-out CSS 400ms → remover del DOM. Sin page reload.

### Section B — Kanban + Timeline
- `KanbanBoard` y `TimelineView` movidos intactos desde `/projects`.
- `@hello-pangea/dnd` con `dynamic(ssr: false)` — no cambiar.
- `NotionSyncButton` y `WeeklyProjectStats` se mueven aquí (se quitan de `/projects`).
- `ProjectDetail` modal se mantiene.

### Section C — "Tareas terminadas"
- Filtros por período: `Esta semana` / `Semana pasada` / `Este mes` / `Todo`
- Default: esta semana.
- Cada fila: título de tarea, nombre del proyecto (si aplica), fecha de completado, badge Notion.
- Lógica 100% por fecha — sin cron.

---

## Página `/projects` (REFACTOR)

### "Proyectos activos"
- Solo `status = 'IN_PROGRESS' OR status = 'PLANNING'`.
- Card por proyecto: nombre, badge status, pendientes/total tasks, deadline si hay, color.
- Click → `ProjectDetail` modal.
- FAB "Nuevo proyecto".
- **Eliminado:** `KanbanBoard`, `TimelineView`, `NotionSyncButton`, `WeeklyProjectStats`, `ProjectsQuickActions`.

---

## Reglas de visibilidad de tareas

| Estado de tarea | Dónde aparece |
|---|---|
| Pendiente, dueDate esta semana o creada esta semana (sin dueDate) | Section A de /tasks |
| Pendiente, dueDate en semana futura | Solo Kanban/Timeline (Section B) |
| Completada **hoy** | Section A (fade-out) + Section C |
| Completada día anterior (esta semana) | Section C — filtro "Esta semana" |
| Completada semana anterior | Section C — "Semana pasada", "Este mes", "Todo" |

---

## `lib/tasks.ts` (NUEVO)

```typescript
// Tipos exportados
type TaskItem = {
  id: string
  title: string
  status: string        // "TODO" | "DONE"
  dueDate: Date | null
  completedAt: Date | null
  priority: string | null
  source: 'notion' | 'manual'
  projectId: string | null
  projectName: string | null
}

type CreateTaskInput = { title: string; dueDate?: Date; priority?: string; projectId?: string }

// Funciones exportadas
getThisWeekTasks(userId): Promise<TaskItem[]>
getCompletedTasks(userId, period): Promise<TaskItem[]>
createStandaloneTask(userId, data): Promise<TaskItem>
completeTask(taskId, userId): Promise<void>
uncompleteTask(taskId, userId): Promise<void>
deleteTask(taskId, userId): Promise<void>
getTasksStats(userId): Promise<{ pending: number; completedThisWeek: number; notionCount: number }>
```

---

## API Routes nuevas

### `GET /api/tasks`
- `?view=this_week` → tareas pendientes esta semana + completadas hoy
- `?view=completed&period=this_week|last_week|this_month|all` → historial

### `POST /api/tasks`
- Body: `{ title, dueDate?, priority?, projectId? }`

### `PATCH /api/tasks/[id]`
- Body: `{ status?, title?, dueDate?, priority?, completedAt? }`
- `status = 'DONE'` → auto-set `completedAt = new Date()`
- `status = 'TODO'` → auto-set `completedAt = null`

### `DELETE /api/tasks/[id]`
- Hard delete. Verificar ownership.

### Rutas existentes que NO se modifican
- `POST /api/projects/[id]/tasks`
- `POST /api/projects/sync-notion`

---

## Componentes nuevos (`components/tasks/`)

| Archivo | Propósito |
|---|---|
| `TasksPageClient.tsx` | Wrapper principal, todo el estado |
| `ThisWeekTasksList.tsx` | Section A: pendientes + completadas hoy, fade-out |
| `TaskItem.tsx` | Fila de tarea reutilizable |
| `TaskQuickAdd.tsx` | Formulario inline: título + dueDate opcional |
| `CompletedTasksSection.tsx` | Section C: historial con pills de período |
| `NotionBadge.tsx` | Chip amber pequeño para tareas de Notion |

---

## Navegación

### BottomNav (5 ítems)
Dashboard / Fitness / Sueño / Proyectos / **Tareas**  
- Se reemplaza `Perfil/Settings` (ícono `person`) por `Tareas` (ícono Material Symbols `task_alt`, color amber).

### Sidebar (desktop)
- Agregar `/tasks` con `CheckSquare` (lucide-react), `text-amber-500`, después de `/projects`.
- `/settings` permanece en el footer del sidebar.

---

## Design system

- Accent del módulo Tasks: `amber-500` / `amber-600`
- Fondo página: `bg-[#0D0F14]`
- Cards: `bg-[#1A1D27]`
- Tarea completada: `text-slate-500` + `line-through`
- Fade-out: `opacity-0 transition-opacity duration-400`
- Section headers: `text-xs text-slate-500 tracking-widest uppercase mb-3`
- Filter pills: estilo igual al módulo Ideas
- Notion badge: dot amber-600 o chip `N`

---

## TypeScript

- Zero `any` en código nuevo
- Tipos exportados desde `lib/tasks.ts`
- `Prisma.ProjectTaskGetPayload<{ include: { project: true } }>` para resultados tipados
- `auth()` en todas las rutas nuevas → 401 si no autenticado
- `npx tsc --noEmit` debe pasar con 0 errores

---

## Hard constraints

- No modificar `lib/projects.ts`, `lib/notion.ts`, ni agentes de WhatsApp
- No correr `prisma db push` — SQL manual en Supabase
- No romper `/projects` — refactorizarlo
- `KanbanBoard` mantiene `dynamic(ssr: false)`
- El `projectsAgent` de WhatsApp sigue funcionando sin cambios

---

## Archivos a crear

```
app/(app)/tasks/page.tsx
components/tasks/TasksPageClient.tsx
components/tasks/ThisWeekTasksList.tsx
components/tasks/TaskItem.tsx
components/tasks/TaskQuickAdd.tsx
components/tasks/CompletedTasksSection.tsx
components/tasks/NotionBadge.tsx
lib/tasks.ts
app/api/tasks/route.ts
app/api/tasks/[id]/route.ts
```

## Archivos a modificar

```
app/(app)/projects/page.tsx
components/projects/ProjectsModuleClient.tsx
components/layout/BottomNav.tsx
components/layout/Sidebar.tsx
prisma/schema.prisma
```

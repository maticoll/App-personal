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

**Funciones:**
- `getAllProjects(userId)` → ordenados por order ASC
- `getProjectsByStatus(userId, status)` → filtrado por status
- `getProject(userId, projectId)` → con verificación de ownership
- `createProject(userId, data)` → order auto-calculado como max+1
- `updateProject(userId, projectId, data)` → con verificación de ownership
- `deleteProject(userId, projectId)` → cascade configurado en Prisma
- `reorderProjects(userId, projectIds)` → transacción atómica con `db.$transaction`
- `createTask(projectId, userId, title)` → verifica ownership via findFirst
- `updateTask(userId, taskId, data)` → verifica ownership via join `project: { userId }`
- `deleteTask(userId, taskId)` → verifica ownership via join
- `getWeeklyStats(userId)` → últimos 7 días
- `getTodayProjectsSummary(userId)` → string compacto para dashboard

---

## lib/notion.ts

Integración **READ-ONLY** con Notion API v5 (`@notionhq/client` ^5.20.0).

**IMPORTANTE — API v5:** Usa `client.dataSources.query({ data_source_id })` (no `databases.query`). El SDK v5.20.0 renombró el endpoint.

**Tipos:**
- `NotionTask` — { notionId, title, status: ProjectStatus, deadline? }
- `NotionSyncResult` — { synced, created, updated, errors[] }

**Funciones:**
- `getNotionClient(token)` → instancia de @notionhq/client
- `fetchNotionTasks(token, databaseId)` → paginación automática con cursor
- `syncNotionToProjects(userId)` → upsert por notionId, catch individual por tarea

**Mapeo de status:**
- "In progress" / "Doing" → IN_PROGRESS
- "Done" / "Completed" → DONE
- Todo lo demás → TODO

**Credenciales:** Lee de `UserSettings.notionToken` y `UserSettings.notionDbId`. Fallback a `process.env.NOTION_TOKEN` y `process.env.NOTION_DB_ID`. Sin credenciales → retorna `errors["Notion no configurado"]` sin excepción.

**Proyectos de Notion:** `color: "amber-600"` para distinción visual.

---

## lib/scoring.ts (actualización Sesión 6)

### calcProjectsScore — Criterios Sesión 6

| Bloque | Puntos | Criterio |
|--------|--------|----------|
| Actividad | 40 | Al menos 1 tarea completada hoy |
| Actividad bonus | +20 | 2 o más tareas completadas hoy |
| Estado | 20 | Al menos 1 proyecto IN_PROGRESS |
| Deadlines | 20 | Sin deadlines vencidos |

**Null vs 0–40:**
- `null` = sin proyectos creados
- `0–40` = hay proyectos pero sin actividad hoy (se evalúa estado igualmente)

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
| POST | `/api/projects` | Crear proyecto (body: title, description?, deadline?, color?) |
| GET | `/api/projects/[id]` | Proyecto por ID (404 si no existe) |
| PATCH | `/api/projects/[id]` | Actualizar (title?, description?, status?, deadline?, color?, order?) |
| DELETE | `/api/projects/[id]` | Eliminar con cascade |
| POST | `/api/projects/reorder` | body: { projectIds: string[] } |
| POST | `/api/projects/[id]/tasks` | Crear tarea (body: title) |
| PATCH | `/api/projects/tasks/[taskId]` | Actualizar tarea (done?, title?, order?) |
| DELETE | `/api/projects/tasks/[taskId]` | Eliminar tarea |
| GET | `/api/projects/weekly-stats` | Stats semanales |
| POST | `/api/projects/sync-notion` | Sync desde Notion |

Sin cron jobs — el sync de Notion es manual (botón en la UI).

---

## Componentes React

Todos en `components/projects/`. Todos `"use client"`.

| Componente | Props principales | Descripción |
|------------|-------------------|-------------|
| `ProjectsModuleClient` | `initialProjects`, `initialStats` | Wrapper con tabs Kanban/Timeline + FAB + stats |
| `KanbanBoard` | `projects`, `onProjectsChange`, `onRefresh` | Drag-and-drop con @hello-pangea/dnd, 4 columnas |
| `ProjectCard` | `project`, `onClick`, `dragHandleProps?` | Card arrastrable con barra de progreso + badge Notion |
| `ProjectDetail` | `project`, `onClose`, `onUpdated`, `onDeleted` | Modal con edición inline, CRUD tareas, delete con doble confirmación |
| `TimelineView` | `projects`, `onRefresh` | Cronología con barra de tiempo + barra de tareas |
| `NotionSyncButton` | `onSynced?` | Botón con estado de carga y resultado del sync |
| `ProjectsQuickActions` | `onCreated` | FAB "+" flotante con form inline |
| `WeeklyProjectStats` | `stats` | 3 stat cards: activos, tareas, avanzados |

### Nota importante: @hello-pangea/dnd SSR
Si el build falla con errores de SSR, `KanbanBoard` se importa con `dynamic(() => import("./KanbanBoard"), { ssr: false })` en `ProjectsModuleClient`.

---

## Página /app/(app)/projects/page.tsx

Server Component. Carga en paralelo:
1. `getAllProjects(userId)` — con catch → []
2. `getWeeklyStats(userId)` — con catch → zeros

Pasa todo a `ProjectsModuleClient`.

---

## Agente /agents/projects/index.ts

**Intenciones detectadas** (normalización NFD sin acentos):
- `create` — "nuevo/crear/agregar proyecto: [título]"
- `update_status` — "moví/cambié/pasé a/completé el proyecto"
- `task_done` — "hice/terminé la tarea/completé la tarea/check"
- `query` — "mis proyectos/qué tengo/cómo voy/cuántos proyectos"
- `sync_notion` — "sync notion/actualiza notion/traer tareas"
- `unknown` — fallback con ayuda

**Funciones exportadas:**
- `processProjectsMessage(userId, text)` → string de respuesta
- `getProjectsSummaryText(userId, date?)` → string compacto para Morning Summary (Sesión 8)
- `projectsAgent` — objeto con `.process(input)`, `.syncNotion(userId)`, `.calculateScore(userId, date)`

---

## Variables de entorno

```env
# Notion Integration (Sesión 6)
NOTION_TOKEN=   # Integration token (empieza con secret_) — fallback global
NOTION_DB_ID=   # ID de la DB de Notion — fallback global
# Valores por usuario: UserSettings.notionToken y UserSettings.notionDbId
```

---

## Dependencias instaladas

```json
"@hello-pangea/dnd": "^18.0.1",
"@notionhq/client": "^5.20.0"
```

---

## Comandos

```bash
# Schema (si no se pudo hacer antes por red)
npm run db:push

# Dev
npm run dev

# Build
npm run build
```

---

## Recordatorio para el usuario

Después de hacer deploy en Vercel, correr `npx prisma db push` desde la máquina del usuario (o el comando se ejecuta automáticamente en Vercel si está configurado).

---

*Sesión 6 completada — Mayo 2026*

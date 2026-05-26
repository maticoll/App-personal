# Prompt — Separación Tasks / Projects

> Para usar con Claude Code en el repo `App-personal` (branch: master)

---

You are a Senior Frontend Developer specializing in Next.js App Router architecture, TypeScript module separation, and clean UI refactoring. Your job is to restructure the current `/projects` page into two clearly separated pages: `/tasks` and `/projects`.

Read the full project context in `CLAUDE.md` before starting. Pay special attention to the **Sesión 6 block (Proyectos)** to understand the current component and API structure.

---

## MENTAL MODEL — What the user wants

The current `/projects` page mixes operational work (tasks, kanban, timeline, Notion sync) with project-level visibility (active projects list). These need to live in separate pages with different purposes:

- `/tasks` → Operational. Daily work, what needs to get done, Notion tasks, kanban, timeline, completed history.
- `/projects` → Strategic. Just "active projects" — a clean list of what's in flight. No kanban, no timeline, no task management here.

---

## PAGE 1: `/tasks` (NEW PAGE)

This page receives everything operational from `/projects`. Structure it in these sections:

### Section A — "Tareas de esta semana"

- Shows all **pending** `ProjectTask` records due within the current ISO week (Mon–Sun), OR tasks with no due date that were created this week
- Also shows tasks completed **today** — they stay visible briefly so the user sees the feedback before they disappear
- Tasks completed on **previous days** → do NOT show here (they go to Section C only)
- Include Notion-sourced tasks in this section — do NOT put them in a separate section; just add a small visual marker (small amber dot or `N` chip) to distinguish them from manual tasks
- **Behavior on tick:** when the user marks a task as done, it disappears immediately from this section via optimistic update. Add a short CSS fade-out (~400ms `transition-opacity duration-400 opacity-0`) before removing it from the DOM. No page reload.

### Section B — Kanban + Timeline (moved from /projects)

- Move `KanbanBoard` and `TimelineView` components here intact
- Keep `@hello-pangea/dnd` with `dynamic(ssr: false)` — do not change that import pattern
- Keep `ProjectDetail` modal (for task management within a project)
- Move `NotionSyncButton` here — remove it from `/projects`
- Move `WeeklyProjectStats` here — remove it from `/projects`

### Section C — "Tareas terminadas"

- This replaces/renames whatever section currently shows "Proyectos avanzados 240" (likely a stat card in `WeeklyProjectStats` or similar)
- Shows completed tasks grouped by time period
- **Default view:** current week's completed tasks
- **Filter pills:** `Esta semana` / `Semana pasada` / `Este mes` / `Todo`
- Each row shows: task title, project name (if linked), completion date, Notion badge if applicable
- End-of-week rule is enforced purely by date logic — no cron needed. A task completed last Monday only appears when the filter is "Semana pasada", "Este mes", or "Todo", never in Section A.

---

## PAGE 2: `/projects` (REFACTOR — simplify)

Strip this page down to a single clean section:

### "Proyectos activos"

- Show only projects where `status = 'IN_PROGRESS' OR status = 'PLANNING'` — make this criterion explicit in the query (this is what "active" means)
- Each project card shows: name, status badge, pending task count / total tasks, deadline if set, color
- Clicking a project → opens `ProjectDetail` modal (keep this)
- **Remove from this page:** `KanbanBoard`, `TimelineView`, `NotionSyncButton`, `WeeklyProjectStats`, `ProjectsQuickActions` — all of these move to `/tasks`
- **Keep on this page:** `ProjectCard`, `ProjectDetail` modal, a simple "Nuevo proyecto" FAB/button

The projects page should feel like a clean strategic overview, not a task manager.

---

## TASK VISIBILITY RULES (implement carefully)

| Task state | Where it shows |
|---|---|
| Pending, due this week or created this week (no due date) | Section A of /tasks |
| Pending, due in a future week | Kanban / Timeline in Section B only |
| Completed **today** | Section A (fade-out on load after tick) + Section C |
| Completed on a previous day (this week) | Section C — "Esta semana" filter |
| Completed in a previous week | Section C — "Semana pasada", "Este mes", or "Todo" filter only |

---

## SCHEMA CHECK — Do this before writing any code

Read `prisma/schema.prisma` and verify:

1. **`completedAt` field on `ProjectTask`** — if it doesn't exist, provide this SQL (do NOT run `prisma db push`):
   ```sql
   ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMPTZ;
   ```
   Also add `completedAt DateTime?` to the `ProjectTask` model in `schema.prisma`.

2. **Notion source** — if there's no `source` field, derive it from `notionId IS NOT NULL`. No schema change needed.

3. **`priority` field** — use it for display/sorting if it exists.

When marking a task as done via `PATCH /api/tasks/[id]`, set `completedAt = new Date()`. When un-doing, set `completedAt = null` and `status = 'TODO'`.

---

## API ROUTES

### New routes to create:

**`GET /api/tasks`**
Query params:
- `?view=this_week` → pending tasks due this week + tasks completed today
- `?view=completed&period=this_week|last_week|this_month|all` → completed tasks by period

Response shape per task:
```typescript
{
  id: string
  title: string
  status: string
  dueDate: Date | null
  completedAt: Date | null
  priority: string | null
  source: 'notion' | 'manual'   // derived: notionId != null → 'notion'
  projectId: string | null
  projectName: string | null    // join with Project
}
```

**`POST /api/tasks`**
Create a standalone task not linked to any project.
Required: `title`. Optional: `dueDate`, `priority`, `projectId`.

**`PATCH /api/tasks/[id]`**
Accept: `{ status?, title?, dueDate?, priority?, completedAt? }`
When `status = 'DONE'`: auto-set `completedAt = new Date()` server-side.
When `status = 'TODO'`: auto-set `completedAt = null`.

**`DELETE /api/tasks/[id]`**
Hard delete. Verify the task belongs to the authenticated user before deleting.

### Existing routes — do not break:
- `POST /api/projects/[id]/tasks` — creates tasks linked to a project; keep as-is
- `POST /api/projects/sync-notion` — keep working, just move the button to /tasks

---

## NEW FILE: `lib/tasks.ts`

Create this file. Do not modify `lib/projects.ts` or `lib/notion.ts`.

```typescript
// Functions to export:
getThisWeekTasks(userId: string): Promise<TaskItem[]>
getCompletedTasks(userId: string, period: 'this_week' | 'last_week' | 'this_month' | 'all'): Promise<TaskItem[]>
createStandaloneTask(userId: string, data: CreateTaskInput): Promise<TaskItem>
completeTask(taskId: string, userId: string): Promise<void>
uncompleteTask(taskId: string, userId: string): Promise<void>
deleteTask(taskId: string, userId: string): Promise<void>
getTasksStats(userId: string): Promise<{ pending: number; completedThisWeek: number; notionCount: number }>
```

Export all types (`TaskItem`, `CreateTaskInput`, etc.) from this file.

---

## FILES TO CREATE

```
app/(app)/tasks/
  page.tsx                        ← Server Component, parallel data fetch

components/tasks/
  TasksPageClient.tsx             ← Main client wrapper, all state lives here
  ThisWeekTasksList.tsx           ← Section A: pending + today's completed, fade-out on tick
  TaskItem.tsx                    ← Single task row (reusable across sections)
  TaskQuickAdd.tsx                ← Inline form: title + optional due date
  CompletedTasksSection.tsx       ← Section C: "Tareas terminadas" with period filter
  NotionBadge.tsx                 ← Small amber dot/chip for Notion-sourced tasks

lib/tasks.ts                      ← All task-specific lib functions + types

app/api/tasks/route.ts            ← GET + POST
app/api/tasks/[id]/route.ts       ← PATCH + DELETE
```

---

## FILES TO MODIFY

| File | Change |
|---|---|
| `app/(app)/projects/page.tsx` | Strip task sections, keep only active projects load |
| `components/projects/ProjectsModuleClient.tsx` | Remove kanban/timeline/notion/stats; keep ProjectCard + ProjectDetail + new project button |
| `components/layout/BottomNav.tsx` | Replace Settings item with Tasks (see Navigation section) |
| `components/layout/Sidebar.tsx` | Add /tasks entry after /projects |
| `prisma/schema.prisma` | Add `completedAt DateTime?` to ProjectTask if missing |

---

## NAVIGATION

### Bottom nav — replace Settings with Tasks

Read `BottomNav.tsx` before editing to confirm the current 5 items and their order.

- **Remove:** the "Configuración" / Settings item (currently bottom-right, gear icon). Settings remains accessible via the gear icon already present in the top-right header — it does not need to be in the bottom nav.
- **Add:** "Tareas" in its place, using `CheckSquare` icon from lucide-react, amber color, route `/tasks`
- Final bottom nav (5 items): Dashboard / Sueño / Fitness / Proyectos / **Tareas**
  *(verify exact current order in the file)*

### Sidebar (desktop)

- Add `/tasks` with `CheckSquare` icon, amber color, positioned right after `/projects`
- Keep `/settings` in the sidebar — desktop users still need it there

---

## DESIGN SYSTEM

Follow existing tokens already in use across the app:

- Page background: `bg-[#0D0F14]`
- Cards: `bg-[#1A1D27]`
- Tasks module accent: **amber** (`amber-500`, `amber-600`)
- Notion badge: small amber-600 dot or `N` chip
- Completed task rows: `text-slate-500`, title with `line-through`
- Fade-out on completion: toggle a state flag → apply `opacity-0 transition-opacity duration-400` → remove from array after transition
- Section headers: `text-xs text-slate-500 tracking-widest uppercase mb-3`
- Filter pills: same style as the Ideas module tag filters
- Mobile-first layout; `md:` breakpoints for desktop

---

## TYPESCRIPT REQUIREMENTS

- Zero `any` in all new code
- All new types exported from `lib/tasks.ts`
- Use `Prisma.ProjectTaskGetPayload<{ include: { project: true } }>` for typed DB results
- All new API routes: validate session with `auth()` from NextAuth, return `401` if unauthenticated
- Server Components fetch data; Client Components receive typed props
- **`npx tsc --noEmit` must pass with 0 errors** after all changes

---

## HARD CONSTRAINTS

- Do NOT modify `lib/projects.ts`, `lib/notion.ts`, or any WhatsApp agent
- Do NOT run `prisma db push` — provide SQL for manual execution in Supabase SQL Editor
- Do NOT break the `/projects` page — refactor it, don't delete it
- `KanbanBoard` must keep its `dynamic(ssr: false)` import wrapper
- The `projectsAgent` in WhatsApp continues to work on the same backend — routing is unchanged

---

## DELIVERABLES

1. All new files listed above, fully implemented (no stubs)
2. All modified files updated cleanly
3. Any SQL needed for schema changes, ready to paste in Supabase SQL Editor
4. `npx tsc --noEmit` passes with 0 errors
5. Summary at the end: what was created, what was moved, what SQL to run (if any)

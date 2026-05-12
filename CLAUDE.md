# App Personal — CLAUDE.md
> Contexto general del proyecto para todas las sesiones de trabajo

---

## Qué es este proyecto

Una super-app web personal que centraliza el día a día completo: sueño, fitness, nutrición, proyectos, ideas y finanzas en un solo dashboard. Tiene una capa de IA conversacional con WhatsApp como canal de entrada principal y un sistema de scoring diario /100 para hacer el seguimiento visual y dinámico.

**Leer el blueprint completo:** `BLUEPRINT.md` (misma carpeta)

---

## Stack tecnológico

- **Framework:** Next.js (App Router) + TypeScript
- **Estilos:** Tailwind CSS — dark mode + light mode, mobile-first
- **Base de datos:** Supabase (PostgreSQL + Prisma ORM)
- **Auth:** NextAuth v5
- **Deploy:** Vercel
- **PWA:** next-pwa (se agrega al home del iPhone 14)
- **IA:** Claude API (Anthropic) — orquestación, NLP, macros, ideas
- **Audio:** Whisper API (OpenAI) — transcripción de audios de WhatsApp
- **Gráficos:** Recharts
- **Versículo diario:** bible-api.com (gratis, Reina Valera 1960)

**Referencia de stack existente:** La app de finanzas del usuario usa Next.js + Neon + Prisma + NextAuth v5 + Vercel. Reutilizar patrones de ahí donde sea posible.

---

## Módulos de la app

| Módulo | Ruta | Estado |
|--------|------|--------|
| Dashboard + Scoring | `/` | ✅ Construido |
| Sueño | `/sleep` | ✅ Construido |
| Fitness | `/fitness` | Por construir |
| Nutrición | `/nutrition` | Por construir |
| Proyectos | `/projects` | Por construir |
| Ideas | `/ideas` | Por construir |
| Finanzas | `/finances` | Integrar app existente |
| Configuración | `/settings` | Por construir |

---

## Arquitectura de agentes (WhatsApp)

El sistema de WhatsApp funciona con un **orquestrador central** que es el único que se comunica con WhatsApp. Los sub-agentes procesan la lógica de cada módulo y le devuelven el resultado al orquestrador para que lo envíe.

**Sub-agentes:**
1. Agente de Sueño
2. Agente de Fitness
3. Agente de Nutrición
4. Agente de Proyectos
5. Agente de Ideas
6. Agente de Finanzas
7. Agente de Calendario (Google Calendar)
8. Agente de Scoring

Ver flujos detallados en `BLUEPRINT.md` → Sección 4.

---

## Integraciones externas

- WhatsApp Business API
- Garmin Connect API (sueño, natación, actividad)
- Google Calendar API
- Gmail
- Notion API (tareas IT del trabajo)
- App de Finanzas propia (Next.js/Neon — integrar dentro del dashboard)
- Lumina (app propia de ideas en Vercel)
- bible-api.com

**Nota importante — Apple Health:** No es accesible desde web apps. Usar Garmin Connect API como fuente principal de datos de salud. Alternativa: iPhone Shortcut que exporta datos vía webhook.

---

## Scoring

Cada módulo tiene su score /100. El score global es el promedio de todos.

**UI del score:**
- Barra de progreso global arriba
- Cada categoría abajo con su barra + desplegable mostrando qué no se cumplió
- Vistas: diario / semanal / mensual

---

## Plan de sesiones

Cada sesión genera un `skill.md` propio y agrega su bloque a este `CLAUDE.md`.

| # | Sesión | Skill.md | Estado |
|---|--------|----------|--------|
| 0 | Ideación + Blueprint | — | ✅ Completo |
| 1 | Base App | `skills/base-app.md` | ✅ Completo |
| 2 | Dashboard + Scoring | `skills/dashboard-scoring.md` | ✅ Completo |
| 3 | Sueño | `skills/sleep.md` | ✅ Completo |
| 4 | Fitness | `skills/fitness.md` | ✅ Completo |
| 5 | Nutrición + Ideas | `skills/nutrition-ideas.md` | ✅ Completo |
| 6 | Proyectos | `skills/projects.md` | Pendiente |
| 7 | Integraciones | `skills/integrations.md` | Pendiente |
| 8 | WhatsApp Orquestrador | `skills/whatsapp-orchestrator.md` | Pendiente |

---

## Convenciones importantes

- Todo el código en **TypeScript** — sin JS plano
- Componentes en `/components`, lógica de negocio en `/lib`, agentes en `/agents`
- Variables de entorno en `.env.local` — nunca hardcodear keys
- Cada módulo tiene su propio schema en Prisma
- Los agentes de IA reciben y devuelven siempre objetos tipados
- Los mensajes proactivos de WhatsApp siempre pasan por el orquestrador — los sub-agentes nunca hablan directamente con WhatsApp

---

## Skills disponibles

| Skill | Archivo | Cubre |
|-------|---------|-------|
| Base App | `skills/base-app.md` | Stack, schema Prisma, auth, design system, estructura de carpetas, layout, PWA |
| Dashboard + Scoring | `skills/dashboard-scoring.md` | Lógica de scoring, API routes, componentes (anillo, cards expandibles, gráfico Recharts), dashboard, historial |
| Sueño | `skills/sleep.md` | Registro manual, Garmin API (SSO + wellness endpoint), scoring real, cron jobs, agente NLP completo |
| Fitness | `skills/fitness.md` | Gym NLP, actividades cardio, rutinas CRUD, smart habits, Garmin activities, scoring, agente completo |
| Nutrición + Ideas | `skills/nutrition-ideas.md` | Macros NLP, agua, dieta, alignment score, captura ideas con IA, stats, agentes completos |

---

## Bloque Sesión 1 — Base App

**Stack instalado:** Next.js 15 + React 19 + TypeScript + Tailwind CSS 3 + Prisma 5 + NextAuth v5 + next-pwa + next-themes + date-fns + recharts + lucide-react

**Estructura de carpetas creada:** `/app`, `/agents`, `/components`, `/lib`, `/prisma`, `/public`, `/skills`

**Schema Prisma:** Todos los modelos definidos para User, Auth (NextAuth), SleepLog, Workout/Exercise/Set, GymRoutine, Meal, WaterLog, UserDiet, Project, ProjectTask, Idea, DailyScore, UserSettings, UserHabit, WhatsAppMessage

**Auth:** NextAuth v5 con Google OAuth, sesiones en DB (Supabase), restricción por `ALLOWED_EMAIL`, `middleware.ts` protege todas las rutas

**Design system Tailwind:**
- Dark mode (default): bg `#0D0F14`, surface `#1A1D27`
- Light mode: bg `#F8FAFC`, surface `#FFFFFF`
- Accent: `#6366F1` (indigo)
- Score gradient: verde (#22C55E) → rojo (#EF4444)
- Colores por módulo: sueño violeta, fitness cyan, nutrición esmeralda, proyectos ámbar, ideas rosa, finanzas azul

**Layout:** Sidebar fijo desktop (md+) + Header + BottomNav (5 ítems) para mobile. iOS safe areas con `env(safe-area-inset-*)`.

**PWA:** next-pwa configurado con service worker, manifest.json con shortcuts, `display: standalone`, `viewportFit: cover` para iPhone 14

**Páginas creadas (sin lógica):** `/`, `/sleep`, `/fitness`, `/nutrition`, `/projects`, `/ideas`, `/finances`, `/scoring`, `/settings`, `/login`

**Agentes (stubs):** orchestrator, sleep, fitness, nutrition, projects, ideas, finances, calendar, scoring — todos con interface tipada y TODOs por sesión

**Primer paso para correr:** `npm install` → `cp .env.local.example .env.local` → `npm run db:push` → `npm run dev`

---

---

## Bloque Sesión 2 — Dashboard + Scoring

**Lógica de scoring implementada:** `lib/scoring.ts` — criterios por módulo (sleep, fitness, nutrition, projects, ideas), función `calculateFullScore`, `saveScore`, `getStoredScore`, `getScoreHistory`, `generateMockHistory`. Scores retornan `null` (sin datos) vs `0` (datos pero sin cumplir). Global = promedio de non-nulls.

**API Routes:** `GET /api/scoring/today` (calcula + guarda si no existe), `GET /api/scoring/history` (con period + fallback mock), `POST /api/scoring/calculate` (recálculo forzado).

**Componentes de scoring:** `GlobalScoreRing` (SVG animado), `ScoreCardModule` (card expandible met/missed), `ScoreTrendChart` (Recharts LineChart), `PeriodSelector`, `ModuleToggle`, `DailyScoreCard`, `ScoringDashboard`, `ScoringHistoryClient`.

**Dashboard `/`:** Server Component que carga score + resúmenes de módulos en paralelo (`Promise.all`). Muestra: saludo dinámico, anillo de score global, 5 cards de módulo expandibles con detalle, 6 cards de acceso rápido con resúmenes reales de la DB.

**Página `/scoring`:** Server Component + Client Component para interactividad. Vistas: diario (14d), semanal (56d agregado), mensual (180d agregado). Muestra: stats (avg/max/min), gráfico de tendencia con toggle de módulos, lista de días con mini barras.

**Agente de scoring:** Completado con `calculateDailyScore`, `getTodayScore`, `getHistorical`, `recalculateWeek`, `getSummaryText` (para Morning Summary, Sesión 8).

**Sin cambios al schema de Prisma** — todo funciona con el `DailyScore` model existente.

---

---

## Bloque Sesión 3 — Módulo de Sueño

**Schema Prisma:** SleepLog: +`spo2Avg` (Float), +`respirationAvg` (Float), +`bodyBatteryChange` (Int). UserSettings: +`garminSessionKey` (String), +`garminSessionExp` (DateTime).

**lib/sleep.ts:** `getTodaySleep`, `getPendingSleepLog`, `getSleepHistory`, `getWeeklyStats`, `logBedTime`, `logWakeTime`, `upsertSleepLog`, `deleteSleepLog`, `getTodaySleepSummary`. Convención de fecha: date = día de despertar.

**lib/garmin.ts:** Cliente completo de Garmin Connect. Autenticación SSO en 3 pasos (embed → signin → ticket). Cache de sesión en memoria + DB (TTL 23h). `fetchGarminSleepData`, `syncGarminSleepRange`, `upsertSleepFromGarmin`, `checkGarminStatus`. Manejo de token refresh automático en 401.

**API Routes:** `POST /api/sleep/log` (bed/wake/manual), `GET /api/sleep/today`, `GET /api/sleep/history`, `POST /api/sleep/sync-garmin`, `PATCH|DELETE /api/sleep/[id]`, `GET /api/garmin/status`.

**Cron Jobs (vercel.json):** `GET /api/cron/sleep-sync` → 8 AM diario (Garmin sync últimos 2 días). `GET /api/cron/sleep-notifications` → cada 30min de 8–11 PM (recordatorios de bedtime + alerta de despertar no registrado). Protegidos con `CRON_SECRET`.

**Componentes:** `SleepQuickActions`, `SleepTodayCard` (duración + fases + SpO2 + Body Battery), `SleepWeekStats`, `SleepDurationChart` (BarChart 7d), `SleepQualityChart` (ComposedChart 14d), `SleepTimingChart` (barras flotantes 7d), `SleepHistoryList` (expandible + delete), `GarminSyncButton`, `SleepModuleClient` (wrapper con estado).

**Página `/sleep`:** Server Component — carga paralela (5 queries + Garmin status). Pasa datos iniciales al client wrapper.

**Agente de sueño:** Detecta 5 tipos de intención: bed, wake, query, sync, unknown. Parsing de hora en texto ("a las 11", "a las 7 y media"). `getSleepSummaryText()` y `getBedTimeReminderText()` listos para Morning Summary (Sesión 8).

**Scoring de sueño actualizado:** 3 bloques — Registro (30 pts), Duración (40 pts, 7–9h ideal), Calidad (30 pts: hora de acostarse si no hay Garmin, score Garmin proporcional si hay). Función `calcSleepScoreForDate()` exportada para el agente.

**Variables de entorno nuevas:** `GARMIN_EMAIL`, `GARMIN_PASSWORD`, `CRON_SECRET`.

**Próximo paso para correr:** `npm run db:push` → `npm run db:generate` → completar GARMIN_EMAIL y GARMIN_PASSWORD en `.env.local`.

---

## Bloque Sesión 4 — Módulo de Fitness

**Schema Prisma:** Workout: +`title` (String?), +`source` (String, default "MANUAL"), +`steps` (Int?). Sin modelos nuevos — Workout, Exercise, WorkoutSet, GymRoutine, GymRoutineExercise ya existían desde Sesión 1.

**lib/fitness.ts:** Módulo completo. Tipos: `WorkoutWithExercises`, `GymRoutineWithExercises`, `WeeklyStatEntry`, `SmartHabitStatus`, `ParsedExercise`. Funciones: `getTodayWorkouts`, `getWorkoutHistory`, `getWeeklyStats`, `getTodayGymRoutine`, `getTodayFitnessSummary`, `checkSmartHabitDeviation` (smart habits con gymDays + expectedGymTime + 1h gracia), `logActivity`, `startGymWorkout`, `addExerciseSets`, `parseAndLogExerciseNLP` (fetch directo a Anthropic REST), `createRoutine`, `updateRoutine`, `deleteRoutine`, `updateWorkout`, `deleteWorkout`, `upsertWorkoutFromGarmin`.

**lib/garmin.ts (extensión):** `GarminActivityData` type, `GARMIN_ACTIVITY_TYPE_MAP` (normaliza typeKey → WorkoutType), `fetchGarminActivities` (endpoint activitylist-service, mapea actividades del día).

**lib/scoring.ts (actualización):** `calcFitnessScore` con 4 bloques (Base 40 + Gym 20 + Duración 20 + Cardio 20). Null vs 0: null si no es día de gym configurado, 0 si es día de gym pero sin workout. Exporta `calcFitnessScoreForDate()`.

**API Routes (10 rutas + 2 cron):** `today` (GET), `workout` (GET/POST), `workout/[id]` (GET/PATCH/DELETE), `workout/[id]/exercise` (POST), `weekly-stats` (GET), `routines` (GET/POST), `routines/[id]` (PATCH/DELETE), `log-exercise` (POST NLP), `sync-garmin` (POST manual). Crons: `fitness-sync` (6 AM, sync Garmin todos los usuarios), `fitness-habits` (7:10 AM, check smart habits).

**Componentes (9):** `FitnessModuleClient` (wrapper principal, tabs Hoy/Stats/Rutinas), `TodayWorkoutCard`, `GymRoutineCard` (rutina del día + "Empezar gym"), `FitnessQuickActions` (5 botones + form cardio + NLP input), `WeeklyVolumeChart` (BarChart, Cell color-coded), `WorkoutHistoryList` (agrupado por día, expandible), `RoutineManager` (CRUD completo con form inline), `SmartHabitAlert`, `GarminSyncButton`.

**Página `/fitness`:** Server Component — carga paralela de 6 datos (workouts hoy, historial 14d, weekly stats, rutina del día, smart habit, Garmin status). Pasa todo como props iniciales a `FitnessModuleClient`.

**Agente de fitness:** Detecta 6 intenciones: gym_start, gym_log, cardio_log, query, sync_garmin, unknown. Parser de cardio extrae duración y distancia via regex. Exporta `getSummaryText()` y `getSummaryText()` para Morning Summary (Sesión 8). Smart habits con TODO Calendar (Sesión 7).

**vercel.json:** +2 crons: `fitness-sync` (`0 6 * * *`) y `fitness-habits` (`10 7 * * *`).

**Variables de entorno:** `ANTHROPIC_API_KEY` (ya estaba en `.env.local.example`). Sin variables nuevas.

**Próximo paso para correr:** `npm run db:push` → `npm run db:generate` → verificar `ANTHROPIC_API_KEY` en `.env.local`.

---

## Bloque Sesión 5 — Nutrición + Ideas

**Sin cambios al schema de Prisma** — Meal, WaterLog, UserDiet e Idea ya existían desde Sesión 1.

**lib/nutrition.ts:** `getTodayNutritionSummary`, `getMealHistory`, `getUserDiet`, `updateUserDiet`, `logMealNLP` (Claude Haiku calcula macros + dietAlignmentScore), `logWater`, `deleteMeal`, `getWeeklyNutritionStats`, `getNutritionSummaryText`, `getWaterReminderText`. Normalización NFD para regex sin acentos en agentes.

**lib/ideas.ts:** `getAllIdeas` (con filtros tag/search), `getRecentIdeas`, `getIdea`, `captureIdeaNLP` (Claude Haiku estructura: title + content expandido + tags), `updateIdea`, `deleteIdea`, `getIdeasStats`, `getIdeasActivityForDate` (informativo, no entra al score).

**lib/scoring.ts (extensión):** +`calcNutritionScoreForDate` exportada, +`getIdeasActivityForDate` exportada. Ideas NO forma parte del score global.

**API Routes — Nutrición (8 rutas):** `today`, `meal` (POST), `meal/[id]` (DELETE), `water` (POST), `diet` (GET/POST), `history`, `weekly-stats`. **Ideas (6 rutas):** `GET/POST /api/ideas`, `GET/PATCH/DELETE /api/ideas/[id]`, `GET /api/ideas/stats`.

**Cron nuevo:** `water-reminder` (`0 12,17 * * *`) — recordatorio de hidratación a las 12 PM y 5 PM.

**Componentes Nutrición (9):** `NutritionModuleClient` (tabs Hoy/Stats/Dieta), `MealLogCard`, `MacrosChart` (PieChart Recharts), `WaterTracker` (iconos + barra), `NutritionQuickActions` (selector tipo + textarea NLP + +1 Termo), `MealHistoryList`, `NutritionWeekStats`, `DietCard`, `AlignmentBadge`.

**Componentes Ideas (7):** `IdeasModuleClient` (tabs Capturar/Explorar), `IdeaCaptureForm` (textarea → preview IA → confirmar), `IdeaCard`, `IdeasGrid`, `TagFilter`, `IdeaDetail` (modal), `IdeasStats`.

**Páginas:** `/nutrition` y `/ideas` — Server Components con carga paralela, catch en cada query.

**Agentes:** `processNutritionMessage` (4 intenciones: meal_log, water_log, query, diet_update) + `processIdeasMessage` (3 intenciones: capture, query, expand). Normalización NFD para regex sin acentos.

**Variables de entorno nuevas:** Ninguna. Usa `ANTHROPIC_API_KEY` (ya estaba).

**Próximo paso para correr:** `npm run dev` (sin migraciones necesarias — schema ya estaba).

---

## Bloque Sesión 6 — Módulo de Proyectos

**Schema Prisma:** +`notionToken` (String?) y +`notionDbId` (String?) en UserSettings. Aplicado directamente vía SQL en Supabase (problema de conectividad con `prisma db push` — workaround documentado). Project y ProjectTask ya existían desde Sesión 1.

**lib/projects.ts:** `getAllProjects`, `getProjectsByStatus`, `getProject`, `createProject`, `updateProject`, `deleteProject`, `reorderProjects` (transacción atómica), `createTask`, `updateTask`, `deleteTask`, `getWeeklyStats`, `getTodayProjectsSummary`.

**lib/notion.ts:** Integración READ-ONLY con `@notionhq/client` v5.20.0. `getNotionClient`, `fetchNotionTasks` (paginación con cursor), `syncNotionToProjects` (upsert por notionId). Credenciales por usuario en UserSettings, fallback a env vars. Proyectos de Notion se marcan con color amber-600. Sin cron — sync manual.

**lib/scoring.ts (extensión):** +`calcProjectsScoreForDate` exportada. Criterios: actividad (40+20 pts por tareas completadas hoy), estado IN_PROGRESS (20 pts), deadlines sanos (20 pts). Null si no hay proyectos.

**API Routes (11 rutas):** `GET/POST /api/projects`, `GET/PATCH/DELETE /api/projects/[id]`, `POST /api/projects/reorder`, `POST /api/projects/[id]/tasks`, `PATCH/DELETE /api/projects/tasks/[taskId]`, `GET /api/projects/weekly-stats`, `POST /api/projects/sync-notion`.

**Componentes (8):** `ProjectsModuleClient` (tabs Kanban/Timeline + FAB), `KanbanBoard` (drag-and-drop con @hello-pangea/dnd, importado con `dynamic ssr:false`), `ProjectCard`, `ProjectDetail` (modal edición inline + CRUD tareas), `TimelineView`, `NotionSyncButton`, `ProjectsQuickActions`, `WeeklyProjectStats`.

**Página `/projects`:** Server Component con carga paralela. KanbanBoard con SSR desactivado para evitar errores de hidratación con @hello-pangea/dnd.

**Agente de proyectos:** 6 intenciones: create, update_status, task_done, query, sync_notion, unknown. Exporta `processProjectsMessage`, `getProjectsSummaryText` (para Morning Summary Sesión 8), `projectsAgent`.

**Dependencias nuevas:** `@hello-pangea/dnd ^18.0.1`, `@notionhq/client ^5.20.0`.

**Variables de entorno nuevas:** `NOTION_TOKEN`, `NOTION_DB_ID` (fallback global — valores reales van en UserSettings por usuario).

**Nota Prisma:** Si `prisma db push` falla por conectividad, usar SQL directo en Supabase SQL Editor: `ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS "notionToken" TEXT; ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS "notionDbId" TEXT;`

---

## Estado de Deploy — Mayo 2026

**Plataforma:** Vercel (plan Hobby)
**Estado:** ✅ App levantada y funcionando
- Auth con Google OAuth: ✅ activo
- Base de datos Supabase + tablas: ✅ creadas y activas
- Crons Vercel: sleep-sync (8AM), sleep-notifications (10PM), fitness-sync (6AM), fitness-habits (7:10AM) — 1x/día máximo (limitación Hobby)
- Crons cron-job.org: sleep-notifications cada 30min 20-23hs, water-reminder 12hs y 17hs — configurados vía API, secret en query param

---

*Última actualización: Mayo 2026 — Sesión 6 completa (Proyectos + Notion)*

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Contexto general del proyecto para todas las sesiones de trabajo. Las secciones de abajo ("Bloque Sesión N") son un registro histórico de cómo se construyó cada módulo — útil como referencia, pero la fuente de verdad es siempre el código.

---

## Referencia de desarrollo (orientación rápida)

### Comandos

```bash
npm run dev          # Servidor de desarrollo (next dev)
npm run build        # prisma generate && next build (genera el client antes de compilar)
npm run start        # Servidor de producción
npm run lint         # ESLint (eslint-config-next)

npm run db:generate  # Regenerar Prisma Client (correr tras cambiar schema.prisma)
npm run db:push      # Empujar schema a Supabase sin migración
npm run db:migrate   # Crear y aplicar migración (prisma migrate dev)
npm run db:studio    # Prisma Studio (inspeccionar la DB)
```

- **No hay framework de tests** configurado. La verificación se hace con `npx tsc --noEmit` (chequeo de tipos) + `npm run build`.
- **Windows / PowerShell:** el entorno de desarrollo es Windows. Usar sintaxis PowerShell en la terminal.

### Gotchas críticos

- **`prisma db push` suele fallar por conectividad con Supabase.** Workaround documentado y usado en varias sesiones: aplicar el cambio de schema con SQL directo en el **Supabase SQL Editor** (ej. `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`), luego correr `npm run db:generate` localmente para sincronizar el client. Los bloques de sesión incluyen el SQL exacto de cada cambio.
- **Crons divididos por límite de Vercel Hobby (1 ejecución/día por cron).** Los crons diarios viven en `vercel.json`; los más frecuentes (cada 30 min, varias veces al día) se configuran en **cron-job.org** pasando `?secret=` como query param. Todos validan `CRON_SECRET` vía `verifyCronSecret`.
- **Webhook de WhatsApp responde 200 inmediato + `after()`.** Meta exige respuesta <5s. La lógica pesada corre en `after(() => processIncomingMessage(body))` (Next.js background task), única forma de no morir en el runtime serverless.
- **Edge runtime split de auth:** `auth.config.ts` (sin Prisma, edge-compatible, usado en `middleware.ts`) vs `auth.ts` (con `PrismaAdapter`, server-side). No importar Prisma en `auth.config.ts`.
- **Modelos de IA hardcodeados** en las llamadas REST directas a Anthropic: clasificación/NLP con `claude-haiku-4-5-20251001`, respuesta final con `claude-sonnet-4-6`. No hay SDK — se hace `fetch` directo a `https://api.anthropic.com/v1/messages`.
- **Convención de fechas de sueño:** `SleepLog.date` = día de despertar.
- **Acceso restringido:** login Google OAuth filtrado por `ALLOWED_EMAILS` (lista separada por comas) en `auth.config.ts`.

### Arquitectura — el panorama grande

**1. Capa de datos.** Todo pasa por el singleton `db` en `lib/db.ts` (Prisma Client). El schema en `prisma/schema.prisma` está organizado por módulo; cada modelo usa `@@map` a snake_case. Relación 1-1 con `User` para config/estado (`UserSettings`, `UserGoals`, `ConversationMemory`, `PendingTransaction`).

**2. Separación lib / agents / app.**
- `lib/` — lógica de negocio pura por módulo (`sleep.ts`, `fitness.ts`, `nutrition.ts`, `projects.ts`, `ideas.ts`, `finances.ts`, `calendar.ts`, `scoring.ts`) + integraciones externas (`garmin.ts`, `notion.ts`, `whatsapp.ts`, `reminders.ts`) + infra (`db.ts`, `nlp.ts`, `conversation.ts`, `goals.ts`, `cron.ts`, `logger.ts`).
- `agents/` — capa conversacional de WhatsApp. Un directorio por módulo, todos exportados desde `agents/index.ts`. Cada agente expone `process(input: AgentInput): Promise<AgentOutput>` (ver tipos en `lib/types.ts`). Los agentes llaman a `lib/` para la lógica real y devuelven **datos crudos** (no la respuesta final con voz). `agents/prompts.ts` arma los system prompts personalizados por objetivos del usuario.
- `app/` — Next.js App Router. Páginas en `app/(app)/<modulo>/page.tsx` (Server Components con carga paralela vía `Promise.all`, pasan datos a un `*ModuleClient.tsx`). API routes en `app/api/<modulo>/...`. Crons en `app/api/cron/...`.

**3. Orquestrador de WhatsApp (HERMES) — `lib/orchestrator.ts`.** Es el núcleo de la IA conversacional. Flujo de `orchestrate(userId, text)`:
   0. **Bypass de pending:** si hay una `PendingTransaction` activa, el mensaje es respuesta a un flujo de confirmación de finanzas → va directo a `financesAgent.handleConfirmation` (sin clasificar).
   1. Carga contexto de conversación (`lib/conversation.ts`: rolling window K=8 + summary) + objetivos (`lib/goals.ts`) en paralelo.
   2. **Clasificación con Haiku** → uno de los módulos (`MODULE_DESCRIPTIONS`).
   3. El **agente especialista** ejecuta la acción y retorna datos crudos.
   4. **Respuesta final con Sonnet** (voz rioplatense, sin markdown) usando datos del agente + contexto + objetivos.
   5. Guarda turnos user/assistant en `ConversationMemory`.
   - El webhook (`app/api/whatsapp/webhook/route.ts`) es el único punto de entrada; transcribe audios con Whisper antes de orquestar.

**4. Scoring — `lib/scoring.ts`.** Cada módulo expone `calc<Modulo>ScoreForDate()`. `calculateFullScore()` los combina con pesos desde `UserGoals` (normalizados). Distinción clave: `null` = sin datos (no entra al promedio) vs `0` = había datos pero no se cumplió el criterio. Ideas NO entra al score global.

**5. NLP compartido — `lib/nlp.ts`.** `detectIntentAI(context, intents, message, systemPrompt?)` reemplaza la detección por regex: una sola llamada a Haiku por invocación de agente, devuelve la key del intent.

### Convenciones de código

- **TypeScript estricto, sin JS plano.** Mantener `npx tsc --noEmit` en 0 errores.
- Alias de imports: `@/` → raíz del proyecto (ver `tsconfig.json`).
- Los agentes reciben y devuelven siempre objetos tipados (`AgentInput` / `AgentOutput`).
- Los mensajes proactivos de WhatsApp siempre pasan por el orquestrador — los sub-agentes nunca hablan directo con WhatsApp.
- Respuestas de WhatsApp sin markdown (`**`, `_`): se limpian o se generan ya planas.

### Documentos de referencia en la raíz

- `BLUEPRINT.md` — visión y flujos completos del producto.
- `APP_TECHNICAL_AUDIT.md`, `PENDIENTES.md` — auditoría técnica y pendientes.
- `CRON_SETUP.md` — setup detallado de los crons (Vercel + cron-job.org).
- `skills/*.md` — guía por módulo de cómo se construyó cada uno.
- ⚠️ `AGENTS.md` es una copia parcial y **desactualizada** de este archivo (lista módulos como "Por construir" cuando ya están hechos, y dice "Codex API" en vez de Claude API). Tratar `CLAUDE.md` como la fuente de verdad.

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
| 1 | ARQUITECTO — Base App | `skills/base-app.md` | ✅ Completo |
| 2 | MARCADOR — Dashboard + Scoring | `skills/dashboard-scoring.md` | ✅ Completo |
| 3 | MORFEO — Sueño | `skills/sleep.md` | ✅ Completo |
| 4 | ATLETA — Fitness | `skills/fitness.md` | ✅ Completo |
| 5 | CHEF — Nutrición + Ideas | `skills/nutrition-ideas.md` | ✅ Completo |
| 6 | DIRECTOR — Proyectos | `skills/projects.md` | ✅ Completo |
| 7 | HERMES — WhatsApp Partes 1+2+3 | `skills/whatsapp-orchestrator.md` | ✅ Completo |
| — | CONECTOR — Integraciones | `skills/integrations.md` | ✅ Parcial (Calendar + Settings) |
| — | Settings Page | — | ✅ Completo |

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

---

## Bloque Sesion 7 - HERMES (WhatsApp Orquestrador, Partes 1 y 2)

> Nota: la sesion llamada "CONECTOR" (Calendar, Gmail, Finanzas, Lumina) quedo pendiente. Se priorizó WhatsApp primero. HERMES es el nombre adoptado para el orquestrador.

**lib/whatsapp.ts:** Libreria completa del canal WhatsApp. `parseIncomingWebhook` (parsea payload Meta), `sendTextMessage` (POST a graph.facebook.com/v21.0/{PHONE_ID}/messages), `markAsRead`, `downloadAudio` (descarga buffer de audio desde Meta), `transcribeAudio` (llama Whisper API de OpenAI con audio.ogg).

**app/api/whatsapp/webhook/route.ts:** Endpoint del webhook.
- `GET`: verificacion Meta challenge handshake (compara `hub.verify_token` con `WEBHOOK_VERIFY_TOKEN`).
- `POST`: recibe mensajes, llama `after(() => processIncomingMessage(body))` y devuelve 200 inmediatamente. `after()` es la unica forma de ejecutar logica pesada en Vercel serverless sin que el runtime mate la funcion despues del response.
- `processIncomingMessage`: pipeline completo - parse - markAsRead - resolver userId (por whatsappNumber en UserSettings o fallback ALLOWED_EMAIL) - transcribir audio si aplica - guardar INBOUND en DB - `orchestrate()` - enviar respuesta - guardar OUTBOUND - marcar INBOUND como PROCESSED.

**lib/orchestrator.ts:** Orquestrador central. Recibe `(userId, messageText)` y llama al agente correspondiente segun la intencion detectada por Claude Haiku. Devuelve string de respuesta.

**middleware.ts:** Excepcion agregada para el webhook (`/api/whatsapp/webhook` bypass de auth).

**Meta / WhatsApp setup:**
- WABA ID: `1291248383180052`
- Phone Number ID: `1175554135632045` (numero eSIM)
- Numero WhatsApp: `+59892182606`
- Token: System User permanente en Meta Business Manager
- Webhook suscripto a `messages`

**Estado:** WhatsApp recibe mensajes y responde. Confirmado en produccion.

**Variables de entorno:** `WHATSAPP_PHONE_ID`, `WHATSAPP_TOKEN`, `WEBHOOK_VERIFY_TOKEN`, `OPENAI_API_KEY`.

**DB:** Columna `whatsappNumber` en `user_settings` seteada a `+59892182606`.

---

## Estado de Deploy - Mayo 2026

**Plataforma:** Vercel (plan Hobby)
**URL produccion:** `app-personal-ten.vercel.app`
**Repo GitHub:** `github.com/maticoll/App-personal` (branch: **master**)
**Estado:** App levantada y funcionando - WhatsApp activo y respondiendo

**Infraestructura:**
- Auth con Google OAuth: activo
- Base de datos Supabase + tablas: creadas y activas
- HERMES WhatsApp: recibe y responde mensajes

**Crons activos:**
| Job | Plataforma | Horario | Ruta |
|-----|-----------|---------|------|
| sleep-sync | Vercel | 8 AM UTC | `/api/cron/sleep-sync` |
| sleep-notifications | Vercel | 10 PM UTC | `/api/cron/sleep-notifications` |
| sleep-notifications (frecuente) | cron-job.org | cada 30min 20-23hs | `/api/cron/sleep-notifications?secret=...` |
| fitness-sync | Vercel | 6 AM UTC | `/api/cron/fitness-sync` |
| fitness-habits | Vercel | 7:10 AM UTC | `/api/cron/fitness-habits` |
| water-reminder | cron-job.org | 12 PM y 5 PM UTC | `/api/cron/water-reminder?secret=...` |
| morning-summary | Vercel | 10:30 AM UTC (7:30 UY) | `/api/cron/morning-summary` |

**Nota crons:** Vercel Hobby = 1 ejecucion/dia por cron. Los crons mas frecuentes van en cron-job.org (`?secret=` como query param).

---

## Bloque Sesion 8 - HERMES Parte 3 (Morning Summary)

**Cron creado:** `GET /api/cron/morning-summary` - horario `30 10 * * *` (7:30 AM Uruguay, UTC-3). Protegido con `verifyCronSecret`. Agregado a `vercel.json`.

**Pipeline del summary:**
1. Resolver usuario por `ALLOWED_EMAIL` -> `UserSettings.whatsappNumber`
2. Fetch versiculo aleatorio de `bible-api.com/?random=verse&translation=rv1960`
3. Score de ayer: `scoringAgent.getSummaryText(userId, yesterday)` con limpieza de asteriscos
4. Sueno de anoche: `sleepAgent.getSleepSummaryText(userId)`
5. Nutricion / agua de ayer: `getNutritionSummaryText(userId, yesterday)` (fecha explicita para datos de ayer)
6. Cierre motivacional: Claude Haiku (max 60 tokens, 1 linea, sin markdown)
7. `Promise.allSettled` para todas las secciones - si alguna falla se omite silenciosamente

**Formato del mensaje WhatsApp:**
- Sin `**` ni `_` (se limpian del output del scoringAgent)
- Secciones omitidas si no hay datos (score null, sin sueno registrado, etc.)
- Maximo ~20 lineas

**lib/orchestrator.ts:** `orchestrate(userId, text)` - Claude Haiku clasifica en 7 modulos y deriva al agente correcto.

**lib/whatsapp.ts (Parte 1):** 5 funciones - `parseIncomingWebhook`, `sendTextMessage`, `markAsRead`, `downloadAudio`, `transcribeAudio`.

**app/api/whatsapp/webhook/route.ts (completo):** GET (challenge), POST con `after()` - lookup userId - guardar INBOUND - audio/Whisper - `orchestrate()` - responder - OUTBOUND + PROCESSED.

**Variables de entorno** (en `.env.local.example`): `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_WABA_ID`, `WEBHOOK_VERIFY_TOKEN`, `OPENAI_API_KEY`.

---

*Ultima actualizacion: Mayo 2026 - HERMES completo (Partes 1, 2 y 3). WhatsApp activo y Morning Summary configurado.*

---

## Bloque CONECTOR — Google Calendar + Settings Page

> Sesion: Mayo 2026 — Agente CONECTOR (integraciones)

### 1. Google Calendar

**auth.config.ts:** Scopes agregados: `https://www.googleapis.com/auth/calendar.readonly` + `https://www.googleapis.com/auth/calendar.events`. Params: `access_type: "offline"`, `prompt: "consent"` para garantizar refresh_token siempre. IMPORTANTE: el usuario debe cerrar sesion y volver a entrar para que Google otorgue los nuevos scopes.

**lib/calendar.ts:** Módulo completo de Google Calendar sin dependencias externas (fetch REST directo). Funciones: `getCalendarStatus` (verifica conexion y scopes), `getTodayEvents`, `getWeekEvents`, `createEvent`, `findFreeSlots` (busca huecos libres 6–22hs para smart habits de gym, max 3 slots de duracion configurable), `getTodayEventsText` (string para Morning Summary). Manejo automático de token refresh: lee tokens de la tabla `accounts` (guardados por NextAuth PrismaAdapter), refresca si expira en <60s, persiste nuevo token en DB.

**agents/calendar/index.ts:** Reemplaza el stub vacio. Detecta 4 intenciones: `query_today`, `query_week`, `create_event`, `status`. `create_event`: usa Claude Haiku para parsear título + fecha + hora desde texto libre. Exporta `calendarAgent.getTodayEventsText()`, `calendarAgent.findFreeSlots()`, `calendarAgent.createEvent()` para uso de otros agentes.

**API Routes (3):** `GET /api/calendar/today`, `GET /api/calendar/week`, `POST /api/calendar/event`.

**lib/orchestrator.ts:** Módulo `calendar` agregado al clasificador y al switch de routing. Descripción: "El usuario habla de agenda, calendario, eventos, reuniones, o quiere agendar algo".

**Morning Summary actualizado:** `getTodayEventsText(userId)` ahora incluido en el `Promise.allSettled`. Sección "📅 Agenda de hoy:" se muestra si hay eventos. Se omite silenciosamente si no hay eventos o Calendar no está conectado.

**fitness-habits cron actualizado:** Cuando detecta desvío de gym, consulta `findFreeSlots(userId, today, 90)` para obtener un hueco libre de 90 min. Si hay hueco, propone al usuario por WhatsApp: "Tenés libre a las HH:MM-HH:MM. ¿Querés que te lo agendo?". Envía la notificación directamente via `sendTextMessage`. Si Calendar no está conectado, envía igualmente la notificación base sin sugerencia.

**Variable de entorno:** `GOOGLE_CALENDAR_ID` (default: "primary"). No requiere variables nuevas — usa `AUTH_GOOGLE_ID` y `AUTH_GOOGLE_SECRET` ya existentes para refresh de tokens.

**Sin cambios al schema de Prisma** — los tokens ya se guardan en la tabla `accounts` por NextAuth PrismaAdapter.

---

### 2. Settings Page

**app/(app)/settings/page.tsx:** Reemplaza el stub. Server Component que carga en paralelo `UserSettings` de la DB y `getCalendarStatus(userId)`. Pasa datos iniciales a `SettingsClient`.

**components/settings/SettingsClient.tsx:** Client Component con 7 secciones colapsables:

| Sección | Campos | Comportamiento |
|---------|--------|----------------|
| Perfil | Foto (imagen Google), nombre, email | Read-only desde NextAuth + botón logout |
| Hábitos | `expectedSleepTime`, `expectedWakeTime`, `expectedGymTime`, `gymDays` (toggles L-D), `dailyWaterGoalThermos` (slider) | `PATCH /api/settings` |
| Notificaciones | `notificationsEnabled` (toggle) | `PATCH /api/settings` |
| WhatsApp | `whatsappNumber` | `PATCH /api/settings` |
| Apariencia | Dark / Light mode | `useTheme` de next-themes (instantáneo, sin API) |
| Notion | `notionToken`, `notionDbId` | `PATCH /api/settings`, tipo password oculto |
| Google Calendar | Estado de conexión (verde/amarillo/rojo) + info de scopes | Botón "Reconectar" si falta scope |
| Danger Zone | Borrar datos del día | Confirmación explícita, `DELETE /api/settings/day-data` |

**API Routes (2):** `GET+PATCH /api/settings` (upsert de UserSettings, solo campos permitidos por whitelist), `DELETE /api/settings/day-data` (requiere `{ confirm: true }` en body, borra SleepLog+Workouts+Meals+WaterLog+DailyScore del día).

**Sin cambios al schema de Prisma** — todos los campos ya existian en UserSettings desde Sesion 1.

---

### 3. Integración Finanzas

**API:** `finanzas-lemon.vercel.app` — Bearer token `fin_xxx...` guardado en `UserSettings.financesApiKey`. CORS ya habilitado para `app-personal-ten.vercel.app`. La API key nunca viaja al cliente — todos los calls son server-side vía proxy routes.

**lib/finances.ts:** Cliente completo. Funciones: `getFinancesApiKey` (lee de UserSettings, fallback a env `FINANCES_API_KEY`), `getMonthlyReport`, `getRecentTransactions`, `createTransaction`, `getCards`, `getBalances`, `getCategories`, `getFinancesDashboard` (batch compuesto para la página), `getFinancesSummaryText` (para WhatsApp/Morning Summary).

**agents/finances/index.ts:** Reemplaza el stub. Detecta 5 intenciones: `query_spending`, `query_balance`, `query_report`, `create_expense`, `create_income`. Parseo de transacciones en lenguaje natural via Claude Haiku. `checkSpendingAlerts`: alerta si los gastos subieron >20% vs mes anterior.

**API Proxy Routes (2):** `GET /api/finances/summary` (dashboard completo), `GET+POST /api/finances/transactions`.

**Componentes:** `FinancesModuleClient` — balance del mes (ingresos/gastos/balance con trend vs mes anterior), balances por tarjeta, últimas 8 transacciones, historial 6 meses con mini barras. Botón refresh + link directo a `finanzas-lemon.vercel.app`.

**Página `/finances`:** Server Component con carga inicial de `getFinancesDashboard`. Estado vacío si no hay API key — con link a Ajustes.

**lib/orchestrator.ts:** Módulo `finances` agregado. Descripción: "El usuario habla de dinero, gastos, ingresos, balance, plata, compras, pagos o finanzas".

**Settings:** Sección "Finanzas" agregada al SettingsClient con campo API key (tipo password). `PATCH /api/settings` actualizado para aceptar `financesApiKey`.

**Schema Prisma:** +`financesApiKey String?` en UserSettings. SQL para aplicar en Supabase:
```sql
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS "financesApiKey" TEXT;
```

**Variables de entorno:** `FINANCES_APP_URL` (default: `https://finanzas-lemon.vercel.app`), `FINANCES_API_KEY` (fallback global, recomendado configurar por usuario en Settings).

---

### Pendiente

| Integración | Estado | Nota |
|-------------|--------|------|
| Lumina (API externa) | 🔲 Pendiente | Sin API disponible — Ideas ya reemplaza funcionalmente a Lumina en la app |

---

*Ultima actualizacion: Mayo 2026 - CONECTOR: Google Calendar + Settings Page + Finanzas completados. Ideas refactorizado estilo Lumina.*

---

## Bloque IDEAS — Refactor Lumina-style

> Sesion: Mayo 2026 — Reemplazo de Lumina por módulo de Ideas nativo con UX equivalente

**Motivación:** La app de Lumina usaba localStorage en HTML standalone. Se replicó su UX dentro del módulo `/ideas` de la app, conectado a Supabase, conservando el agente de WhatsApp existente.

**Schema Prisma (cambios):** +`priority String @default("media")` y +`status String @default("idea")` en modelo `Idea`. SQL para aplicar en Supabase:
```sql
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS "priority" TEXT NOT NULL DEFAULT 'media';
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'idea';
```

**lib/ideas.ts (actualización):** Nuevos tipos: `IdeaPriority` ("baja" | "media" | "alta" | "urgente"), `IdeaStatus` ("idea" | "progreso" | "hecha"). `IdeasStats` ahora incluye `active` y `done`. Nueva función `cycleIdeaStatus`. `captureIdeaNLP` acepta `options.priority`. `getAllIdeas` filtra por `status`. `updateIdea` acepta `priority` y `status`.

**API Routes (actualizaciones):** `GET /api/ideas` acepta `?status=` como filtro adicional. `POST /api/ideas` acepta `priority` en el body. `PATCH /api/ideas/[id]` acepta `priority`, `status`, y `cycleStatus: true` para ciclar automáticamente (idea → progreso → hecha → idea).

**components/ideas/IdeasModuleClient.tsx (reescritura completa):** Vista única sin tabs. Estructura: stats row (3 pills: Total/Activas/Hechas) + capture form con selector de prioridad + filter tabs (Todas/Ideas/En progreso/Hechas) + search + tag pills + lista de cards. Cada card muestra: dot de prioridad (colores: gris/amber/naranja/rojo), título, tags clickeables, badge de status, badge de prioridad. Al expandir: texto completo + botón de cyclear status (con spinner) + fecha + editar inline + borrar. Optimistic updates en todas las acciones.

**Colores de prioridad:** baja → slate, media → amber, alta → orange, urgente → red.

**Agente de ideas (actualización):** Respuesta a `query` ahora muestra `active` y `done` stats, e incluye el `status` de cada idea reciente.

**Sin cambios al orquestrador** — el módulo `ideas` ya estaba registrado.

**Archivos old (no importados, dead code):** `components/ideas/IdeaCaptureForm.tsx`, `IdeaCard.tsx`, `IdeaDetail.tsx`, `IdeasGrid.tsx`, `IdeasStats.tsx`, `TagFilter.tsx` — pueden borrarse en cleanup futuro.

---

*Ultima actualizacion: Mayo 2026 - Ideas refactorizado con UX estilo Lumina. priority + status nativos en DB.*

---

## Bloque Sesion 9 — IA Avanzada (Objetivos, Memoria, Sintesis, TypeScript)

> Sesion: Mayo 2026 — Sistema de objetivos dinamicos, memoria de conversacion, agente de sintesis y TypeScript limpio

### 1. Schema Prisma (nuevos modelos)

**`UserGoals`:** Pesos por modulo (`sleepWeight`, `fitnessWeight`, `nutritionWeight`, `projectsWeight`, `financesWeight` — todos Float @default(1.0)) + objetivos en texto libre por modulo (campos String?). `@@map("user_goals")`. Relacion 1-1 con User.

**`ConversationMemory`:** Rolling window de conversacion para WhatsApp. Campos: `recentMessages Json @default("[]")` (array de ultimos K=8 turnos), `summary String?` (resumen comprimido de turnos anteriores), `turnCount Int @default(0)`. `@@map("conversation_memory")`. Relacion 1-1 con User.

**`DailyScore`:** +`financesScore Int?` — modulo de finanzas ahora contribuye al score global.

**SQL para aplicar en Supabase:**
```sql
-- UserGoals
CREATE TABLE IF NOT EXISTS user_goals (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "sleepWeight" FLOAT NOT NULL DEFAULT 1.0,
  "fitnessWeight" FLOAT NOT NULL DEFAULT 1.0,
  "nutritionWeight" FLOAT NOT NULL DEFAULT 1.0,
  "projectsWeight" FLOAT NOT NULL DEFAULT 1.0,
  "financesWeight" FLOAT NOT NULL DEFAULT 1.0,
  "sleepGoal" TEXT, "fitnessGoal" TEXT, "nutritionGoal" TEXT,
  "projectsGoal" TEXT, "financesGoal" TEXT, "globalGoal" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ConversationMemory
CREATE TABLE IF NOT EXISTS conversation_memory (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "recentMessages" JSONB NOT NULL DEFAULT '[]',
  summary TEXT,
  "turnCount" INT NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- DailyScore finances column
ALTER TABLE daily_scores ADD COLUMN IF NOT EXISTS "financesScore" INT;
```

### 2. lib/goals.ts (nuevo)

CRUD completo para objetivos del usuario. Funciones: `getGoals(userId)` (upsert — crea fila vacia si no existe), `updateGoals(userId, data)`, `getModuleWeight(userId, module)`. Los objetivos se usan en todos los prompts del sistema para personalizar las respuestas de los agentes.

**API Route:** `GET/PATCH /api/goals` — requiere auth, valida campos permitidos por whitelist.

### 3. Sistema de Prompts de Agentes (agents/prompts/index.ts)

Prompts personalizados por modulo basados en los objetivos del usuario. Funciones exportadas:
- `buildOrchestratorPrompt(goals, summary?)` — prompt del orquestrador con contexto de objetivos y resumen de conversacion
- `buildSleepPrompt(goals)` — prompt del agente de sueno
- `buildFitnessPrompt(goals)` — prompt del agente de fitness
- `buildSynthesisPrompt(goals)` — prompt del agente de sintesis cross-modulo

**Agente de sueno actualizado:** En `process()` carga goals con `getGoals(userId)` y pasa `buildSleepPrompt(goals)` como `systemPrompt` a `detectIntentAI()`.

### 4. lib/scoring.ts (actualizacion)

**Finanzas integrado al score global:** `calcFinancesScoreForDate()` exportada. `calculateFullScore()` ahora retorna `finances: { score, met, missed }` ademas de los 5 modulos existentes. El score global pondera finanzas junto con los demas modulos.

**Pesos dinamicos:** `calculateFullScore` ahora acepta `weights` opcionales (desde UserGoals). Si no hay objetivos, usa pesos iguales para todos los modulos.

### 5. lib/conversation.ts (nuevo)

Memoria de conversacion rolling-window para WhatsApp, inspirada en `Core/memory_service.py`.

**Constantes:** K=8 (turnos recientes), M=12 (trigger de resumen por cantidad), GAP_H=6 (trigger de resumen por tiempo).

**Funciones:**
- `getConversationContext(userId)` — carga `recentTurns` + `summary` de la DB
- `addTurn(userId, role, content)` — agrega turno, triggerea resumen si necesario
- `formatContextForPrompt(ctx)` — formatea para incluir en el system prompt
- `clearConversationMemory(userId)` — reset completo
- `summarizeTurns()` — llama Claude Haiku (≤120 palabras, tercera persona, espanol rioplatense, incorpora resumen anterior)

### 6. lib/orchestrator.ts (refactor v2)

**Flujo v2:**
1. Carga contexto de conversacion + objetivos del usuario en paralelo
2. Guarda turno user en memoria (no bloqueante)
3. Claude Haiku clasifica modulo (rapido, barato)
4. Agente especialista ejecuta accion y retorna datos crudos
5. Claude Sonnet genera respuesta final con voz natural + contexto
6. Guarda turno assistant en memoria

**Nuevo modulo `synthesis`:** Detecta preguntas cross-domain ("como voy en general", "analisis de la semana").

**`generateFinalResponse()`:** Claude Sonnet (claude-sonnet-4-6), max_tokens: 350. Voz rioplatense, sin asteriscos, max 3-4 oraciones para respuestas simples.

### 7. agents/synthesis/index.ts (nuevo)

Agente cross-modulo que detecta patrones entre sleep, fitness, nutricion, proyectos y finanzas.

**`loadMultiModuleData(userId, windowDays)`:** Carga datos de todos los modulos en paralelo con `Promise.allSettled`.

**`buildDataSummary(data)`:** Formatea datos para Claude: periodos, registros de sueno, workouts, comidas, scores diarios, proyectos.

**`callSynthesisAI(systemPrompt, dataSummary)`:** Claude Sonnet, max 3 patrones/conexiones, recomendacion concreta, sin markdown.

**API publica:**
- `analyze(input)` — analisis completo, retorna `SynthesisOutput` con insights + summary. Requiere minimo 3 dias de datos.
- `getDailyInsight(userId)` — version corta (2 oraciones) para Morning Summary
- `getSynthesisText(userId, days)` — texto completo para WhatsApp

**Morning Summary actualizado:** Ahora incluye seccion "🔍 Insight" desde `synthesisAgent.getDailyInsight(userId)`.

### 8. Agentes con process() restaurados

`financesAgent.process()`, `fitnessAgent.process()`, `projectsAgent.process()` — metodos `process` agregados/restaurados para compatibilidad con el orquestrador. Tambien `getSleepYesterday()` agregado a `lib/sleep.ts` e importado en el agente de sueno.

### 9. TypeScript — 0 errores

Correcciones aplicadas:
- Duplicados `onGoalsUpdate` removidos de 3 agentes (finances, fitness, projects)
- `content` → `body` en WhatsApp webhook (campo correcto del schema)
- `garmin.ts` null assertion en `getGarminSession`
- 65 anotaciones `: any` agregadas a lambdas en lib/fitness, lib/nutrition, lib/sleep, lib/scoring, lib/projects, agents/synthesis
- `FinancesReport.monthly.totalIncome/totalExpenses` (fields correctos)
- `fetchGarminActivities` recibe `string` no `Date`
- `getFinancesSummaryText` puede retornar null — fallback agregado
- `whatsAppMessages WhatsAppMessage[]` agregado al modelo User en Prisma

**`npx tsc --noEmit` pasa con 0 errores.**

---

*Ultima actualizacion: Mayo 2026 - IA avanzada completa: objetivos, memoria de conversacion, agente de sintesis, TypeScript limpio.*

---

## Bloque Sesion 10 - Finanzas: Flujo WhatsApp + UI Estadisticas

> Sesion: Mayo 2026 - Registro de gastos por WhatsApp con confirmacion + pagina de estadisticas con diseno Stitch "Precision Ledger"

### 1. Schema Prisma - PendingTransaction

Nuevo modelo para guardar estado del flujo de confirmacion de transacciones:

```prisma
model PendingTransaction {
  id        String   @id @default(cuid())
  userId    String   @unique
  data      Json
  step      String   @default("confirm")
  cards     Json?
  createdAt DateTime @default(now())
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("pending_transactions")
}
```

SQL para aplicar en Supabase:
```sql
CREATE TABLE IF NOT EXISTS pending_transactions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  step TEXT NOT NULL DEFAULT 'confirm',
  cards JSONB,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);
```

**Accion requerida:** `npm run db:generate` en la maquina del usuario para regenerar el Prisma client.

### 2. lib/pending-transaction.ts (nuevo)

Tipos y funciones para el estado de transaccion pendiente:

- `PendingStep = "select_card" | "confirm"`
- `PendingTransactionData` - datos extraidos de la transaccion
- `PendingRecord` - lo que devuelve `getPending`
- `savePending(userId, data, step, cards?)` - upsert
- `getPending(userId): Promise<PendingRecord | null>`
- `clearPending(userId): Promise<void>`

### 3. agents/finances/index.ts (reescritura completa, 475 lineas)

**Tipos nuevos:** `ExtractedTransaction` con campos: `type`, `amount`, `currency`, `categoryHint`, `cardHint`, `description`, `date`, `confidence`.

**Funciones internas:**
- `extractTransaction(text, categories)`: Claude Haiku con lista completa de categorias en el prompt. Extrae la transaccion en JSON estructurado.
- `fuzzyMatchCard(hint, cards)`: match por substring, luego primera palabra.
- `fuzzyMatchCategory(hint, categories, type)`: exacto -> parcial -> parcial inverso -> "Otros" -> primero disponible.
- `buildConfirmMessage(tx, card, category)`: mensaje de confirmacion con emoji, monto, fecha, categoria, tarjeta.
- `handleCreateTransaction(userId, text, type)`: fetch cards+categories en paralelo, extrae, fuzzy match, si no encuentra tarjeta lista opciones y guarda en `select_card`, si encuentra todo guarda en `confirm`.
- `handleConfirmation(userId, text, pending)` (exportada): maneja `select_card` (numero o nombre) y `confirm` (si/no). Llamada directamente desde el orquestrador.

**5 intenciones en `financesAgent.process()`:** `query_spending`, `query_balance`, `query_report`, `create_expense`, `create_income`.

### 4. lib/orchestrator.ts - Paso 0 (pending bypass)

Antes de clasificar el modulo con Claude Haiku, el orquestrador chequea si hay una transaccion pendiente:

```typescript
const pending = await getPending(userId).catch(() => null);
if (pending) {
  const response = await financesAgent.handleConfirmation(userId, text, pending);
  // guardar turnos en memoria...
  return response; // bypass total de Haiku + Sonnet
}
```

Esto asegura que "si", "no", "1", "2" etc. se intercepten correctamente sin que Haiku los clasifique como otro modulo.

### 5. lib/finances.ts - Tipos extendidos

Nuevos tipos agregados:
- `FinancesCategoryBreakdown`: `{ name, emoji?, color?, total, currency? }`
- `FinancesMonthlyReport`: +`expenseByCategory`, +`incomeByCategory`, +`topCategories`, +`expenseByCard`, +`dailyBalance`, +`openingBalance`
- `FinancesReport.last6`: acepta tanto `income`/`expenses` como `totalIncome`/`totalExpenses` (compatibilidad con distintas versiones de la API)

### 6. components/finances/FinancesModuleClient.tsx (reescritura, 491 lineas)

Diseno basado en Stitch "Precision Ledger" (dark obsidian, #0D0F14 bg, #1A1D27 cards, #c0c1ff primary indigo).

**Sub-componentes internos:**
- `SectionLabel`: label en caps gris
- `TrendChip`: capsule verde/rojo con flecha y porcentaje
- `StatCard`: tarjeta de stat con label, valor y trend chip
- `TopCategories`: barras de progreso proporcionales por categoria
- `DonutChart`: CSS conic-gradient calculado desde porcentajes reales de la API
- `DailyEvolution`: SVG inline con area chart desde `dailyBalance` (Record<string, number>)
- `Last6Months`: barras agrupadas ingresos/gastos de los ultimos 6 meses
- `CardExpenses`: barras proporcionales de gastos por tarjeta
- `TransactionRow`: fila de transaccion con icono tipo, descripcion, monto coloreado

**Helper `normalizeLast6()`:** normaliza los distintos nombres de campo que puede devolver la API (income/totalIncome, expenses/totalExpenses).

Todas las secciones son condicionales - se omiten si no hay datos (empty states con texto neutral).

### 7. Flujo completo de registro de gasto por WhatsApp

```
Usuario: "gaste 500 en el super con visa"
  -> orchestrator: chequea pending (ninguno)
  -> Haiku: clasifica "finances"
  -> financesAgent.process(create_expense)
    -> extractTransaction: { amount: 500, cardHint: "visa", categoryHint: "supermercado" }
    -> getCards() + getCategories() en paralelo
    -> fuzzyMatchCard("visa", cards) -> Visa Credito
    -> fuzzyMatchCategory("supermercado", ...) -> Supermercados
    -> savePending(step: "confirm")
  -> Sonnet genera: "Confirmas gasto de $500 en Supermercados con Visa Credito el 19/05?"
  
Usuario: "si"
  -> orchestrator: getPending() -> hay pending!
  -> financesAgent.handleConfirmation(pending.step="confirm", "si")
    -> createTransaction(...)
    -> clearPending()
  -> devuelve: "Listo! Gasto de $500 registrado."
```

Si la tarjeta no se encuentra: lista las tarjetas numeradas, guarda `step: "select_card"` con `cards` en la DB.

*Ultima actualizacion: Mayo 2026 - Flujo WhatsApp completo para gastos/ingresos + UI estadisticas Precision Ledger.*

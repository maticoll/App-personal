# APP_TECHNICAL_AUDIT — CLAUDIO (App Personal)

> Auditoría técnica generada el 2026-05-23  
> Rol: Senior TypeScript Software Architect & Technical Documentation Lead  
> Base de análisis: revisión exhaustiva de todos los archivos del proyecto

---

## 1. Resumen Ejecutivo

**CLAUDIO** es una super-app web personal construida sobre **Next.js 15 (App Router)**. Su objetivo es centralizar el seguimiento diario de una persona en seis dominios: sueño, fitness, nutrición, proyectos, ideas y finanzas. Incluye un sistema de scoring diario /100 por módulo y un dashboard visual unificado.

El diferenciador clave es su **capa conversacional**: el sistema acepta mensajes de WhatsApp en lenguaje natural, los procesa con un orquestador IA (HERMES) que delega a agentes especializados por dominio (Claude Haiku para clasificación/NLP, Claude Sonnet para respuestas finales), y devuelve respuestas en lenguaje rioplatense.

La app también se instala como **PWA en iPhone** y envía un **morning summary automático** cada mañana por WhatsApp con el resumen del día anterior.

**Tipo de sistema:** monorepo fullstack Next.js · private single-user · IA-first · integración con múltiples APIs externas · PWA mobile-first.

---

## 2. Stack Tecnológico Detectado

### Frontend
| Tecnología | Versión | Rol |
|---|---|---|
| Next.js | 15.1 | Framework (App Router, SSR, API routes) |
| React | 19 | UI rendering |
| TypeScript | — | Lenguaje principal (100% del código) |
| Tailwind CSS | 3 | Estilos (dark/light mode, mobile-first) |
| next-themes | — | Dark/Light mode toggle |
| Recharts | — | Gráficos (líneas, barras, pie, área) |
| @hello-pangea/dnd | ^18 | Drag & drop (Kanban de proyectos) |
| lucide-react | — | Iconografía |
| date-fns | — | Manejo de fechas |
| clsx + tailwind-merge | — | Utilidades de clases CSS |

### Backend / API
| Tecnología | Versión | Rol |
|---|---|---|
| Next.js API Routes | 15.1 | 52 endpoints internos |
| NextAuth v5 | 5.0.0-beta.25 | Auth Google OAuth + sesiones JWT |
| @auth/prisma-adapter | — | Persistencia de sesiones |
| Prisma ORM | 5.x | ORM PostgreSQL |
| @notionhq/client | 5.20.0 | SDK Notion |

### Base de datos / Infraestructura
| Servicio | Rol |
|---|---|
| Supabase (PostgreSQL) | Base de datos principal |
| Vercel | Deploy + Cron jobs |
| next-pwa | Service worker + caché offline |

### IA / LLMs
| Modelo | Uso |
|---|---|
| `claude-haiku-4-5-20251001` | Clasificación de intenciones, NLP de textos libres, parseo de transacciones, resúmenes |
| `claude-sonnet-4-6` | Generación de respuesta final de WhatsApp, síntesis cross-módulo |
| OpenAI Whisper | Transcripción de audios de WhatsApp a texto |

### APIs externas integradas
| API | Propósito |
|---|---|
| Meta Graph API v21.0 | Envío/recepción de mensajes WhatsApp |
| Google Calendar API v3 | Lectura y creación de eventos |
| Garmin Connect (no oficial) | Sincronización de sueño y actividades físicas |
| Notion API | Sincronización de tareas IT del trabajo |
| `finanzas-lemon.vercel.app` | App de finanzas externa propia |
| `bible-api.com` | Versículo diario para morning summary |
| Axiom | Logging centralizado |

---

## 3. Estructura General del Proyecto

```
App personal/
├── app/                    # Código de Next.js (App Router)
│   ├── layout.tsx          # Root layout: metadata, fonts, ThemeProvider
│   ├── (app)/              # Grupo de rutas autenticadas
│   │   ├── layout.tsx      # Layout autenticado: AppLayout wrapper
│   │   ├── page.tsx        # Dashboard principal
│   │   ├── sleep/          # Módulo sueño
│   │   ├── fitness/        # Módulo fitness
│   │   ├── nutrition/      # Módulo nutrición
│   │   ├── projects/       # Módulo proyectos (Kanban)
│   │   ├── ideas/          # Módulo ideas
│   │   ├── finances/       # Módulo finanzas
│   │   ├── scoring/        # Historial de scoring
│   │   └── settings/       # Configuración del usuario
│   ├── (auth)/             # Grupo de rutas públicas
│   │   └── login/          # Página de login Google
│   └── api/                # 52 endpoints (ver Sección 6)
│       ├── auth/           # NextAuth handler
│       ├── calendar/       # Google Calendar
│       ├── cron/           # 7 jobs automáticos
│       ├── finances/       # Proxy a app externa
│       ├── fitness/        # Operaciones fitness
│       ├── garmin/         # Estado Garmin
│       ├── goals/          # Objetivos del usuario
│       ├── ideas/          # CRUD ideas
│       ├── nutrition/      # Operaciones nutrición
│       ├── projects/       # CRUD proyectos/tareas
│       ├── scoring/        # Motor de scoring
│       ├── settings/       # Configuración
│       ├── sleep/          # Operaciones sueño
│       └── whatsapp/       # Webhook Meta
├── agents/                 # Agentes de IA por dominio
│   ├── index.ts            # Re-exports
│   ├── prompts.ts          # Builders de prompts personalizados
│   ├── orchestrator/       # (legacy stub — lógica real en lib/orchestrator.ts)
│   ├── sleep/
│   ├── fitness/
│   ├── nutrition/
│   ├── projects/
│   ├── ideas/
│   ├── scoring/
│   ├── calendar/
│   ├── finances/
│   └── synthesis/          # Agente cross-módulo
├── components/             # Componentes React (~62 archivos)
│   ├── dashboard/
│   ├── finances/
│   ├── fitness/
│   ├── ideas/
│   ├── layout/             # AppLayout, Header, Sidebar, BottomNav
│   ├── nutrition/
│   ├── projects/
│   ├── providers/          # ThemeProvider
│   ├── scoring/
│   ├── settings/
│   ├── sleep/
│   └── ui/                 # Componentes genéricos
├── lib/                    # Módulos de lógica de negocio (~22 archivos)
│   ├── db.ts               # Prisma singleton
│   ├── scoring.ts          # Motor de scoring global
│   ├── sleep.ts, fitness.ts, nutrition.ts, ideas.ts
│   ├── projects.ts, finances.ts, calendar.ts
│   ├── garmin.ts           # Cliente Garmin Connect (SSO no oficial)
│   ├── whatsapp.ts         # Cliente Meta Graph API
│   ├── orchestrator.ts     # HERMES: orquestador WhatsApp
│   ├── conversation.ts     # Memoria conversacional rolling-window
│   ├── goals.ts            # Objetivos y pesos de scoring
│   ├── pending-transaction.ts  # Flujo multi-step finanzas
│   ├── notion.ts           # Cliente Notion
│   ├── reminders.ts        # Sistema de recordatorios
│   ├── nlp.ts              # Helpers NLP genéricos
│   ├── logger.ts           # Axiom logging
│   ├── cron.ts             # Verificador CRON_SECRET
│   ├── types.ts            # Tipos compartidos
│   └── utils.ts            # Utilidades genéricas
├── prisma/
│   └── schema.prisma       # 18 modelos de DB
├── public/                 # Assets estáticos + manifest PWA
├── skills/                 # Documentación de sesiones de desarrollo
├── middleware.ts            # Protección de rutas (Edge)
├── auth.ts                 # NextAuth config servidor
├── auth.config.ts          # NextAuth config Edge
├── next.config.ts          # Configuración Next.js + PWA
├── vercel.json             # Cron jobs de Vercel
├── tailwind.config.ts
└── tsconfig.json
```

---

## 4. Arquitectura de la Aplicación

### Visión general

```
                    ┌─────────────────────────────────────────┐
                    │            USUARIO FINAL                │
                    │   Browser (PWA iPhone) + WhatsApp       │
                    └───────────────┬─────────────────────────┘
                                    │
              ┌─────────────────────┼──────────────────────┐
              │                     │                      │
              ▼                     ▼                      ▼
     ┌─────────────┐      ┌──────────────────┐   ┌──────────────────┐
     │  Next.js    │      │ WhatsApp Webhook  │   │   Cron Jobs      │
     │  App Router │      │ /api/whatsapp/    │   │ (7 jobs Vercel)  │
     │  (SSR/RSC)  │      │    webhook        │   └────────┬─────────┘
     └──────┬──────┘      └────────┬──────────┘            │
            │                      │                        │
            ▼                      ▼                        │
     ┌─────────────┐      ┌──────────────────┐             │
     │  52 API     │      │ HERMES           │◄────────────┘
     │  Routes     │      │ Orchestrator     │
     │             │      │ (lib/orchestrator)│
     └──────┬──────┘      └────────┬──────────┘
            │                      │
            ▼                      ▼
     ┌────────────────────────────────────────┐
     │           lib/ (módulos de lógica)     │
     │  sleep · fitness · nutrition · ideas   │
     │  projects · finances · calendar        │
     │  scoring · garmin · conversation       │
     └──────────────────┬─────────────────────┘
                        │
           ┌────────────┼────────────────────────┐
           ▼            ▼                        ▼
   ┌──────────────┐ ┌─────────────┐   ┌─────────────────────┐
   │  Supabase    │ │ Claude API  │   │  APIs externas      │
   │  PostgreSQL  │ │ (Haiku +    │   │  Google · Garmin    │
   │  (Prisma)    │ │  Sonnet)    │   │  Meta · Notion      │
   └──────────────┘ └─────────────┘   │  Finanzas · Bible   │
                                       └─────────────────────┘
```

### Capas principales

1. **Presentación (RSC + Client Components):** Next.js App Router. Las páginas son Server Components que cargan datos iniciales en paralelo y los pasan como props a Client Components para la interactividad.
2. **API Routes:** 52 endpoints. Todos requieren sesión autenticada excepto los cron jobs (CRON_SECRET) y el webhook de WhatsApp.
3. **lib/:** Capa de servicios. Sin dependencias de React. Consume Prisma, APIs externas, y modelos Claude.
4. **agents/:** Capa de IA. Cada agente recibe texto en lenguaje natural y devuelve datos estructurados + texto de respuesta. Los agentes usan los módulos de `lib/`.
5. **Base de datos:** PostgreSQL en Supabase con 18 modelos Prisma.

---

## 5. Rutas Frontend

| Ruta | Archivo | Qué muestra | Componentes principales |
|---|---|---|---|
| `/` | `app/(app)/page.tsx` | Dashboard: saludo, GlobalScoreRing, 6 ModuleSummaryCards en bento grid | `GlobalScoreRing`, `ModuleSummaryCard` |
| `/sleep` | `app/(app)/sleep/page.tsx` | Módulo sueño: registro manual, sync Garmin, stats semanales, gráficos | `SleepModuleClient`, `SleepTodayCard`, `SleepWeekStats`, `SleepDurationChart`, `SleepQualityChart`, `SleepTimingChart`, `SleepHistoryList` |
| `/fitness` | `app/(app)/fitness/page.tsx` | Módulo fitness: workouts del día, rutinas, stats, Garmin | `FitnessModuleClient`, `TodayWorkoutCard`, `GymRoutineCard`, `FitnessQuickActions`, `WeeklyVolumeChart`, `WorkoutHistoryList`, `RoutineManager` |
| `/nutrition` | `app/(app)/nutrition/page.tsx` | Módulo nutrición: macros, agua, historial de comidas | `NutritionModuleClient`, `MealLogCard`, `MacrosChart`, `WaterTracker`, `NutritionQuickActions`, `DietCard` |
| `/projects` | `app/(app)/projects/page.tsx` | Módulo proyectos: Kanban drag&drop, sync Notion | `ProjectsModuleClient`, `KanbanBoard` (SSR=false), `ProjectCard`, `ProjectDetail`, `TimelineView` |
| `/ideas` | `app/(app)/ideas/page.tsx` | Módulo ideas: captura NLP, explorador con filtros | `IdeasModuleClient`, `IdeaCaptureForm`, `IdeaCard`, `IdeasGrid`, `TagFilter` |
| `/finances` | `app/(app)/finances/page.tsx` | Dashboard finanzas: balance, transacciones, gráficos | `FinancesModuleClient` |
| `/scoring` | `app/(app)/scoring/page.tsx` | Historial de scoring: gráficos por período, desglose por módulo | `ScoringDashboard`, `GlobalScoreRing`, `ScoreCardModule`, `ScoreTrendChart`, `ScoringHistoryClient` |
| `/settings` | `app/(app)/settings/page.tsx` | Configuración: perfil, hábitos, notificaciones, integraciones | `SettingsClient` (7 secciones colapsables) |
| `/login` | `app/(auth)/login/page.tsx` | Login con Google OAuth | — |

**Notas:**
- Todas las rutas del grupo `(app)` requieren sesión (forzado por `app/(app)/layout.tsx`).
- `KanbanBoard` usa `dynamic(..., { ssr: false })` para evitar hidratación con `@hello-pangea/dnd`.

---

## 6. Rutas API / Backend

### Auth

| Método | Ruta | Descripción |
|---|---|---|
| GET/POST | `/api/auth/[...nextauth]` | NextAuth v5 handler (login, callback, session, signout) |

### Calendar

| Método | Ruta | Archivo | Qué hace | Datos recibe | Datos devuelve |
|---|---|---|---|---|---|
| GET | `/api/calendar/today` | `app/api/calendar/today/route.ts` | Eventos de hoy en Google Calendar | — | Array de eventos |
| GET | `/api/calendar/week` | `app/api/calendar/week/route.ts` | Eventos de la semana | — | Array de eventos |
| GET/POST | `/api/calendar/event` | `app/api/calendar/event/route.ts` | Crear/listar eventos | `{ title, date, startTime, endTime }` | Evento creado |

### Cron Jobs

| Método | Ruta | Horario (UTC) | Qué ejecuta | Protección |
|---|---|---|---|---|
| GET | `/api/cron/sleep-sync` | 8:00 AM | Sync Garmin → SleepLog últimos 2 días | CRON_SECRET |
| GET | `/api/cron/sleep-notifications` | 10:00 PM | Recordatorio bedtime + alerta wake sin registrar | CRON_SECRET |
| GET | `/api/cron/fitness-sync` | 6:00 AM | Sync Garmin actividades → Workout | CRON_SECRET |
| GET | `/api/cron/fitness-habits` | 7:10 AM | Check smart habits gym; si desvío → busca slot libre en Calendar → WhatsApp | CRON_SECRET |
| GET | `/api/cron/morning-summary` | 10:30 AM | Ensambla resumen matutino (score+sueño+nutrición+agenda+insight+versículo) → WhatsApp | CRON_SECRET |
| GET | `/api/cron/reminders` | — | Envía recordatorios pendientes de la tabla Reminder | CRON_SECRET |
| GET | `/api/cron/water-reminder` | — | Recordatorio de hidratación (cron-job.org, 12h y 17h) | CRON_SECRET |

### Finances

| Método | Ruta | Qué hace | Servicios |
|---|---|---|---|
| GET | `/api/finances/summary` | Proxy → `getFinancesDashboard` | `lib/finances.ts` |
| GET/POST | `/api/finances/transactions` | Lista / crea transacciones en app externa | `lib/finances.ts` |

### Fitness

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/api/fitness/log-exercise` | Log de ejercicio vía NLP (Claude Haiku) |
| GET/POST | `/api/fitness/routines` | CRUD rutinas de gym |
| GET/PUT/DELETE | `/api/fitness/routines/[id]` | Rutina individual |
| POST | `/api/fitness/sync-garmin` | Sync manual de actividades Garmin |
| GET | `/api/fitness/today` | Resumen fitness del día |
| GET | `/api/fitness/weekly-stats` | Stats semanales |
| POST | `/api/fitness/workout` | Crear workout |
| GET/PUT/DELETE | `/api/fitness/workout/[id]` | Workout individual |
| POST | `/api/fitness/workout/[id]/exercise` | Agregar ejercicio a workout |

### Garmin, Goals, Scoring, Settings

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/garmin/status` | Estado de la sesión Garmin (cookies válidas) |
| GET/PUT | `/api/goals` | Objetivos del usuario + pesos de scoring |
| POST | `/api/scoring/calculate` | Fuerza recálculo del score del día |
| GET | `/api/scoring/history` | Historial con period (day/week/month) |
| GET | `/api/scoring/today` | Score del día (calcula si no existe) |
| GET/PUT | `/api/settings` | Configuración del usuario (UserSettings) |
| DELETE | `/api/settings/day-data` | Borra todos los datos del día (con `{ confirm: true }`) |

### Sleep

| Método | Ruta | Qué hace | Datos recibe |
|---|---|---|---|
| POST | `/api/sleep/log` | Registra bedTime / wakeTime / manual | `{ type: 'bed'|'wake'|'manual', time?, ... }` |
| GET | `/api/sleep/today` | Registro de sueño de hoy | — |
| GET | `/api/sleep/history` | Historial de sueño | `?limit=N` |
| POST | `/api/sleep/sync-garmin` | Sync manual Garmin → SleepLog | — |
| DELETE | `/api/sleep/[id]` | Elimina un registro | — |

### WhatsApp

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/whatsapp/webhook` | Verificación del challenge Meta (handshake) |
| POST | `/api/whatsapp/webhook` | Recibe mensajes, llama `orchestrate()` con `after()`, responde |

---

## 7. Llamadas a APIs Externas

| Servicio | URL / Dominio | Archivo | Método | Propósito | Env Vars |
|---|---|---|---|---|---|
| **Anthropic Claude** | `api.anthropic.com/v1/messages` | `lib/orchestrator.ts`, `lib/nlp.ts`, `lib/fitness.ts`, `lib/nutrition.ts`, `lib/ideas.ts`, `lib/conversation.ts`, `lib/reminders.ts`, `agents/calendar`, `agents/finances`, `agents/synthesis`, `agents/nutrition` | POST | Clasificación de intenciones, NLP, generación de respuestas | `ANTHROPIC_API_KEY` |
| **OpenAI Whisper** | `api.openai.com/v1/audio/transcriptions` | `lib/whatsapp.ts` | POST (multipart) | Transcripción de audios de WhatsApp | `OPENAI_API_KEY` |
| **Meta Graph API** | `graph.facebook.com/v21.0/{phoneId}/messages` | `lib/whatsapp.ts` | POST | Envío de mensajes WhatsApp | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` |
| **Meta Graph API** | `graph.facebook.com/v21.0/{mediaId}` | `lib/whatsapp.ts` | GET | Descarga de archivos de audio | `WHATSAPP_TOKEN` |
| **Google Calendar API** | `www.googleapis.com/calendar/v3/calendars/{id}/events` | `lib/calendar.ts` | GET/POST | Lectura y creación de eventos | `GOOGLE_CALENDAR_ID` |
| **Google OAuth Token** | `oauth2.googleapis.com/token` | `lib/calendar.ts` | POST | Refresh automático del access_token | `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` |
| **Garmin SSO** | `sso.garmin.com/sso/signin`, `/sso/login` | `lib/garmin.ts` | GET/POST | Autenticación SSO (flujo CSRF no oficial) | `GARMIN_EMAIL`, `GARMIN_PASSWORD` |
| **Garmin Connect** | `connect.garmin.com/modern/proxy/wellness-service/wellness/dailySleepData` | `lib/garmin.ts` | GET | Datos de sueño | `GARMIN_EMAIL`, `GARMIN_PASSWORD` |
| **Garmin Connect** | `connect.garmin.com/modern/proxy/activitylist-service/activities/search/activities` | `lib/garmin.ts` | GET | Actividades físicas del día | `GARMIN_EMAIL`, `GARMIN_PASSWORD` |
| **App Finanzas** | `finanzas-lemon.vercel.app/api/*` | `lib/finances.ts` | GET/POST | Dashboard, transacciones, tarjetas, categorías | `FINANCES_APP_URL`, `FINANCES_API_KEY` |
| **Notion API** | Via `@notionhq/client` SDK | `lib/notion.ts` | GET/PATCH | Consulta y actualización de tareas IT | `NOTION_TOKEN`, `NOTION_DB_ID` |
| **Bible API** | `bible-api.com/api?random=verse&translation=rv1960` | `app/api/cron/morning-summary/route.ts` | GET | Versículo diario para morning summary | — |
| **Axiom** | Via `@axiomhq/js` SDK | `lib/logger.ts` | POST | Logging centralizado | `AXIOM_TOKEN`, `AXIOM_DATASET` |

---

## 8. Cron Jobs, Workers y Tareas Automáticas

### Crons configurados en `vercel.json` (5)

| Job | Ruta | Schedule (UTC) | Hora Uruguay | Qué ejecuta |
|---|---|---|---|---|
| sleep-sync | `/api/cron/sleep-sync` | `0 8 * * *` | 5:00 AM | Sync Garmin → SleepLog (últimos 2 días) |
| sleep-notifications | `/api/cron/sleep-notifications` | `0 22 * * *` | 7:00 PM | Recordatorio bedtime por WhatsApp |
| fitness-sync | `/api/cron/fitness-sync` | `0 6 * * *` | 3:00 AM | Sync Garmin actividades → Workout |
| fitness-habits | `/api/cron/fitness-habits` | `10 7 * * *` | 4:10 AM | Check smart habits; si desvío → sugerir slot Calendar vía WhatsApp |
| morning-summary | `/api/cron/morning-summary` | `30 10 * * *` | 7:30 AM | Resumen matutino completo por WhatsApp |

### Crons externos en cron-job.org (2, no en vercel.json)

| Job | Ruta | Frecuencia | Qué ejecuta |
|---|---|---|---|
| sleep-notifications | `/api/cron/sleep-notifications?secret=...` | Cada 30min de 20–23hs | Reemplaza el cron diario de Vercel |
| water-reminder | `/api/cron/water-reminder?secret=...` | 12:00 y 17:00 UTC | Recordatorio de hidratación |

### Rutas sin cron activo (en código pero no en vercel.json)

- `/api/cron/reminders` — envía reminders de la tabla `Reminder`. **No está en vercel.json ni en cron-job.org**. Requiere configuración.

### Riesgos de los crons

- Vercel Hobby Plan: **1 ejecución/día** por cron. Por eso los crons frecuentes se externalizan a cron-job.org.
- `fitness-habits` usa `sendTextMessage` directamente (sin pasar por el orquestrador). Riesgo: si el usuario tiene un pending transaction activo, esa notificación puede confundirlo.
- Todos los endpoints cron usan `verifyCronSecret` de `lib/cron.ts` que acepta el secret en 3 formatos (header Bearer, header custom, query param). El query param `?secret=` expone el secret en logs de red.

---

## 9. Webhooks

### WhatsApp Webhook (`/api/whatsapp/webhook`)

| Campo | Detalle |
|---|---|
| **Ruta** | `POST /api/whatsapp/webhook` |
| **Servicio** | Meta Graph API (WhatsApp Business) |
| **Evento** | `messages` (texto, audio, imagen) |
| **Verificación challenge** | `GET /api/whatsapp/webhook` — compara `hub.verify_token` con `WEBHOOK_VERIFY_TOKEN` |

**Pipeline de procesamiento:**
1. Parsea payload con `parseIncomingWebhook`
2. Responde `200 OK` inmediatamente (Meta exige respuesta en <20s)
3. Ejecuta la lógica pesada con `after()` (Next.js 15, evita timeout Vercel)
4. `markAsRead` → resolver userId → transcribir audio si aplica → guardar INBOUND en DB → `orchestrate()` → enviar respuesta → guardar OUTBOUND → marcar PROCESSED

**Riesgos de seguridad:**
- El endpoint está en la lista blanca del middleware (sin NextAuth). La única protección es la verificación de `hub.verify_token` en el GET. **El POST no valida firma HMAC** (`X-Hub-Signature-256`). Un atacante que conozca la URL puede inyectar mensajes falsos.
- El endpoint está expuesto públicamente en producción.

---

## 10. Autenticación y Permisos

### Login
- Google OAuth únicamente (no hay usuario/contraseña)
- Flujo manejado por NextAuth v5 con `PrismaAdapter`
- Whitelist de emails: variable `ALLOWED_EMAILS` (lista separada por comas)

### Sesiones
- Estrategia JWT (stateless)
- `session.user.id` inyectado desde el JWT callback
- Refresh tokens de Google guardados en tabla `accounts` por `PrismaAdapter`

### Scopes de Google
- `openid`, `email`, `profile`
- `https://www.googleapis.com/auth/calendar.readonly`
- `https://www.googleapis.com/auth/calendar.events`
- `access_type: "offline"` + `prompt: "consent"` garantizan refresh token

### Middleware (`middleware.ts`)
- Edge Runtime (sin Prisma) — usa `auth.config.ts`
- **Rutas públicas** (bypass auth): `/login`, `/api/auth/*`, `/api/webhooks/*`, `/api/whatsapp/webhook`, `/api/cron/*`
- Redirige no autenticados → `/login`
- Redirige autenticados en `/login` → `/`

### Roles / Permisos
- **No hay sistema de roles.** La app es mono-usuario. La protección es la whitelist `ALLOWED_EMAILS`.
- Las API routes no verifican explícitamente que los datos pertenezcan al usuario autenticado en todos los casos — confían en que `session.user.id` identifica al único usuario permitido.

---

## 11. Base de Datos y Modelos

### Tipo y cliente
- **PostgreSQL** en Supabase
- **ORM:** Prisma 5 (Client generado en `node_modules/.prisma/client`)
- Singleton pattern en `lib/db.ts` con cache global en desarrollo (`global.__prisma`)
- Connection pooling: `DATABASE_URL` usa el pooler de Supabase (puerto 6543)
- Direct URL: `DIRECT_URL` para migraciones (puerto 5432)

### Modelos (18 total)

#### Auth
| Modelo | Descripción | Relaciones |
|---|---|---|
| `User` | Usuario principal (NextAuth) | 1:N con todo |
| `Account` | OAuth accounts (tokens Google) | N:1 User |
| `Session` | Sesiones JWT persistidas | N:1 User |
| `VerificationToken` | Tokens de verificación email | — |

#### Módulos de salud/actividad
| Modelo | Campos clave | Notas |
|---|---|---|
| `SleepLog` | `date`, `bedTime`, `wakeTime`, `duration`, `quality`, campos Garmin (`garminSleepId`, `deepSleep`, `remSleep`, `spo2Avg`, `bodyBatteryChange`, `garminRawData`) | Unique: userId+date |
| `Workout` | `type` (enum), `date`, `duration`, `caloriesBurned`, `distance`, `garminActivityId`, `source` | 1:N WorkoutExercise |
| `WorkoutExercise` | `name`, `order` | 1:N WorkoutSet |
| `WorkoutSet` | `setNumber`, `reps`, `weight` | — |
| `GymRoutine` | `name`, `isActive` | 1:N GymRoutineExercise |
| `GymRoutineExercise` | `name`, `defaultSets`, `defaultReps`, `defaultWeight`, `order` | — |
| `Meal` | `type` (enum), `description`, `calories`, `protein`, `carbs`, `fats`, `date` | — |
| `WaterLog` | `amount` (ml), `date` | — |
| `UserDiet` | `content` (texto libre), `updatedAt` | Unique: userId |

#### Organización
| Modelo | Campos clave | Notas |
|---|---|---|
| `Project` | `title`, `status` (enum), `deadline`, `order`, `color`, `notionId` | notionId unique |
| `ProjectTask` | `title`, `done`, `order`, `notionId` | notionId unique |
| `Idea` | `rawText`, `cleanedText`, `category`, `tags` (String[]), `priority` (1-5), `status` (enum) | — |

#### Scoring y configuración
| Modelo | Campos clave |
|---|---|
| `DailyScore` | `sleepScore`, `fitnessScore`, `nutritionScore`, `projectsScore`, `financesScore`, `globalScore`, `details` (Json) |
| `UserGoals` | Targets por módulo + pesos Float (0.0-1.0) para scoring ponderado |
| `UserSettings` | `whatsappNumber`, `garminConnected`, `notionToken`, `notionDbId`, `financesApiKey`, `morningBriefEnabled` |
| `UserHabit` | `key`, `value`, `module` — hábitos inteligentes configurables |

#### WhatsApp / Mensajería
| Modelo | Campos clave |
|---|---|
| `ConversationMemory` | `turns` (Json), `summary`, `lastInteraction` — rolling window K=8 |
| `PendingTransaction` | `data` (Json), `step` (`select_card`/`confirm`), `expiresAt` |
| `Reminder` | `title`, `triggerAt`, `sent`, `eventId`, `calendarSynced` |
| `WhatsAppMessage` | `direction` (INBOUND/OUTBOUND), `content`, `status` (PENDING/PROCESSED/FAILED), `waMessageId` |

### Queries críticas
- `DailyScore` + scoring: `upsert` por userId+date para no duplicar scores del día
- `SleepLog` + Garmin sync: `upsert` por `garminSleepId` para idempotencia
- `Project.reorderProjects`: usa transacción Prisma para garantizar atomicidad
- `ConversationMemory`: campo `turns` (JSONB) actualizado con cada turno de WhatsApp

---

## 12. Componentes Principales

### Layout (`components/layout/`)
| Componente | Descripción |
|---|---|
| `AppLayout` | Shell principal: Sidebar (desktop) + Header + BottomNav (mobile) + children |
| `Sidebar` | Navegación lateral fija (desktop md+). Links a los 8 módulos + logout |
| `Header` | Top bar: título de página, ThemeToggle, avatar de usuario |
| `BottomNav` | Barra inferior iOS (5 ítems). Usa `env(safe-area-inset-bottom)` para iPhone |

### Dashboard (`components/dashboard/`)
| Componente | Props | Descripción |
|---|---|---|
| `ModuleSummaryCard` | `module`, `score`, `summary`, `icon` | Card del bento grid. Expandible, muestra desglose de score |

### Scoring (`components/scoring/`)
| Componente | Descripción |
|---|---|
| `GlobalScoreRing` | SVG animado con el score global /100. Gradient según score |
| `ScoreCardModule` | Card de módulo con met/missed items. Expandible |
| `ScoreTrendChart` | Recharts LineChart de tendencia histórica |
| `ScoringDashboard` | Vista completa: ring + stats + toggle de módulos + gráfico |

### Sleep (`components/sleep/`)
| Componente | Descripción |
|---|---|
| `SleepModuleClient` | Wrapper principal (client). Tabs: Hoy / Stats / Historial |
| `SleepTodayCard` | Duración + fases + SpO2 + Body Battery |
| `SleepDurationChart` | BarChart Recharts (7 días) |
| `SleepQualityChart` | ComposedChart (14 días) |
| `SleepTimingChart` | Barras flotantes de hora de acostarse/levantarse (7 días) |
| `TimeWheelPicker` | Picker circular estilo reloj para seleccionar horas |
| `RetroSleepLogger` | Logger manual retro-style |

### Projects (`components/projects/`)
| Componente | Descripción |
|---|---|
| `KanbanBoard` | Drag & drop con `@hello-pangea/dnd`. **Cargado con `dynamic({ ssr: false })`** |
| `ProjectCard` | Card individual de proyecto con color, status badge, progress bar |
| `ProjectDetail` | Modal de edición inline + CRUD de tareas |
| `TimelineView` | Vista timeline de proyectos con fechas de deadline |

### Finances (`components/finances/`)
| Componente | Descripción |
|---|---|
| `FinancesModuleClient` | Dashboard completo. Subcomponentes internos: `DonutChart` (CSS conic-gradient), `DailyEvolution` (SVG área), `Last6Months` (barras), `CardExpenses`, `TopCategories`, `TransactionRow` |

### Settings (`components/settings/`)
| Componente | Descripción |
|---|---|
| `SettingsClient` | 7 secciones colapsables: Perfil · Hábitos · Notificaciones · WhatsApp · Apariencia · Notion · Calendar · Finanzas · Danger Zone |

---

## 13. Estado Global y Manejo de Datos

La app **no usa Redux, Zustand, React Query ni SWR**. El manejo de estado es:

| Mecanismo | Uso |
|---|---|
| **React Server Components (RSC)** | Carga inicial de datos en cada página. `Promise.all` / `Promise.allSettled` para queries paralelas |
| **`useState` + `useEffect`** | Estado local en Client Components. Cada módulo tiene su `*ModuleClient.tsx` con estado local |
| **Optimistic updates** | Algunos módulos (Ideas, Sleep, Fitness) actualizan la UI antes de confirmar con la API |
| **`next-themes` ThemeProvider** | Estado global de tema (dark/light). Context API de React internamente |
| **Props drilling** | Datos del servidor se pasan como props iniciales a los Client Components |

**No hay caché de datos en cliente.** Cada navegación a una página Server Component hace un nuevo fetch a la DB.

---

## 14. Variables de Entorno

| Variable | Archivo(s) donde se usa | Propósito | ¿Obligatoria? |
|---|---|---|---|
| `DATABASE_URL` | `prisma/schema.prisma` | URL de conexión Supabase (pooler, puerto 6543) | ✅ Sí |
| `DIRECT_URL` | `prisma/schema.prisma` | URL directa Supabase (migraciones, puerto 5432) | ✅ Sí |
| `AUTH_SECRET` | `auth.ts` | Secreto para firmar JWT NextAuth | ✅ Sí |
| `AUTH_URL` | `auth.ts` | URL base de la app (para callbacks OAuth) | ✅ Sí |
| `AUTH_GOOGLE_ID` | `auth.config.ts` | Client ID de Google OAuth | ✅ Sí |
| `AUTH_GOOGLE_SECRET` | `auth.config.ts` | Client Secret de Google OAuth | ✅ Sí |
| `ALLOWED_EMAILS` | `auth.config.ts` | Whitelist de emails (separados por coma) | ✅ Sí |
| `ANTHROPIC_API_KEY` | `lib/orchestrator.ts`, `lib/nlp.ts`, `lib/fitness.ts`, `lib/nutrition.ts`, `lib/ideas.ts`, `lib/conversation.ts`, `lib/reminders.ts`, `agents/*` | Acceso a Claude API | ✅ Sí |
| `OPENAI_API_KEY` | `lib/whatsapp.ts` | Transcripción de audio con Whisper | ✅ Sí (si se usan audios de WhatsApp) |
| `WHATSAPP_TOKEN` | `lib/whatsapp.ts` | Bearer token Meta Graph API | ✅ Sí (para WhatsApp) |
| `WHATSAPP_PHONE_ID` | `lib/whatsapp.ts` | Phone Number ID de Meta | ✅ Sí |
| `WHATSAPP_WABA_ID` | `lib/whatsapp.ts` | WhatsApp Business Account ID | ✅ Sí |
| `WEBHOOK_VERIFY_TOKEN` | `app/api/whatsapp/webhook/route.ts` | Token de verificación del webhook Meta | ✅ Sí |
| `GARMIN_EMAIL` | `lib/garmin.ts` | Email de la cuenta Garmin | ⚠️ Requerida para sync Garmin |
| `GARMIN_PASSWORD` | `lib/garmin.ts` | Contraseña Garmin (plaintext) | ⚠️ Requerida para sync Garmin |
| `CRON_SECRET` | `lib/cron.ts` | Protege los endpoints de cron | ✅ Sí |
| `GOOGLE_CALENDAR_ID` | `lib/calendar.ts` | ID del calendario (default: "primary") | ⚠️ Opcional (default: primary) |
| `NOTION_TOKEN` | `lib/notion.ts` | Token de integración Notion (fallback global) | ⚠️ Opcional (se configura por usuario en Settings) |
| `NOTION_DB_ID` | `lib/notion.ts` | ID de la base de datos Notion (fallback) | ⚠️ Opcional |
| `LUMINA_API_URL` | `lib/ideas.ts` | URL de la app Lumina | ⚠️ Opcional (ideas reemplaza Lumina) |
| `LUMINA_API_KEY` | `lib/ideas.ts` | API key de Lumina | ⚠️ Opcional |
| `AXIOM_TOKEN` | `lib/logger.ts` | Token de autenticación Axiom | ⚠️ Opcional (fallback a console) |
| `AXIOM_DATASET` | `lib/logger.ts` | Dataset de Axiom donde se loguea | ⚠️ Opcional |
| `FINANCES_APP_URL` | `lib/finances.ts` | URL base de la app de finanzas | ⚠️ Opcional (default: `https://finanzas-lemon.vercel.app`) |
| `FINANCES_API_KEY` | `lib/finances.ts` | API key finanzas (fallback global) | ⚠️ Opcional (se configura por usuario en Settings) |

---

## 15. Scripts y Comandos del Proyecto

```json
"scripts": {
  "dev":          "next dev",
  "build":        "prisma generate && next build",
  "start":        "next start",
  "lint":         "next lint",
  "db:generate":  "prisma generate",
  "db:push":      "prisma db push",
  "db:migrate":   "prisma migrate dev",
  "db:studio":    "prisma studio"
}
```

| Comando | Uso |
|---|---|
| `npm run dev` | Desarrollo local con hot-reload |
| `npm run build` | Compila para producción (genera Prisma client + build Next.js) |
| `npm run start` | Servidor de producción |
| `npm run lint` | ESLint sobre el código |
| `npm run db:generate` | Regenera el cliente Prisma después de cambiar el schema |
| `npm run db:push` | Aplica el schema a la DB sin migración (desarrollo) |
| `npm run db:migrate` | Crea y aplica una migración Prisma (producción) |
| `npm run db:studio` | Abre Prisma Studio en el browser |

**Nota:** No hay `test` script configurado. No hay suite de tests.

---

## 16. Flujo General del Sistema

### Flujo Web (usuario en el browser)

```
1. Usuario abre la app en el browser
2. middleware.ts (Edge) verifica sesión JWT
3. Si no autenticado → /login → Google OAuth → NextAuth callback → JWT guardado
4. Página Server Component carga datos: Promise.all([db.sleepLog.findFirst(), db.dailyScore.findUnique(), ...])
5. Props iniciales pasan al Client Component (hidratación)
6. Usuario interactúa → fetch() a una API route
7. API route verifica sesión → llama al módulo lib/ correspondiente
8. lib/ módulo consulta DB con Prisma y/o llama API externa
9. Respuesta JSON → UI actualiza estado local
```

### Flujo WhatsApp (mensaje entrante)

```
1. Usuario envía mensaje de WhatsApp
2. Meta llama a POST /api/whatsapp/webhook
3. Webhook devuelve 200 OK inmediatamente
4. after() ejecuta processIncomingMessage():
   a. parseIncomingWebhook → extrae tipo (texto/audio) y contenido
   b. markAsRead → marca leído en Meta
   c. Resolver userId por whatsappNumber en UserSettings
   d. Si audio → downloadAudio() → transcribeAudio() (Whisper)
   e. Guardar mensaje INBOUND en DB
   f. orchestrate(userId, texto):
      i.  getPending() → si hay pending de finanzas → financesAgent.handleConfirmation() → return
      ii. Cargar ConversationMemory + UserGoals en paralelo
      iii. addTurn(userId, 'user', texto) async
      iv. Claude Haiku clasifica el módulo (sleep/fitness/nutrition/...)
      v.  Agente especialista procesa la intención → retorna datos crudos
      vi. Claude Sonnet genera respuesta final con contexto + objetivos
      vii. addTurn(userId, 'assistant', respuesta) async
   g. sendTextMessage(userId, respuesta) → Meta Graph API
   h. Guardar OUTBOUND en DB
   i. Marcar INBOUND como PROCESSED
```

### Flujo Cron (Morning Summary)

```
1. Vercel ejecuta GET /api/cron/morning-summary a las 10:30 UTC
2. verifyCronSecret → valida header
3. Resolver userId por ALLOWED_EMAIL → UserSettings.whatsappNumber
4. Promise.allSettled([
     scoringAgent.getSummaryText(yesterday),
     sleepAgent.getSleepSummaryText(),
     getNutritionSummaryText(yesterday),
     calendarAgent.getTodayEventsText(),
     synthesisAgent.getDailyInsight(),
     fetchBibleVerse()
   ])
5. Ensamblar mensaje WhatsApp
6. sendTextMessage() → Meta Graph API → usuario recibe el summary
```

---

## 17. Mapa de Archivos Críticos

| Archivo | Por qué es crítico |
|---|---|
| `prisma/schema.prisma` | Define la estructura completa de la DB. Cualquier cambio aquí requiere migración |
| `auth.config.ts` | Controla quién puede acceder a la app (whitelist). Error aquí = acceso bloqueado o abierto |
| `middleware.ts` | Protege todas las rutas. Error aquí = app sin autenticación |
| `lib/orchestrator.ts` | Corazón de HERMES. Cualquier bug aquí rompe todas las respuestas de WhatsApp |
| `lib/scoring.ts` | Motor de scoring. Cambios aquí afectan el score global de todos los módulos |
| `lib/calendar.ts` | Manejo de tokens de Google. Si el refresh falla, el calendario deja de funcionar |
| `lib/garmin.ts` | Autenticación SSO no oficial con Garmin. Muy frágil ante cambios de Garmin |
| `app/api/whatsapp/webhook/route.ts` | Punto de entrada de todos los mensajes WhatsApp |
| `app/api/cron/morning-summary/route.ts` | Único punto de ensamblado del daily summary |
| `lib/db.ts` | Singleton Prisma. Error aquí = sin acceso a la DB |
| `lib/conversation.ts` | Memoria conversacional. Si se rompe, HERMES pierde contexto entre mensajes |
| `vercel.json` | Define qué crons se ejecutan. Error aquí = crons inactivos |
| `.env.local` | Todas las credenciales. Pérdida = app no funciona |

---

## 18. Riesgos Técnicos Detectados

### 🔴 Urgente

| # | Riesgo | Archivo | Descripción |
|---|---|---|---|
| R1 | **Webhook sin verificación de firma HMAC** | `app/api/whatsapp/webhook/route.ts` | El POST no valida `X-Hub-Signature-256`. Cualquier actor malicioso que conozca la URL puede inyectar mensajes falsos que activen el orquestador, gasten tokens de Claude y creen registros espurios en la DB. |
| R2 | **Credenciales en `.env.local.example`** | `.env.local.example` | El archivo contiene valores reales de `DATABASE_URL` y `DIRECT_URL` con contraseña visible. Si el repositorio es (o fue) público, las credenciales están expuestas. Rotar inmediatamente si el repo es público. |
| R3 | **Contraseña Garmin en plaintext** | `lib/garmin.ts`, `.env.local` | `GARMIN_PASSWORD` se guarda como variable de entorno en texto plano. No hay encriptación. Si Vercel o el repositorio es comprometido, la contraseña queda expuesta. |
| R4 | **API routes de cron expuestas sin HTTPS-only** | `lib/cron.ts` | El secret de cron también puede pasarse como query param (`?secret=X`), lo que lo expone en logs de acceso de Vercel/CDN. Usar exclusivamente headers. |

### 🟡 Importante

| # | Riesgo | Archivo | Descripción |
|---|---|---|---|
| R5 | **Garmin SSO no oficial** | `lib/garmin.ts` | Garmin no tiene API pública para sincronización de sueño. El flujo SSO simula un browser usando cookies. Garmin puede bloquearlo en cualquier momento sin previo aviso. |
| R6 | **Sin manejo de rate limits en Claude API** | `lib/orchestrator.ts`, `lib/nlp.ts` | Si hay muchos mensajes simultáneos o errores en cascada, no hay backoff ni retry. Las excepciones se propagan y el usuario recibe un error silencioso. |
| R7 | **Sin tests automatizados** | Todo el proyecto | No hay `test` script en `package.json`. Cero cobertura. Cualquier refactor puede romper lógica crítica sin saberlo. |
| R8 | **`after()` en Vercel Hobby puede ser unreliable** | `app/api/whatsapp/webhook/route.ts` | `after()` es una API de Next.js 15 que ejecuta código después del response. En Vercel Hobby con límites de tiempo de ejecución cortos, el proceso puede ser matado antes de que termine `processIncomingMessage`. |
| R9 | **PendingTransaction sin cleanup** | `lib/pending-transaction.ts` | Los registros `PendingTransaction` tienen `expiresAt` pero no hay un cron que limpie los expirados. La tabla puede acumular registros zombie. Además, es `userId UNIQUE`, por lo que un usuario sólo puede tener 1 pending simultáneo — esto puede causar bloqueos inesperados. |
| R10 | **Agente de recordatorios sin cron activo** | `/api/cron/reminders` | El código de recordatorios existe (`lib/reminders.ts`, `app/api/cron/reminders`) pero no está configurado en `vercel.json` ni en cron-job.org. Los recordatorios creados por usuarios nunca se envían. |

### 🔵 Menor / A monitorear

| # | Riesgo | Descripción |
|---|---|---|
| R11 | **Componentes "dead code" en `/ideas`** | Los archivos `IdeaCaptureForm.tsx`, `IdeaCard.tsx`, `IdeaDetail.tsx`, `IdeasGrid.tsx`, `IdeasStats.tsx`, `TagFilter.tsx` fueron reemplazados por el refactor Lumina-style pero no eliminados. Agregan ruido al codebase. |
| R12 | **`agents/orchestrator/index.ts` es código legacy** | El archivo `agents/orchestrator/index.ts` es un stub con TODOs. La lógica real está en `lib/orchestrator.ts`. Puede confundir a futuros desarrolladores. |
| R13 | **Timezone hardcodeada** | La timezone Uruguay/UTC-3 está asumida en varios lugares (crons, helpers de fecha, orchestrator) sin ser configurable. Si la app se usa en otro huso horario, los datos pueden ser incorrectos. |
| R14 | **Google Calendar tokens en tabla `accounts`** | Si los scopes del Calendar se solicitan y el usuario revoca permisos desde Google, el `refreshGoogleToken` fallará silenciosamente. El Calendar Agent devuelve strings de error que van al orquestrador sin manejo diferenciado. |
| R15 | **`morningBriefEnabled` y `scoringEnabled` en UserSettings** | Estos campos existen en el schema pero no está claro si se respetan en todos los cron jobs. El cron de morning summary no verifica `morningBriefEnabled` antes de enviar. |
| R16 | **Sin paginación en historial de datos** | Algunos endpoints de historial (`/api/sleep/history`, `/api/fitness/workout`) no tienen paginación explícita o límite máximo de registros. A largo plazo pueden devolver payloads muy grandes. |

---

## 19. Recomendaciones de Mejora

### 🔴 Urgente

1. **Implementar verificación de firma HMAC en el webhook de WhatsApp**  
   Agregar validación de `X-Hub-Signature-256` al inicio del handler POST. Meta provee el header con cada request. Costo: ~10 líneas de código, impacto de seguridad alto.

2. **Rotar credenciales expuestas en `.env.local.example`**  
   Revisar el historial de git para verificar si algún commit previo contiene valores reales. Si el repo fue público, rotar `DATABASE_URL`, `DIRECT_URL` y todas las otras keys inmediatamente.

3. **Mover el CRON_SECRET a header solamente**  
   Eliminar el soporte de `?secret=` como query param en `lib/cron.ts`. Usar exclusivamente `Authorization: Bearer` o `x-cron-secret`.

### 🟡 Importante

4. **Agregar cleanup de PendingTransactions expiradas**  
   Agregar al cron `morning-summary` o crear un cron separado que ejecute `prisma.pendingTransaction.deleteMany({ where: { expiresAt: { lt: new Date() } } })`.

5. **Activar el cron de Reminders**  
   Agregar `/api/cron/reminders` a `vercel.json` o a cron-job.org. El feature existe pero nunca se ejecuta.

6. **Agregar manejo de rate limits y retries en llamadas a Claude**  
   Wrappear las llamadas a `api.anthropic.com` con un helper de retry con exponential backoff. Especialmente importante en el webhook que puede recibir ráfagas.

7. **Agregar tests de integración para el orquestrador**  
   Al menos 5-10 tests end-to-end que cubran los flujos principales de WhatsApp (log de sueño, log de comida, consulta de score, flujo de gasto con confirmación). Usar Jest + MSW para mockear APIs externas.

8. **Eliminar dead code de Ideas**  
   Borrar los 6 archivos de componentes de ideas no utilizados: `IdeaCaptureForm.tsx`, `IdeaCard.tsx`, `IdeaDetail.tsx`, `IdeasGrid.tsx`, `IdeasStats.tsx`, `TagFilter.tsx`.

9. **Considerar encriptación de `GARMIN_PASSWORD`**  
   Mientras se siga usando el SSO no oficial, al menos documentar el riesgo. Si Garmin ofrece en el futuro una API OAuth, migrar.

### 🔵 Opcional / Mejoras de calidad

10. **Unificar `agents/orchestrator/index.ts` con `lib/orchestrator.ts`**  
    El archivo `agents/orchestrator/index.ts` es un stub innecesario. Moverlo o limpiarlo.

11. **Agregar un `Timezone` configurable en UserSettings**  
    Actualmente la timezone Uruguay está hardcodeada. Agregar un campo `timezone` en UserSettings con default `America/Montevideo`.

12. **Paginación en endpoints de historial**  
    Agregar `cursor`-based pagination o al menos un `limit` forzado máximo (ej: 100) en los endpoints de historial de sleep, fitness y nutrition.

13. **Verificar `morningBriefEnabled` antes de enviar el summary**  
    El cron de `morning-summary` debería leer `UserSettings.morningBriefEnabled` antes de armar y enviar el mensaje.

14. **Considerar migrar de JWT strategy a Database strategy en NextAuth**  
    La estrategia actual (JWT) es stateless pero hace más difícil la invalidación de sesiones. Si la seguridad es una preocupación, usar `session: { strategy: "database" }` con PrismaAdapter.

15. **Documentar la arquitectura de agentes en un diagrama**  
    El flujo HERMES es complejo. Un diagrama `.mermaid` o `.png` en `/docs` facilitaría el onboarding.

---

## 20. Conclusión

**CLAUDIO** es un sistema bien estructurado, con una arquitectura clara y una separación razonable entre capas (lib → agents → API routes → pages). El código es consistentemente TypeScript y el proyecto demuestra buen nivel técnico en el uso de Next.js 15, Prisma, y la Claude API.

Los mayores fortalezas son:
- La arquitectura de agentes (HERMES) es elegante y extensible
- El uso de `Promise.allSettled` en los crons garantiza resiliencia ante fallos parciales
- La memoria conversacional rolling-window es una solución pragmática y eficiente
- El sistema de scoring modular con pesos configurables es flexible

Los mayores riesgos son:
- La falta de validación HMAC en el webhook de WhatsApp (R1)
- La dependencia de Garmin SSO no oficial (R5)
- La ausencia total de tests (R7)
- El potencial de credenciales expuestas en el historial de git (R2)

**Próximos pasos recomendados (en orden de prioridad):**
1. Implementar validación HMAC en el webhook
2. Auditar el historial de git para detectar credenciales expuestas
3. Activar el cron de recordatorios
4. Agregar cleanup de PendingTransactions
5. Escribir al menos tests básicos para el orquestrador

El estado general de la app es **funcional y en producción**, con una deuda técnica moderada concentrada principalmente en seguridad del webhook y ausencia de tests. Para un proyecto personal mono-usuario, está bien construido y es mantenible.

---

*Generado el 2026-05-23 | Auditoría basada en análisis estático del código fuente*

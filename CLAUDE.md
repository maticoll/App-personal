# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Referencia viva del proyecto. **La fuente de verdad es el código.** El historial detallado de cómo se construyó cada módulo está archivado en `docs/session-history.md` (bloques de sesión 1–11).

---

## Qué es este proyecto

Super-app web personal mobile-first que centraliza el día a día: **sueño, fitness, nutrición, proyectos, ideas y finanzas** en un dashboard, con una capa de IA conversacional por **WhatsApp** (orquestrador HERMES) y un **scoring diario /100**. Visión completa en `BLUEPRINT.md`.

---

## Comandos

```bash
npm run dev          # Servidor de desarrollo (next dev)
npm run build        # prisma generate && next build
npm run start        # Servidor de producción
npm run lint         # ESLint (eslint-config-next)

npm run db:generate  # Regenerar Prisma Client (tras cambiar schema.prisma)
npm run db:push      # Empujar schema a Supabase (suele fallar — ver gotchas)
npm run db:migrate   # Migración (prisma migrate dev)
npm run db:studio    # Prisma Studio
```

- **No hay framework de tests.** Verificación = `npx tsc --noEmit` (0 errores) + `npm run build`.
- **Entorno Windows / PowerShell.**

---

## Stack

Next.js (App Router) + TypeScript · Tailwind (dark + light, mobile-first) · Supabase (PostgreSQL + Prisma) · NextAuth v5 · Vercel · next-pwa · Recharts · lucide-react. IA: **Claude API** vía `fetch` directo (sin SDK). Audio: **Whisper** (OpenAI). Versículo: bible-api.com.

---

## Gotchas críticos

- **`prisma db push` suele fallar por conectividad con Supabase.** Workaround: aplicar el cambio con SQL directo en el **Supabase SQL Editor** (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`), luego `npm run db:generate` local para sincronizar el client. El SQL exacto de cada cambio de schema está en `docs/session-history.md`.
- **Crons divididos por límite de Vercel Hobby (1/día por cron).** Los diarios en `vercel.json`; los más frecuentes en **cron-job.org** con `?secret=` como query param. Todos validan `CRON_SECRET` vía `verifyCronSecret`.
- **Webhook de WhatsApp: 200 inmediato + `after()`.** Meta exige <5s; la lógica pesada corre en `after(() => processIncomingMessage(body))`.
- **Split de auth edge:** `auth.config.ts` (sin Prisma, edge, usado en `middleware.ts`) vs `auth.ts` (con `PrismaAdapter`, server-side). No importar Prisma en `auth.config.ts`.
- **Persistencia de tokens de Google:** el callback `jwt` en `auth.ts` **es `async` y AWAITea** el `updateMany` (sin await, en serverless la promesa se descarta y el refresh_token nuevo no se guarda). Si el refresh da `invalid_grant`, usar el botón **"Reconectar Google Calendar"** en Ajustes (revoca + re-consentimiento). La app OAuth debe estar en **Producción** (Testing expira refresh tokens a los 7 días).
- **Garmin = scraping SSO no oficial (frágil)** en `lib/garmin.ts`: login email/password, CSRF extraído del HTML (`extractCsrfToken`, tolerante a formato). Si Garmin cambia el form, el login se rompe.
- **API de finanzas externa (`finanzas-lemon`)** se consume con `Authorization: Bearer fin_...`. Si devuelve HTML (200) en vez de JSON, el problema está en el middleware de ESA app (no deja pasar el Bearer) — el fix vive en su repo. `financesApiFetch` detecta no-JSON y lanza error claro.
- **Modelos de IA hardcodeados:** clasificación/NLP con `claude-haiku-4-5-20251001`, respuesta final con `claude-sonnet-4-6`.
- **Respuestas verbatim:** un agente puede devolver `data: { verbatim: true }` para que su `message` se envíe sin que Sonnet lo reescriba (ej: "tráeme push A", que necesita formato exacto).
- **Fechas de sueño:** `SleepLog.date` = día de despertar.
- **Timezone: el servidor (Vercel) corre en UTC pero el usuario vive en UY (UTC-3).** Todo cálculo de "día" (hoy/mañana/límites de día) debe usar los helpers de `lib/dates.ts` (`startOfDayUY`, `endOfDayUY`, `uyDateKey`, `atHourUY`) — nunca `setHours(0,0,0,0)`, `toDateString()` ni `toISOString().split("T")[0]` sobre hora del servidor: después de las 21:00 UY el día se corre. Los all-day events de Google traen solo `YYYY-MM-DD` y hay que parsearlos con offset `-03:00`.
- **Acceso restringido:** Google OAuth filtrado por `ALLOWED_EMAILS` en `auth.config.ts`.

---

## Arquitectura — el panorama grande

**1. Capa de datos.** Todo pasa por el singleton `db` en `lib/db.ts`. Schema en `prisma/schema.prisma`, organizado por módulo, cada modelo con `@@map` a snake_case. Relación 1-1 con `User` para config/estado (`UserSettings`, `UserGoals`, `ConversationMemory`, `PendingTransaction`). Pasos diarios de Garmin en `DailySteps` (único por `userId+date`).

**2. Separación lib / agents / app.**

- `lib/` — lógica de negocio por módulo (`sleep`, `fitness`, `nutrition`, `projects`, `ideas`, `finances`, `calendar`, `scoring`) + integraciones (`garmin`, `notion`, `whatsapp`, `reminders`) + infra (`db`, `nlp`, `conversation`, `goals`, `cron`, `logger`, `pending-transaction`).
- `agents/` — capa conversacional WhatsApp. Un directorio por módulo, exportados desde `agents/index.ts`. Cada agente expone `process(input: AgentInput): Promise<AgentOutput>` (tipos en `lib/types.ts`); llaman a `lib/` y devuelven **datos crudos**. `agents/prompts/` arma system prompts según objetivos del usuario.
- `app/` — App Router. Páginas en `app/(app)/<modulo>/page.tsx` (Server Components con carga paralela `Promise.all` → `*ModuleClient.tsx`). API en `app/api/<modulo>/...`. Crons en `app/api/cron/...`.

**3. Orquestrador WhatsApp (HERMES) — `lib/orchestrator.ts`.** Flujo de `orchestrate(userId, text)`: 0. **Bypass de pending:** si hay `PendingTransaction` activa → directo a `financesAgent.handleConfirmation` (sin clasificar).

1.  Carga contexto (`lib/conversation.ts`: rolling window K=8 + summary) + objetivos en paralelo.
2.  **Clasificación con Haiku** → módulo (`MODULE_DESCRIPTIONS`).
3.  El **agente especialista** ejecuta y retorna datos crudos.
4.  **Respuesta final con Sonnet** (voz rioplatense, sin markdown). **Excepción:** si el agente marcó `verbatim`, se envía tal cual (`callSpecialistAgent` devuelve `{text, verbatim}`).
5.  Guarda turnos en `ConversationMemory`.

- Webhook único: `app/api/whatsapp/webhook/route.ts` (transcribe audios con Whisper antes de orquestar).

**4. Scoring — `lib/scoring.ts`.** Cada módulo expone `calc<Modulo>ScoreForDate()`; `calculateFullScore()` combina con pesos de `UserGoals` (normalizados). `null` = sin datos (no promedia) vs `0` = había datos sin cumplir. Ideas NO entra al global. **Fitness:** base 40 + gym 20 + duración 20 + cardio/movimiento 20; el bloque de cardio se cumple con actividad cardio **o** alcanzando la meta de pasos (`UserGoals.fitnessDailyStepsGoal`, default 8000) — los pasos de Garmin cuentan como cardio. Gym solo, sin cardio ni pasos, topa en 80.

**5. NLP compartido — `lib/nlp.ts`.** `detectIntentAI(context, intents, message, systemPrompt?)`: una llamada a Haiku por invocación de agente, devuelve la key del intent.

**Sub-agentes (8):** sueño, fitness, nutrición, proyectos, ideas, finanzas, calendario, scoring + `synthesis` (cross-módulo). Los mensajes proactivos siempre pasan por el orquestrador — los sub-agentes nunca hablan directo con WhatsApp.

---

## Módulos

| Módulo                                        | Ruta         | Estado           |
| --------------------------------------------- | ------------ | ---------------- |
| Dashboard + Scoring                           | `/`          | ✅               |
| Sueño                                         | `/sleep`     | ✅               |
| Fitness (+ workout activo `/fitness/session`) | `/fitness`   | ✅               |
| Nutrición                                     | `/nutrition` | ✅               |
| Proyectos                                     | `/projects`  | ✅               |
| Ideas                                         | `/ideas`     | ✅               |
| Finanzas                                      | `/finances`  | ✅ (API externa) |
| Configuración                                 | `/settings`  | ✅               |

---

## Integraciones externas

WhatsApp Business API · Garmin Connect (sueño, actividad, pasos) · Google Calendar + Gmail · Notion (tareas IT) · App de Finanzas propia (`finanzas-lemon`, API Bearer) · bible-api.com.

> **Apple Health** no es accesible desde web — se usa Garmin Connect como fuente de salud. **Lumina** quedó reemplazada por el módulo de Ideas nativo.

---

## Deploy & infraestructura

- **Vercel** (plan Hobby). URL prod: `app-personal-ten.vercel.app`. Repo: `github.com/maticoll/App-personal` (branch **master**).
- **Meta / WhatsApp:** WABA ID `1291248383180052` · Phone Number ID `1175554135632045` · Número `+59892182606` · token System User permanente · webhook suscripto a `messages`.

**Crons activos:**

| Job                 | Plataforma                             | Horario (UTC)      | Ruta                            |
| ------------------- | -------------------------------------- | ------------------ | ------------------------------- |
| sleep-sync          | Vercel                                 | 8 AM               | `/api/cron/sleep-sync`          |
| sleep-notifications | Vercel + cron-job.org (c/30min 20-23h) | 10 PM              | `/api/cron/sleep-notifications` |
| fitness-sync        | Vercel                                 | 6 AM               | `/api/cron/fitness-sync`        |
| fitness-habits      | Vercel                                 | 7:10 AM            | `/api/cron/fitness-habits`      |
| water-reminder      | cron-job.org                           | 12 PM y 5 PM       | `/api/cron/water-reminder`      |
| reminders           | cron-job.org                           | c/15min            | `/api/cron/reminders`           |
| morning-summary     | Vercel                                 | 10:30 AM (7:30 UY) | `/api/cron/morning-summary`     |

---

## Variables de entorno (`.env.local`)

`DATABASE_URL`, `DIRECT_URL` · `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ALLOWED_EMAILS` · `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` · `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_WABA_ID`, `WEBHOOK_VERIFY_TOKEN` · `CRON_SECRET` · `GARMIN_EMAIL`, `GARMIN_PASSWORD` · `GOOGLE_CALENDAR_ID` · `NOTION_TOKEN`, `NOTION_DB_ID` · `FINANCES_APP_URL`, `FINANCES_API_KEY`. (Notion y finanzas también se configuran por usuario en `UserSettings`.)

---

## Convenciones de código

- **TypeScript estricto, sin JS plano.** Mantener `npx tsc --noEmit` en 0 errores.
- Alias `@/` → raíz del proyecto. Componentes en `/components`, lógica en `/lib`, agentes en `/agents`.
- Agentes reciben/devuelven objetos tipados (`AgentInput`/`AgentOutput`).
- Respuestas de WhatsApp sin markdown (`**`, `_`) — se generan planas o se limpian.
- Nunca hardcodear keys; van en `.env.local`.

---

## Documentos de referencia

- `BLUEPRINT.md` — visión y flujos completos del producto.
- `docs/session-history.md` — historial detallado de construcción (sesiones 1–11, SQL de cada cambio de schema, decisiones).
- `docs/superpowers/specs/` y `docs/superpowers/plans/` — specs y planes de features (ej. workout activo).
- `skills/*.md` — guía por módulo de cómo se construyó cada uno.
- `CRON_SETUP.md` — setup de crons (Vercel + cron-job.org).
- ⚠️ `AGENTS.md` es una copia **desactualizada**; tratar `CLAUDE.md` como fuente de verdad.

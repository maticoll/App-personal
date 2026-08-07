# Auditoría profunda — App personal (2026-08-07)

> Alcance: repo completo (~31.000 LOC, 217 archivos TS/TSX). Read-only, sin cambios de código.
> Método: 7 auditorías paralelas por dimensión (seguridad, integraciones externas, capa conversacional, DB/performance, arquitectura, frontend, costos de IA/observabilidad) + verificación manual de los hallazgos críticos.
> Baseline: `npx tsc --noEmit` → **0 errores**. `npm audit` → **14 vulnerabilidades (2 críticas, 12 altas)**.

Los hallazgos marcados **[V]** los verifiqué yo directamente sobre el código, no sólo el agente.

---

## Resumen ejecutivo

La app está mejor de lo que sugiere el volumen de hallazgos: la remediación de las fases 1–4 del BACKLOG se nota (timezone en `lib/`, HMAC del webhook, `timingSafeEqual` en `CRON_SECRET`, historial fuera del system prompt, claim atómico de pendings). Los caminos que ya se auditaron están bien.

El problema está en lo que **nunca se auditó**: la capa de datos y la de red.

Tres cosas están rotas en producción ahora mismo y ninguna emite un error:

1. **Los dos crons de Garmin no procesan a nadie** — filtran por una columna que la migración a OAuth dejó de escribir. Terminan con `ok: true, users: 0`.
2. **El schema no tiene un solo índice.** Cero. Todas las consultas por `userId + fecha` son sequential scan.
3. **Ningún `fetch` externo tiene timeout y ninguna función declara `maxDuration`.** Un endpoint lento de Garmin/Meta mata la lambda a los 10 s y el mensaje del usuario se pierde en silencio.

La otra clase de riesgo es de **superficie, no de bug**: no hay techo de gasto de IA, no hay rate limit en el webhook, y no hay ninguna métrica de consumo de tokens. Hoy el gasto real es ~US$4/mes, así que el riesgo no es la factura esperada sino que no está acotada por nada.

**Conteo:** 16 críticos · 24 importantes · 15 menores.

---

## Tabla resumen

| #         | Sev | Área        | Hallazgo                                                                   | Archivo clave                                       |
| --------- | --- | ----------- | -------------------------------------------------------------------------- | --------------------------------------------------- |
| C-01      | 🔴  | Datos       | Crons de Garmin filtran por columna muerta → 0 usuarios **[V]**            | `app/api/cron/{fitness,sleep}-sync/route.ts`        |
| C-02      | 🔴  | DB          | Schema sin ningún `@@index` (0 en todo el archivo) **[V]**                 | `prisma/schema.prisma`                              |
| C-03      | 🔴  | Red         | Cero timeouts en 21 fetch externos + cero `maxDuration` **[V]**            | `lib/claude.ts`, `lib/garmin.ts`, `lib/whatsapp.ts` |
| C-04      | 🔴  | Seguridad   | `ALLOWED_EMAILS` no se revalida post-login; sesión de 30 días **[V]**      | `auth.ts:20`                                        |
| C-05      | 🔴  | Seguridad   | `PATCH /api/settings` devuelve la fila entera con todos los tokens **[V]** | `app/api/settings/route.ts:128`                     |
| C-06      | 🔴  | Seguridad   | `whatsappNumber` sin `@unique` y fijable por PATCH **[V]**                 | `prisma/schema.prisma:604`                          |
| C-07      | 🔴  | Producto    | `/scoring` sirve datos **inventados** cuando no hay historial **[V]**      | `app/(app)/scoring/page.tsx:31`                     |
| C-08      | 🔴  | Producto    | Cron `fitness-habits` no está en `vercel.json`: nunca corre **[V]**        | `vercel.json`                                       |
| C-09      | 🔴  | Frontend    | Ningún `error.tsx`/`global-error.tsx`: pantalla en blanco **[V]**          | `app/**`                                            |
| C-10      | 🔴  | Frontend    | Modo claro roto: `dark` hardcodeado, toggle muerto **[V]**                 | `app/layout.tsx:37`                                 |
| C-11      | 🔴  | PWA         | Service worker cachea `/api/*` 24 h → datos de ayer sin aviso              | `next.config.ts:69`                                 |
| C-12      | 🔴  | Estado      | `savePending` no refresca `createdAt`: el TTL mata flujos vivos **[V]**    | `lib/pending-transaction.ts:69`                     |
| C-13      | 🔴  | Estado      | Vapes y finanzas comparten la única fila de pending por usuario            | `lib/pending-vape.ts:63`                            |
| C-14      | 🔴  | Estado      | `addTurns` es read-modify-write sin transacción                            | `lib/conversation.ts:76`                            |
| C-15      | 🔴  | Perf        | Dashboard: ~19 queries + 1 fetch externo + 1 write por request             | `app/(app)/page.tsx:66`                             |
| C-16      | 🔴  | Costos      | Cero rate limit / techo de gasto en el webhook **[V]**                     | `app/api/whatsapp/webhook/route.ts:70`              |
| I-01      | 🟠  | Perf        | `recalculateWeek`: ~133 queries paralelas + 7 fetch redundantes            | `agents/scoring/index.ts:111`                       |
| I-02      | 🟠  | Perf        | N+1: `getWeeklyStats` hace 7 queries secuenciales                          | `lib/fitness.ts:279`                                |
| I-03      | 🟠  | Perf        | N+1: `syncNotionToProjects`, 2 queries por tarea                           | `lib/notion.ts:285`                                 |
| I-04      | 🟠  | Perf        | N+1: upsert secuencial por actividad de Garmin                             | `app/api/cron/fitness-sync/route.ts:36`             |
| I-05      | 🟠  | Perf        | `getExerciseBests` trae todo el historial de gym sin `take`                | `lib/fitness.ts:906`                                |
| I-06      | 🟠  | Perf        | 47 de 52 `findMany` sin `take` sobre tablas append-only                    | varios                                              |
| I-07      | 🟠  | Perf        | Sumas/promedios en JS que deberían ser `aggregate`/`count`                 | `lib/scoring.ts:461`                                |
| I-08      | 🟠  | DB          | `Float` para dinero (error de redondeo cambia el score)                    | `prisma/schema.prisma:516`                          |
| I-09      | 🟠  | DB          | Sin migraciones reales: todo SQL manual, drift no detectable               | `prisma/migrations/`                                |
| I-10      | 🟠  | Perf        | Ningún Server Component define estrategia de caché                         | `app/(app)/**`                                      |
| I-11      | 🟠  | Seguridad   | `garmin-session` fuera del middleware, escribe tokens por email            | `app/api/fitness/garmin-session/route.ts:40`        |
| I-12      | 🟠  | Privacidad  | Conversaciones completas + teléfono persistidos en Axiom                   | `app/api/whatsapp/webhook/route.ts:210`             |
| I-13      | 🟠  | Costos      | 3 llamadas a Claude por mensaje (2 clasificaciones consecutivas)           | `lib/orchestrator.ts:106`                           |
| I-14      | 🟠  | Costos      | Sonnet reescribe confirmaciones triviales (~75 % del costo/msg)            | `lib/orchestrator.ts:537`                           |
| I-15      | 🟠  | Costos      | Whisper sin límite de tamaño: un audio de 30 min = US$0.18                 | `lib/whatsapp.ts:356`                               |
| I-16      | 🟠  | Costos      | Cero telemetría de tokens: `usage` se descarta **[V]**                     | `lib/claude.ts:64`                                  |
| I-17      | 🟠  | Robustez    | Retry de Claude sin jitter, reintenta POST ciegamente                      | `lib/claude.ts:86`                                  |
| I-18      | 🟠  | Robustez    | `morning-summary` sin dedup: reintento = mensaje duplicado                 | `app/api/cron/morning-summary/route.ts:256`         |
| I-19      | 🟠  | Robustez    | `sendTypingIndicator` es promesa flotante en `after()`                     | `app/api/whatsapp/webhook/route.ts:102`             |
| I-20      | 🟠  | Correctitud | `extractTime` sin validar rango: "a las 45" corre 2 días                   | `agents/sleep/index.ts:373`                         |
| I-21      | 🟠  | Correctitud | Clasificador usa `startsWith`: intent truncado → módulo erróneo            | `lib/orchestrator.ts:132`, `lib/nlp.ts:58`          |
| I-22      | 🟠  | Frontend    | Doble submit por Enter en nutrición y proyectos                            | `components/nutrition/NutritionQuickActions.tsx:77` |
| I-23      | 🟠  | Frontend    | Fallos silenciosos: "guardado ✓" sin mirar `res.ok`                        | `components/settings/SettingsClient.tsx:278`        |
| I-24      | 🟠  | Frontend    | Mutaciones no invalidan el Router Cache                                    | `components/**ModuleClient.tsx`                     |
| M-01…M-15 | 🟡  | varios      | Ver sección Menores                                                        |                                                     |

---

## 🔴 Críticos

### C-01 — Los crons de Garmin filtran por una columna que ya nadie escribe: procesan **cero** usuarios **[V]**

```ts
// app/api/cron/fitness-sync/route.ts:30
where: { garminSessionKey: { not: null } },
// app/api/cron/sleep-sync/route.ts:33
where: { garminSessionKey: { not: null }, garminSessionExp: { gt: new Date() } },
```

Verificado con grep: `garminSessionKey` aparece **5 veces en todo el repo y en ninguna se escribe** — sólo lecturas en los dos crons y en `/api/settings`. La auth de Garmin migró a OAuth 1.0a: `saveGarminOAuth` (`lib/garmin.ts:269`) escribe únicamente `garminOauth1Token`/`garminOauth1Secret`/`garminOauth2Token`.

**Impacto.** `sleep-sync` (11:00 UTC) y `fitness-sync` (06:00 UTC) terminan con `{ ok: true, users: 0 }` — éxito aparente. El sueño y las actividades sólo entran cuando el usuario escribe "sync" a mano por WhatsApp. Como los pasos alimentan el bloque de cardio del scoring, el score diario se degrada sin ninguna señal.

**Fix.** Cambiar el filtro a `{ garminOauth1Token: { not: null } }` en ambos. Y agregar `logger.warn` cuando `users.length === 0` — un match vacío nunca debería pasar por éxito.

---

### C-02 — El schema no tiene **ni un solo** índice **[V]**

`grep -c "@@index" prisma/schema.prisma` → **0**. Los únicos índices existentes son los que Postgres crea por `@@unique` (`SleepLog`, `DailyScore`, `DailySteps`, `Reminder`).

Prisma **no** crea índices sobre foreign keys en PostgreSQL. Las consultas más calientes son todas seq-scan:

| Modelo                           | Query real                                         | Índice faltante                                                      |
| -------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------- |
| `Workout`                        | `lib/scoring.ts:260`, `lib/fitness.ts:234,283,906` | `@@index([userId, date])`, `@@index([userId, type, date])`           |
| `Meal`                           | `lib/scoring.ts:424`, `lib/nutrition.ts:81,166`    | `@@index([userId, date])`                                            |
| `WaterLog`                       | `lib/scoring.ts:425`, `lib/nutrition.ts:85,375`    | `@@index([userId, date])`                                            |
| `Reminder`                       | `lib/reminders.ts:62` — **corre cada 15 min**      | `@@index([sent, fireAt])`                                            |
| `WorkoutExercise` / `WorkoutSet` | todos los `include` anidados                       | `@@index([workoutId])` / `@@index([exerciseId])`                     |
| `Idea`                           | `lib/ideas.ts:156,190,449`                         | `@@index([userId, createdAt])`                                       |
| `Project` / `ProjectTask`        | `lib/projects.ts:85`, `lib/scoring.ts:600`         | `@@index([userId, status])`, `@@index([projectId, done, updatedAt])` |
| `WhatsAppMessage`                | append-only, sin lector                            | `@@index([userId, createdAt])`                                       |

**Fix.** Es el arreglo con mejor relación impacto/esfuerzo de toda la auditoría: SQL puro en el SQL Editor de Supabase (recordar el gotcha de `db push`), más el `@@index` en el schema para que no vuelva a driftear.

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS "workouts_userId_date_idx" ON workouts("userId","date");
-- …idem para el resto de la tabla
```

---

### C-03 — Cero timeouts en 21 fetch externos, cero `maxDuration` **[V]**

`grep -rn "AbortSignal\|AbortController" lib/ app/ agents/` → **0**. `grep -rn "maxDuration"` → **0**.

Sin `maxDuration`, todas las funciones corren con el default de Vercel Hobby (**10 s**). Los fetch sin timeout: `lib/claude.ts:54`, `lib/whatsapp.ts` ×7, `lib/garmin.ts:144,238`, `lib/calendar.ts` ×6, `lib/finances.ts:127`, `lib/vapes.ts:39`, bible-api.

**Impacto.** Un socket colgado de Garmin (scraping no oficial, lento por diseño) no falla rápido: consume el presupuesto entero hasta que Vercel mata la lambda con un 504. En el webhook eso significa que el `catch` que marca `INBOUND → FAILED` (`route.ts:266`) **nunca corre** — la lambda muere, no lanza. El usuario escribe "sync", ve "escribiendo…" y no recibe nada nunca. Peor en `lib/claude.ts`: el retry loop puede encadenar 3 intentos colgados, y las llamadas a Claude ya facturadas se pierden.

**Fix.** `signal: AbortSignal.timeout(ms)` en cada fetch — Claude/Whisper 15–20 s, Meta/Google/Garmin 8 s, bible-api 3 s. `export const maxDuration = 60` en los crons y el webhook (Hobby lo permite). En `lib/claude.ts`, además un deadline absoluto para el loop de retries, no sólo por intento.

---

### C-04 — `ALLOWED_EMAILS` no se revalida después del login **[V]**

El filtro se aplica **sólo** en `signIn` (`auth.config.ts:38`). El callback `jwt` de `auth.ts:20` nunca vuelve a mirar el email, y `session:` no define `maxAge`, así que usa el default de NextAuth (**30 días**). El middleware evalúa `isLoggedIn = !!req.auth` — la mera existencia de un JWT.

**Impacto.** `ALLOWED_EMAILS` es el **único** control de acceso de la app. Sacar un email de la lista en Vercel no revoca nada: quien ya tenga la cookie conserva acceso total a finanzas, salud y WhatsApp hasta 30 días. El mecanismo de revocación no revoca.

**Fix.** Chequear `token.email` contra `ALLOWED_EMAILS` dentro del callback `jwt` y devolver `null` si no está. Sumar `session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 }`.

---

### C-05 — `PATCH /api/settings` devuelve la fila completa con todos los tokens **[V]**

```ts
// app/api/settings/route.ts:119-128
const updated = await db.userSettings.upsert({ ... });
return NextResponse.json({ ok: true, settings: updated });
```

El GET del mismo archivo fue escrito con cuidado (`garminConnected: !!settings.garminSessionKey` en vez del valor). El PATCH anula esa decisión: `updated` incluye `garminOauth1Token`, `garminOauth1Secret`, `garminOauth2Token`, `notionToken` y `financesApiKey` en texto plano. Quedan en el cache del navegador y en el service worker de la PWA. Bonus: el GET también filtra `notionToken` crudo (`:55`).

**Fix.** Proyectar la misma forma que devuelve el GET; nunca `updated` crudo. Y en el GET, `notionConfigured: !!settings.notionToken` en vez del token.

---

### C-06 — `whatsappNumber` sin `@unique`, fijable libremente por PATCH **[V]**

`prisma/schema.prisma:604` → `whatsappNumber String?` (sin `@unique`). El PATCH lo acepta del body sin validar formato ni propiedad. El webhook resuelve el usuario con `findFirst` sin `orderBy` (`route.ts:140`).

**Impacto.** Dos usuarios pueden guardar el mismo número y `findFirst` resuelve a uno arbitrario: los mensajes de WhatsApp de uno pueden ejecutarse contra la cuenta del otro (el orquestador escribe en finanzas, sueño, proyectos, ideas). Hoy el blast radius lo acota `ALLOWED_EMAILS` — que es justo lo que C-04 deja sin revocación.

**Fix.** `@unique` en el schema (+ `ALTER TABLE … ADD CONSTRAINT … UNIQUE` en Supabase), normalizar a E.164 en el PATCH, y `findUnique` en el webhook para que la ambigüedad falle ruidosamente.

---

### C-07 — `/scoring` sirve datos **inventados** cuando no hay historial **[V]**

```ts
// app/(app)/scoring/page.tsx:30-33
if (historyData.length === 0) {
  historyData = generateMockHistory(56);
  isMock = true;
}
// app/api/scoring/history/route.ts:59,84 — dos fallbacks automáticos más
```

`generateMockHistory` (`lib/scoring.ts:976`) genera scores pseudoaleatorios. El aviso al usuario es un `<p className="text-xs text-outline">` — el color más tenue de la paleta.

**Impacto.** No es código de demo: está en el camino de producción. Un tramo sin datos (Garmin caído — ver C-01 — o cron fallado) muestra 8 semanas de tendencia fabricada, indistinguible de la real. Para una app cuyo producto central es "un scoring /100 en el que confiás", esto corrompe la métrica.

**Fix.** Borrar los 3 call-sites y devolver `entries: []` con un empty state honesto. Si se quiere conservar para desarrollo, dejarlo sólo detrás de `?mock=true` explícito.

---

### C-08 — El cron `fitness-habits` no está agendado en ningún lado **[V]**

`vercel.json` declara exactamente 4 crons: `sleep-sync`, `sleep-notifications`, `fitness-sync`, `morning-summary`. `fitness-habits` no está. Pero **`CLAUDE.md` y `CRON_SETUP.md:20` afirman los dos que corre en Vercel a las 7:10 AM**.

**Impacto.** Una feature entera (`checkSmartHabitDeviation` en `lib/fitness.ts:439` + `components/fitness/SmartHabitAlert.tsx`) está escrita, deployada y jamás se ejecuta. Nadie lo va a notar porque ambos docs dicen que anda.

**Fix.** Agregar `{"path": "/api/cron/fitness-habits", "schedule": "10 7 * * *"}` a `vercel.json` (cabe en Hobby: es 1×/día) y sincronizar la tabla de `CRON_SETUP.md`, que además omite `morning-summary`.

---

### C-09 — No existe ningún `error.tsx` ni `global-error.tsx` **[V]**

Hay 10 `loading.tsx` y **cero** error boundaries. Combinado con `app/(app)/sleep/page.tsx:22`, la única página de módulo sin `.catch()` inline en su `Promise.all`.

**Impacto.** Un hiccup de Supabase (el gotcha documentado) tira `/sleep`, no hay boundary y en producción Next muestra su página de error sin estilos ni navegación: el usuario queda varado. Lo mismo en cualquier ruta ante un fallo de `auth()` o del render.

**Fix.** `app/(app)/error.tsx` (client, con `reset()` y link a `/`) + `app/global-error.tsx`. Y envolver las 5 promesas de `sleep/page.tsx` en `.catch()` como ya hace `fitness/page.tsx:36`.

---

### C-10 — El modo claro no existe: `dark` hardcodeado y el toggle no hace nada **[V]**

```tsx
// app/layout.tsx:37
<html lang="es" suppressHydrationWarning className="dark">
```

`globals.css:29-56` define un único `:root` con colores oscuros literales y un `body` con background fijo. `grep -rc "dark:" components app` → **0**: no se usa ni una variante `dark:` de Tailwind. Pero `ThemeProvider.tsx:16` tiene `enableSystem` y `Sidebar.tsx:92` muestra el `ThemeToggle`.

**Impacto.** El usuario aprieta el toggle, `next-themes` saca la clase `dark`, y no cambia nada porque todos los colores son literales. `CLAUDE.md` declara "Tailwind (dark + light)" como capacidad del stack; no está implementada.

**Fix.** Decidir y ser consistente. Barato y honesto: sacar `<ThemeToggle />` y poner `forcedTheme="dark"`. Correcto: mover los colores a variables CSS y agregar el bloque `.light`.

---

### C-11 — El service worker cachea `/api/*` durante 24 h

```ts
// next.config.ts:69-78
urlPattern: /\/api\/.*$/i, handler: "NetworkFirst",
expiration: { maxEntries: 16, maxAgeSeconds: 24 * 60 * 60 },
networkTimeoutSeconds: 10,
```

**Impacto.** Con la PWA instalada en el iPhone y señal pobre, `NetworkFirst` espera 10 s y sirve el cache: `/api/sleep/today`, `/api/scoring/today`, `/api/nutrition/today` muestran los datos de **ayer** sin ningún indicador. `maxEntries: 16` sobre todas las rutas hace que la expulsión sea impredecible, así que la mezcla de datos frescos y rancios es no determinista — el peor escenario posible para un tracker diario.

**Fix.** `NetworkOnly` para `/api/` (los datos ya llegan pre-renderizados desde los Server Components), o como mínimo excluir las rutas de "hoy" y bajar `maxAgeSeconds` a ~60.

---

### C-12 — `savePending` no refresca `createdAt`: el TTL puede matar un flujo recién creado **[V]**

```ts
// lib/pending-transaction.ts:69-73
await db.pendingTransaction.upsert({
  where: { userId },
  create: { userId, ...payload },
  update: payload,
});
```

`payload` sólo tiene `data`, `step`, `cards`. `createdAt` es `@default(now())` y el `update` no lo toca. El TTL de 30 min se mide contra ese campo (`:92`).

**Impacto.** El flujo de finanzas hace **dos** `savePending` seguidos (`agents/finances/index.ts:317` y `:366`). Si el usuario tarda en elegir tarjeta, el segundo reescribe `step` pero conserva el `createdAt` viejo: el pending "nace vencido". El bot pregunta "¿Confirmo? (sí/no)", el usuario responde "sí", `getPending` lo borra por TTL y devuelve `null`, y el "sí" cae al clasificador de Haiku. **La transacción se pierde en silencio y el usuario cree que quedó registrada.** Vapes encadena hasta tres `saveVapePending` sobre la misma fila.

**Fix.** Agregar `createdAt: new Date()` al `update` de ambos, o mejor un campo `expiresAt` explícito recalculado en cada escritura del flujo.

---

### C-13 — Vapes y finanzas compiten por la única fila de pending por usuario

`lib/pending-vape.ts:63-75` lee **cualquier** fila de `pending_transactions` del usuario y aplica el TTL **antes** de comprobar `data.kind`. El orquestador llama a `getVapePending` primero (`lib/orchestrator.ts:400`).

**Impacto.** `saveVapePending` escribe en la misma fila UNIQUE por `userId`. Si el usuario tiene un pending de finanzas en `confirm` y manda "vendí 2 menta a 1500", el bypass de finanzas (`orchestrator.ts:431`) intercepta antes de que se alcance el fast-path de vapes (`:480`) y responde "¿Confirmo el registro? Responde si/no". **El usuario queda atrapado sin forma de salir** salvo escribiendo exactamente "no".

**Fix.** Separar el estado de vapes a su propia tabla, o al menos filtrar por `kind` en el `where` y aplicar el TTL sólo tras confirmar propiedad. Y aceptar palabras de escape ("cancelar", "olvidalo", "nada") en el bypass del orquestador.

---

### C-14 — `addTurns` es read-modify-write sin transacción

`lib/conversation.ts:76-132` hace `findUnique`, calcula en memoria, y `update`. Sin transacción ni lock optimista. En `orchestrate` el turno de user y el de assistant se guardan en **dos** llamadas separadas (`orchestrator.ts:513` y `:558`) con toda la latencia de Haiku + agente + Sonnet en el medio.

**Impacto.** Vercel ejecuta invocaciones de `after()` en paralelo. Dos mensajes seguidos (normal en WhatsApp: "me desperté" + "cuánto dormí") hacen que ambas lambdas lean el mismo `recentMessages` y la última pise a la otra: se pierde un par completo user/assistant y `turnCount` se desincroniza. El comentario en `:56-59` resolvió el caso de dos `addTurn` paralelos agrupándolos, pero no el de dos **mensajes** concurrentes, que es el escenario real.

**Fix.** `db.$transaction` con nivel `Serializable`, o columna `version` con update condicional y reintento. La solución de raíz: turnos como filas append-only en su propia tabla.

---

### C-15 — El dashboard recalcula el score completo en cada request: ~19 queries + 1 fetch externo + 1 write

`app/(app)/page.tsx:66-96` — comentario explícito _"El score de HOY se recalcula siempre"_, seguido de `calculateFullScore` + `saveScore`. `calculateFullScore` (`lib/scoring.ts:842`) abre 5 submódulos en `Promise.all` y cada uno su propio `Promise.all`: sleep 2 queries, fitness 4, nutrición 4, proyectos 4, finanzas 1 fetch HTTP externo. Más `getGoals`, el `upsert` de `saveScore`, `loadSummaries` (6 queries), `getThisWeekTasks`, `getAllProjects`, `loadVapesSummary`.

**Impacto.** Cada carga del dashboard son ~19 queries simultáneas contra el pooler de Supabase más un fetch externo que bloquea el render. `getGoals` se consulta 3 veces y `userSettings` 2 por cálculo. Y un Server Component está **escribiendo** en la DB durante el render.

**Fix.** (a) Sacar `saveScore` del render → Server Action o cron. (b) `unstable_cache` con tag por usuario+día y `revalidateTag` en los mutadores. (c) Deduplicar `getGoals`/`userSettings` con `React.cache()` o pasándolos como parámetro.

---

### C-16 — Cero rate limit y cero techo de gasto en el webhook **[V]**

`grep -rni "ratelimit|quota|dailyLimit"` → **0** en todo el repo. `app/api/whatsapp/webhook/route.ts:70` procesa todo mensaje entrante sin contador. `ALLOWED_EMAILS` no aplica acá: el webhook resuelve por `whatsappNumber` (`:140`).

**Impacto.** 3 llamadas a Claude por mensaje (~US$0.007). Un bucle de reenvío o una ráfaga no encuentran freno: 1.000 mensajes en una hora ≈ **US$5.70/hora sostenido**, sin ninguna alarma porque no hay telemetría de tokens (I-16). Y `lib/claude.ts:52` reintenta hasta 3 veces, así que un pico de 429 **triplica** las llamadas justo cuando ya estás saturado.

**Fix.** Contador diario en `UserSettings` chequeado al inicio de `orchestrate()`, con corte suave en ~100 msg/día y respuesta template. Techo garantizado: **US$0.60/día ≈ US$18/mes** absoluto.

---

## 🟠 Importantes

### Performance y base de datos

- **I-01 — `recalculateWeek`: ~133 queries paralelas.** `agents/scoring/index.ts:111` lanza 7 `calculateFullScore` en un `Promise.all` sin límite → 7 × ~19 queries contra el pooler, más 7 fetch a la API de finanzas que devuelven el mismo reporte mensual. Viola la convención de `p-limit ≤ 5` del stack. Con el pooler free (~15 conexiones) esto tira `too many connections`. → `p-limit(2)`, `getGoals` una sola vez fuera del loop, y pasar el `report` de finanzas ya obtenido.
- **I-02 — N+1 en `getWeeklyStats`.** `lib/fitness.ts:279-308` hace 7 `findMany` **secuenciales** (uno por día) en el render de `/fitness`. ~280 ms de puro round-trip, sobre una tabla sin índice. → Una query del rango de 7 días + agrupación en memoria con `uyDateKey`.
- **I-03 — N+1 en `syncNotionToProjects`.** `lib/notion.ts:285-323`: `findUnique` + `update`/`create` por tarea, secuencial. Con 50 tareas son 100 round-trips en serie (~4 s), **en el camino crítico del fast-path "sync" de WhatsApp**. → Un `findMany` con `notionId: { in: [...] }` + upserts bajo `p-limit(5)`.
- **I-04 — N+1 en el sync de Garmin.** `app/api/cron/fitness-sync/route.ts:36-77`: triple bucle anidado con `await upsertWorkoutFromGarmin` dentro, más un `setTimeout(500)` de serialización artificial. Tolerable en el cron nocturno, no en `runGlobalSync` (`lib/orchestrator.ts:282`). → `p-limit(5)`.
- **I-05 — `getExerciseBests` sin techo.** `lib/fitness.ts:906` trae **todo** el historial de gym con `include: { exercises: { include: { sets: true } } }`, sin `take` ni ventana temporal, y filtra en JS después. Un año de gym 4×/semana ≈ 4.800 filas de `WorkoutSet` hidratadas — cada vez que se abre `/fitness/session`. → Acotar a 12 meses y filtrar los ejercicios en el `where` del include; para `maxWeightKg`, un `aggregate` lo resuelve en SQL.
- **I-06 — 47 de 52 `findMany` sin `take`.** Los peores sobre tablas append-only: `getAllIdeas` (`lib/ideas.ts:156`, trae `rawText`+`cleanedText`+`breakdown` de todas las ideas históricas), `getCompletedTasks(period:"all")` (`lib/tasks.ts:145`, sin filtro de fecha), `getAllProjects` (`lib/projects.ts:85`). → `take` defensivo + cursor en los tres.
- **I-07 — Cálculos en JS que deberían ser SQL.** `lib/scoring.ts:461` trae todas las `Meal` del día (con `description`, texto libre) para 3 `reduce`; cinco lugares distintos hacen `waterLogs.reduce(...)`; `lib/scoring.ts:600` hace `findMany({select:{id,title}})` cuando sólo usa `.length`. → `aggregate` / `count` / `groupBy`. El de `scoring.ts:600` es el más simple y está en el hot path del dashboard.
- **I-08 — `Float` para dinero.** `prisma/schema.prisma:516-518` (`financesMonthlyIncome/Target/Budget`) mapea a `DOUBLE PRECISION`. Estos valores alimentan comparaciones de umbral en `calcFinancesScore` (`lib/scoring.ts:753,784`): un `spendRatio` de exactamente `0.9` puede caer del lado equivocado del `<=` por redondeo binario, cambiando el score en 20 puntos. → `Decimal @db.Decimal(12,2)`.
- **I-09 — Sin migraciones reales.** `prisma/migrations/` tiene un solo `.sql` suelto; no hay `migration_lock.toml` ni tabla `_prisma_migrations`. `docs/session-history.md` documenta ≥12 cambios de schema aplicados a mano, uno de ellos (`:689`, `CREATE TABLE pending_transactions`) **sin `IF NOT EXISTS`** y duplicando el de `:529`. No hay forma de verificar que producción coincide con `schema.prisma`. → Baseline formal con `prisma migrate diff --from-empty` + `migrate resolve --applied`. Antes, correr `migrate diff --from-schema-datasource` para medir el drift actual. Borrar `prisma/schema-temp.prisma` (huérfano, 16 KB).
- **I-10 — Ningún Server Component define caché.** Cero `revalidate`/`unstable_cache` en `app/`. Cada navegación entre módulos del PWA re-dispara el `Promise.all` completo, en una app mono-usuario cuyos datos casi no cambian entre requests. → `unstable_cache` con tag por usuario+día en `getWeeklyStats`, `getWorkoutHistory`, `getMealHistory`, `getScoreHistory`.

### Seguridad y privacidad

- **I-11 — `garmin-session` fuera del middleware, escribe tokens por email.** `middleware.ts:26-31` lo excluye; `app/api/fitness/garmin-session/route.ts:40-55` acepta un `email` arbitrario del body cuando se autentica por `CRON_SECRET` — que `lib/cron.ts:34` todavía acepta **por query string**, o sea que viaja en los access logs de Vercel y el historial de cron-job.org. Quien lo obtenga puede inyectar tokens OAuth de Garmin en la cuenta de cualquier usuario. → Exigir sesión o header `x-cron-secret` únicamente en rutas que escriben credenciales; restringir el `email` a `ALLOWED_EMAILS`. Completar la migración pendiente 4.3 del BACKLOG y rotar `CRON_SECRET`.
- **I-12 — Conversaciones completas persistidas en Axiom.** `app/api/whatsapp/webhook/route.ts:210-215` loguea `userMessage` + `agentResponse` íntegros; `:170` la transcripción de audio; `:150` el número de teléfono; `morning-summary:352` el `to` + `userName`. `lib/logger.ts:57` hace spread al payload y lo manda a Axiom **y** a console (→ logs de Vercel). Ese contenido son datos de salud, montos, tarjetas y agenda. → Lista de campos sensibles truncados/hasheados en producción; loguear longitud y módulo en vez del texto.
- **Dependencias — 14 vulnerabilidades, 2 críticas.** `npm audit` reporta en `@auth/core`/`next-auth`: _"Configuration errors can cause existence-based auth checks to fail open"_ — relevante porque `middleware.ts:13` hace exactamente un chequeo de existencia (`!!req.auth`). También 8 altas en la cadena `serialize-javascript → workbox → next-pwa`, que sólo destraba la migración a `@serwist/next` (ítem 4.5 del BACKLOG). → Actualizar `next-auth`/`@auth/core` primero; es el único con impacto directo en el control de acceso.

### Costos de IA y observabilidad

- **I-13 — 3 llamadas a Claude por mensaje.** `classifyModule` (`orchestrator.ts:106`, Haiku) y `detectIntentAI` (`nlp.ts:46`, Haiku) son **dos clasificaciones consecutivas del mismo texto**, cada una reenviando su prompt. ~25 % del costo y ~1–2 s de latencia de puro round-trip. → Fusionar en una llamada que devuelva `{"module":"sleep","intent":"wake"}`. Es el ítem 5.1 del BACKLOG y sigue siendo la mejor optimización disponible.
- **I-14 — Sonnet reescribe confirmaciones triviales.** `orchestrator.ts:537` sólo saltea Sonnet si `verbatim` — que sólo setean fitness e ideas. Registrar una comida ya produce texto listo y aun así pasa por Sonnet a US$3/US$15 por MTok: **~75 % del costo por mensaje** se va en reescribir texto que ya estaba bien. → `verbatim: true` en confirmaciones de nutrición/sueño/agua/finanzas (ítem 5.2), y evaluar Haiku para el resto de la redacción.
- **I-15 — Whisper sin límite de tamaño.** `lib/whatsapp.ts:356` postea el buffer directo. `downloadAudio:231` **ya pide el metadata de Meta que incluye `file_size`** y lo descarta al leer sólo `{ url }`. WhatsApp permite audios de 16 MB (~30 min) = **US$0.18 en una transcripción**, ~30× un mensaje normal, más 16 MB en memoria de la lambda. → Leer `file_size` y rechazar >5 MB. 3 líneas.
- **I-16 — Cero telemetría de tokens.** `lib/claude.ts:64` descarta `data.usage` (que viene en la misma respuesta, ya pagada). `lib/claude.ts` tampoco usa `logger` — sólo `console.warn`, así que ni los errores de la API llegan a Axiom. Sin esto no se puede responder "¿qué módulo me cuesta más?" ni medir el efecto de ninguna optimización. → ~8 líneas: leer `usage` y emitir `logger.info("claude", { model, inputTokens, outputTokens, costUsd, caller })`.
- **Prompt caching bloqueado.** `cache_control` no se usa en ningún lado, pero además `agents/prompts.ts:261-269` interpola `nowUY` **con precisión de minuto** en el encabezado del system prompt. El caching es prefix-match: ese timestamp invalida todo lo que sigue. Y la hora ya se manda por otro lado (`orchestrator.ts:249`), o sea que está duplicada. → Sacar `nowUY` del system prompt es prerequisito de cualquier caching.

### Robustez

- **I-17 — Retry de Claude sin jitter.** `lib/claude.ts:75-93`: backoff determinístico `500 * 2^attempt`, y el `catch` reintenta ante _cualquier_ error de red — incluido un timeout post-envío, donde Anthropic ya procesó y facturó. Sin jitter, invocaciones concurrentes sincronizan el thundering herd contra el mismo 429. → `backoffMs * (0.5 + Math.random() * 0.5)`; reintentar sólo errores de conexión pre-respuesta.
- **I-18 — `morning-summary` sin dedup.** `route.ts:256-348` llama a `sendTextMessage` sin comprobar si ya envió el resumen de hoy. Es el único cron con envío proactivo sin protección (`reminders` usa `externalId`, `water-reminder` se autolimita por meta). Un 504 parcial (probable dado C-03: encadena 7 llamadas + una a Haiku) hace que se reintente y el usuario reciba el resumen dos veces, aunque el primer envío ya haya salido. → `externalId = \`morning:${uyDateKey()}\``con el patrón send-then-mark de`reminders/route.ts:151`, que es el mejor del repo.
- **I-19 — `sendTypingIndicator` es promesa flotante.** `webhook/route.ts:102` → `void sendTypingIndicator(messageId)` dentro de `after()`. Es exactamente el patrón que serverless descarta — el mismo bug que `CLAUDE.md` ya documenta para el callback `jwt`. → `await ….catch(() => {})`; la función ya es best-effort internamente.
- **I-20 — `extractTime` sin validar rango.** `agents/sleep/index.ts:373-399` hace `parseInt` sin comprobar `0 ≤ h ≤ 23`, y `atHourUY` (`lib/dates.ts:63`) es aritmética pura sin clamp. "me desperté a las 45" (typo o mala transcripción de audio) genera un `wakeTime` casi dos días en el futuro, corrompiendo `durationMinutes` y el score en cascada. El patrón `/(\d{1,2}):(\d{2})/` además matchea cualquier par de números con dos puntos ("el video 12:30"). → Validar rango y devolver `undefined` (cae al `new Date()` actual, que es seguro); exigir sufijo `hs|h|am|pm` en el patrón laxo.
- **I-21 — Clasificador con `startsWith`.** `orchestrator.ts:132` y `nlp.ts:58` usan `raw === m || raw.startsWith(m)`. Con `maxTokens: 20` truncando, una respuesta `"query_to…"` matchea `query_today` aunque el usuario preguntara por mañana (`agents/calendar/index.ts:51-64` tiene `query_today`/`query_tomorrow`/`query_week`). El usuario recibe la agenda del día equivocado sin aviso. → Normalizar (trim, primera palabra) y exigir igualdad exacta; sólo si falla, prefijo con las keys ordenadas de más larga a más corta.

### Frontend

- **I-22 — Doble submit por Enter.** `components/nutrition/NutritionQuickActions.tsx:77` llama a `handleLog` desde `onKeyDown`, y `handleLog` (`:26`) no chequea `loading` — el `disabled` del botón protege el click pero no el teclado. Idem `ProjectsQuickActions.tsx:51`. Como `/api/nutrition/meal` llama a Claude, dos Enters = dos comidas duplicadas + dos llamadas pagas + scoring contaminado. `TasksBlock.tsx:57` lo hace bien. → `if (loading) return;` como primera línea del handler.
- **I-23 — "Guardado ✓" sin mirar `res.ok`.** `SettingsClient.tsx:278-307` (`saveGoals`/`saveWeights`) muestra la confirmación incondicionalmente; `:311` no tiene rama `else`. `WaterTracker.tsx:19-30` tiene `catch { /* silently fail */ }`. El usuario configura su API key de finanzas o sus pesos de scoring, ve el tilde verde, y el server devolvió 500. → Chequear `res.ok` y renderizar el error.
- **I-24 — Mutaciones sin invalidar el Router Cache.** Sólo 2 `router.refresh()` en todo el repo, ambos en fitness. El resto actualiza estado local de React nomás. El flujo real: el usuario registra una comida en `/nutrition`, toca "Inicio", y el Router Cache sirve el dashboard viejo — "Sin comidas" y el score ring desactualizado. Parece que el registro se perdió. → `router.refresh()` al final de los `refreshAll`/`refreshData` de cada `*ModuleClient`.
- **Charts de sueño con timezone crudo.** `SleepDurationChart.tsx:88`, `SleepQualityChart.tsx:81`, `SleepTimingChart.tsx:130` construyen las claves con `toISOString().split("T")[0]`, y `RetroSleepLogger.tsx:31` usa `setHours` — justo lo que `CLAUDE.md` prohíbe. Corren en el browser (UTC-3), así que desplazan el día 3 h: una noche registrada a las 22:00 UY cae en el bucket del día siguiente y la barra se desalinea respecto al historial. → `uyDateKey()` / `atHourUY()`.
- **Timezone también en scoring del servidor.** `app/(app)/scoring/page.tsx:18,21` y `app/api/scoring/history/route.ts:21,42` usan `setHours(0,0,0,0)`. La remediación de `lib/` no llegó acá, y esto **sí** corre en Vercel (UTC): después de las 21:00 UY el rango se corre un día. → `startOfDayUY`/`endOfDayUY`, y una regla ESLint `no-restricted-syntax` que prohíba `setHours(0,0,0,0)` y `toDateString()` fuera de `lib/dates.ts`.

---

## 🟡 Menores

| #    | Hallazgo                                                                                                                                                                                                  | Archivo                                         |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| M-01 | Módulo vapes (~1.200 LOC) ausente de `CLAUDE.md`: no está en los sub-agentes, ni Nubez en integraciones, ni `NUBEZ_API_URL`/`NUBEZ_API_KEY`/`VAPES_*` en env vars ni en `.env.local.example`              | `agents/vapes/index.ts`                         |
| M-02 | `CLAUDE.md` describe Garmin como scraping SSO con `extractCsrfToken` — esa función **no existe**; el mecanismo real es OAuth 1.0a sobre `connectapi`. El runbook de diagnóstico manda al lugar equivocado | `lib/garmin.ts:6,57`                            |
| M-03 | Consumer key/secret de Garmin como literal de fallback en el código (valores públicos de `garth`, pero indistinguibles de una fuga para gitleaks)                                                         | `lib/garmin.ts:63-65`                           |
| M-04 | `agents/vapes/index.ts` (1007 LOC) implementa lógica de negocio que va en `lib/`: `levenshtein`, `matchProductos`, pricing de promos, fan-out a dos APIs                                                  | `agents/vapes/index.ts:260,329,454`             |
| M-05 | 5 tipos exportados de `lib/types.ts` sin consumidores; `IntentClassification` describe un contrato **desactualizado** (incluye `sync`, omite `synthesis`/`general`/`vapes`)                               | `lib/types.ts:80,89,112,117,145`                |
| M-06 | `agents/index.ts` es un barrel con cero importadores, al que además le falta `synthesisAgent`                                                                                                             | `agents/index.ts`                               |
| M-07 | 3 convenciones de respuesta (`{ok:true}` ×16, `{success:true}` ×11, objeto pelado) y 3 strings de 401; el guard de auth está copiado **68 veces**                                                         | `app/api/**`                                    |
| M-08 | 81 `any` explícitos, concentrados en `lib/fitness.ts` (15) y `lib/nutrition.ts` (14). Los únicos riesgosos: `as any` sobre un `create` de Prisma                                                          | `lib/fitness.ts:508,565`                        |
| M-09 | Endpoint de debug `garmin-raw` sigue desplegado, devuelve JSON crudo de Garmin y propaga el mensaje de error interno                                                                                      | `app/api/fitness/garmin-raw/route.ts`           |
| M-10 | `parseReminderRequest` traga todo error sin loguear, con `maxTokens: 120` que hace el truncamiento plausible: "recordame en 2 horas" falla y no queda rastro                                              | `lib/reminders.ts:157-197`                      |
| M-11 | `downloadAudio` castea `as { url: string }` sin validar: `fetch(undefined)` da un `TypeError` críptico                                                                                                    | `lib/whatsapp.ts:231`                           |
| M-12 | `parseInt(lower, 10)` en selección de tarjeta acepta `"2 pero mejor la otra"` → elige la 2                                                                                                                | `agents/finances/index.ts:348`                  |
| M-13 | Fast-path de agua sin piso: `"tomé 0.0001 termos"` entra a la DB y contamina el score                                                                                                                     | `lib/orchestrator.ts:348`                       |
| M-14 | `alert()` nativo como único canal de error en sueño (modal del sistema en la PWA de iOS, inconsistente con el resto)                                                                                      | `components/sleep/SleepModuleClient.tsx:82,103` |
| M-15 | `WhatsAppMessage` crece sin techo, sin índice, sin retención y **sin ningún lector** en todo el repo                                                                                                      | `prisma/schema.prisma:718`                      |
| M-16 | `<img>` en vez de `next/image` para el avatar de Google, presente en todas las páginas (sin optimizar, con layout shift)                                                                                  | `components/layout/Header.tsx:20`               |
| M-17 | `userScalable: false` + textos `text-[10px]` en finanzas: sin escape para quien no llegue a leer. Botones de 32 px contiguos (mínimo recomendado: 44 px)                                                  | `app/layout.tsx:19`                             |
| M-18 | `max_tokens` holgado en ideas (1500/1200 para salidas realistas de ~500)                                                                                                                                  | `lib/ideas.ts:236,315`                          |
| M-19 | `lib/fitness.ts` (1527) y `lib/scoring.ts` (1018) con los cortes ya dibujados como comentarios de sección; tres `getWeeklyStats` distintos que sólo se distinguen por el path del import                  | `lib/fitness.ts`, `lib/scoring.ts`              |
| M-20 | Modelo de IA hardcodeado como string en 14 archivos en vez de una constante                                                                                                                               | `lib/claude.ts`                                 |

---

## Lo que está bien (verificado — no reabrir)

- **`npx tsc --noEmit` pasa con 0 errores.**
- **No hay IDOR ni rutas API sin auth.** Las 60 rutas verifican `auth()` y derivan el `userId` de la sesión; los accesos por `[id]` filtran siempre con `where: { id, userId: session.user.id }`. El matcher del middleware cubre `/api/*`.
- **No hay secretos hardcodeados** en archivos trackeados; `.env`/`.env.local` correctamente ignorados.
- **La firma HMAC del webhook** (`lib/whatsapp.ts:17-49`) es fail-closed en producción y usa `timingSafeEqual`. `verifyCronSecret` también es de tiempo constante.
- **No hay SSRF**: `FINANCES_URL` viene de env, no de `UserSettings` — el usuario controla la API key, no la URL.
- **La capa de IA está bien defendida contra prompt injection**: el historial va en rol `user` dentro de `<historial>` con instrucción explícita de tratarlo como datos, y tanto `classifyModule` como `detectIntentAI` validan contra allowlist cerrada.
- **Claude nunca deja al usuario en silencio**: `callClaude` devuelve `null` en vez de lanzar, y hay fallback en los tres niveles (`general`, `unknown`, dato crudo del agente). El único hueco real de silencio es el timeout de lambda (C-03).
- **Idempotencia de datos de Garmin: OK.** `upsertDailySteps` y `upsertWorkoutFromGarmin` no duplican en un doble run.
- **`lib/claude.ts` es un cliente único real** con retry/backoff sobre 429/529/5xx y respeto de `Retry-After`.
- **`reminders/route.ts:151-177` es el mejor patrón del repo** (crear dedup → enviar → borrar si falla → marcar). Vale replicarlo.
- **No hay filtración de env vars a componentes cliente** (0 `process.env` en los 74 archivos con `"use client"`).
- **Los charts manejan bien array vacío y división por cero**; los 10 `loading.tsx` están completos; no hay loops de fetch en `useEffect`.

---

## Los 3 arreglos prioritarios

### 1. C-01 — Reactivar los crons de Garmin (2 líneas)

Es el único hallazgo donde una feature central está **muerta ahora mismo** y reportando éxito. Dos palabras en un `where`. Todo lo que depende de datos de Garmin (score de sueño, cardio, pasos) está degradado desde la migración a OAuth y nadie se enteró.

### 2. C-02 — Crear los índices (SQL puro, sin tocar código)

Mejor relación impacto/esfuerzo de toda la auditoría. `Reminder` es el más urgente: el cron corre 96 veces por día haciendo seq-scan de una tabla que sólo crece. `Workout`, `Meal`, `WaterLog` e `Idea` crecen linealmente para siempre.

### 3. C-03 — Timeouts + `maxDuration` (una línea por fetch)

Es la causa raíz de la peor clase de falla de la app: el usuario manda un mensaje, no recibe nada, y no queda rastro diagnosticable. Sin esto, cualquier lentitud de Garmin o Meta se convierte en pérdida silenciosa de mensajes — y las llamadas a Claude ya facturadas se tiran.

> **Menciones de honor**, por si entran en la misma tanda: **C-07** (datos inventados en `/scoring`) y **C-12** (transacciones perdidas por el TTL) son los dos que más erosionan la confianza del usuario en el producto, y ambos son fixes de pocas líneas.

---

## Sugerencia de ejecución por fases

| Fase                            | Contenido                                        | Esfuerzo     |
| ------------------------------- | ------------------------------------------------ | ------------ |
| **A — Roto en producción**      | C-01, C-08, C-07, C-12, C-02                     | 1 sesión     |
| **B — Red y resiliencia**       | C-03, C-09, I-17, I-18, I-19                     | 1 sesión     |
| **C — Seguridad**               | C-04, C-05, C-06, I-11, upgrade de `next-auth`   | 1 sesión     |
| **D — Performance/DB**          | C-15, I-01 a I-07, I-10                          | 1–2 sesiones |
| **E — Producto/UX**             | C-10, C-11, I-22, I-23, I-24, timezone del front | 1 sesión     |
| **F — Costos y observabilidad** | C-16, I-13 a I-16 (5.1 y 5.2 del BACKLOG)        | 1 sesión     |
| **G — Limpieza**                | Menores + drift documental                       | 1 tarde      |

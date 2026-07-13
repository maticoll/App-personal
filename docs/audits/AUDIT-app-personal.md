# Auditoría técnica — App Personal (CLAUDIO / HERMES)

> Fecha: 2026-07-07 · Auditor: Claude Code (auditoría independiente, solo lectura)
> Stack: Next.js 15 (App Router) + TypeScript + Prisma/Supabase + NextAuth v5 + WhatsApp Business API + Claude API + Garmin/Notion/Google Calendar + Axiom

| Dimensión | Score |
|---|---|
| Funcionalidad | 🟢 |
| Calidad de código | 🟢 |
| Dependencias | 🟡 |
| Seguridad | 🟡 |
| Mantenibilidad | 🟡 |
| **General** | 🟢 |

## Resumen ejecutivo

Proyecto sorprendentemente sólido para ser una app personal: `npx tsc --noEmit` da **0 errores**, el código está muy bien comentado (con racionales de decisiones), el manejo de errores es consistente (retry/backoff en Claude API, fail-safe en logger, HMAC timing-safe en el webhook) y **no hay secretos commiteados en git** (verificado con `git ls-files` y `git log --diff-filter=A`, solo existe `.env.local.example`). La deuda principal está en dependencias: `npm audit` reporta **10 vulnerabilidades (6 high)**, incluyendo el middleware bypass de Next.js — relevante porque el auth de páginas depende del middleware — y `next-pwa` deprecado arrastrando una cadena vulnerable. También hay drift documental: el módulo de vapes (≈900 líneas, el más reciente) no existe en `CLAUDE.md` ni sus env vars en `.env.local.example`.

## Findings verificados

### 1. [Alto · fix S] Next.js 15.5.16 vulnerable a middleware bypass (GHSA-26hh-7cqf-hhc6)
- **Dónde:** `package.json:26` (instalado: `next@15.5.16`, verificado con `node -e require('next/package.json')`; rango vulnerable llega hasta 16.3.0-canary.5). Reportado por `npm audit` como high.
- **Impacto:** el auth de **páginas** vive solo en `middleware.ts` — un bypass del middleware expone el dashboard y todas las páginas `(app)/*`. Mitigante verificado: las API routes NO dependen del middleware; todas (salvo crons/webhook, que validan secreto/firma propios) llaman `auth()` internamente y devuelven 401 (ej: `app/api/tasks/route.ts:6-8`; grep confirmó que solo las rutas cron, webhook y `[...nextauth]` no llaman `auth()`).
- **Fix:** `npm audit fix` (actualiza a next 15.5.20 wanted; también arregla el `postcss` moderate anidado).

### 2. [Alto · fix M] `next-pwa` deprecado arrastra cadena con vulnerabilidad high (serialize-javascript RCE)
- **Dónde:** `package.json:28` (`next-pwa@^5.6.0`, sin mantenimiento desde 2022) → `workbox-webpack-plugin` → `workbox-build` → `rollup-plugin-terser` → `serialize-javascript <=7.0.2` (GHSA-5c6j-r48x-rmvq, high).
- **Impacto:** es cadena de **build-time** (no corre en runtime del server), riesgo real acotado, pero `npm audit fix --force` rompería el PWA. La solución de fondo es migrar a `@serwist/next` (sucesor mantenido).

### 3. [Medio · fix S] `CRON_SECRET` viaja como query param y la comparación no es timing-safe
- **Dónde:** `lib/cron.ts:19` (acepta `?secret=CRON_SECRET`) y `lib/cron.ts:24-28` (comparación con `===`). El propio código lo documenta como workaround del plan free de cron-job.org (`app/api/cron/reminders/route.ts:10-14` publica el formato de URL con el secret).
- **Impacto:** el secret queda persistido en logs de acceso de Vercel, historial de cron-job.org y cualquier proxy intermedio. Con ese secret se pueden disparar los crons (spam de WhatsApp, sync forzado) y usar `?secret=` en `/api/fitness/garmin-session` (excluida del middleware en `middleware.ts:26`).
- **Fix:** mover cron-job.org al header `x-cron-secret` (ya soportado en `lib/cron.ts:14`) y usar `crypto.timingSafeEqual`. Rotar el secret después.

### 4. [Medio · fix S] Webhook de WhatsApp es fail-open si falta `WHATSAPP_APP_SECRET`
- **Dónde:** `lib/whatsapp.ts:19-23` — si la env var no está seteada, `verifyWebhookSignature` loguea un warn y devuelve `true` (acepta cualquier POST sin firma). `.env.local.example` lo trae vacío por defecto.
- **Impacto:** si en Vercel no está configurada, cualquiera que conozca la URL puede inyectar mensajes falsos → gasto de tokens de Claude/Whisper y mensajes salientes de WhatsApp. La implementación HMAC en sí es correcta (raw body + `timingSafeEqual`, `app/api/whatsapp/webhook/route.ts:49-57`). No verificable desde el filesystem si la var está seteada en prod.
- **Fix:** fail-closed cuando `NODE_ENV === "production"`.

### 5. [Medio · fix S] Drift documental: módulo vapes invisible en la documentación
- **Dónde:** `agents/vapes/index.ts` (771 líneas), `lib/vapes.ts`, `lib/pending-vape.ts` — el módulo más activo según `git log` (últimos 5 commits son todos de vapes). No aparece en `CLAUDE.md` (dice "Sub-agentes (8)", lista `MODULE_DESCRIPTIONS` sin vapes), y `NUBEZ_API_URL` / `NUBEZ_API_KEY` (`lib/vapes.ts:14-15`) no están ni en `.env.local.example` ni en la lista de env vars de `CLAUDE.md`. Además `vercel.json` no incluye el cron `fitness-habits` que `CLAUDE.md` dice que corre en Vercel a las 7:10.
- **Impacto:** otra persona (u otro Claude) que levante el proyecto siguiendo la doc no sabe que existe el flujo vapes→Nubez→Finanzas ni qué credenciales necesita.

### 6. [Medio · fix M] Deuda de versiones: next-auth beta congelada y Prisma 2 majors atrás
- **Dónde:** `package.json:27` (`next-auth@5.0.0-beta.31` — v5 sigue en beta, sin release estable) y `package.json:22,43` (`prisma@5.22.0` vs 7.8.0 actual). También `recharts` 2.x (3.x actual), `tailwindcss` 3.x (4.x), `lucide-react` 0.460 (1.x).
- **Impacto:** funciona hoy, pero cada mes que pasa el salto se encarece; next-auth beta puede introducir breaking changes entre betas si se actualiza sin querer (está con `^`).

### 7. [Bajo · fix S] Model IDs de Claude duplicados en 12 archivos
- **Dónde:** `claude-haiku-4-5-20251001` / `claude-sonnet-4-6` hardcodeados en `lib/orchestrator.ts`, `lib/nlp.ts`, `lib/conversation.ts`, `lib/fitness.ts`, `lib/ideas.ts`, `lib/nutrition.ts`, `lib/reminders.ts`, `agents/calendar/index.ts`, `agents/finances/index.ts`, `agents/synthesis/index.ts`, `app/api/cron/morning-summary/route.ts` (grep verificado).
- **Fix:** exportar `MODELS = { classifier, responder }` desde `lib/claude.ts` (que ya es el cliente único).

### 8. [Bajo · fix M] 62 usos de `any`/`as any` pese a `strict: true`
- **Dónde:** grep en `app/ lib/ agents/ components/`; el caso más visible es `processIncomingMessage(body: any)` con `eslint-disable` en `app/api/whatsapp/webhook/route.ts:76-77`, y los casts `as unknown as` de `lib/pending-vape.ts:44,63-66`. `tsc --noEmit` pasa en 0 errores igual, así que es deuda contenida, no rota.

### 9. [Bajo · fix S] `pending-vape` reusa la tabla `pending_transactions` con marcador mágico
- **Dónde:** `lib/pending-vape.ts:4-9` — usa `PendingTransaction` (UNIQUE por `userId`) con `data.kind = "vape_buyer" | "vape_clarify"` para distinguirse del pending de finanzas. Un flujo pisa al otro (el `upsert` de `saveVapePending` sobreescribe un pending de finanzas activo y viceversa). Está documentado en el código y el orquestador lo maneja en orden (`lib/orchestrator.ts:222-259`), pero es acoplamiento frágil si se agrega un tercer tipo de pending.

### 10. [Bajo · fix S] TODOs obsoletos que referencian features descartadas
- **Dónde:** `agents/ideas/index.ts:162` (`TODO: Session 7 - sync con Lumina API` — Lumina fue reemplazada por el módulo Ideas nativo según `CLAUDE.md`) y `lib/fitness.ts:481` (TODO de reagendado por Calendar, nunca hecho). Ruido menor, conviene limpiarlos o moverlos a `PENDIENTES.md`.

**Resto (una línea):** consumer key/secret OAuth de Garmin hardcodeados como fallback en `lib/garmin.ts:63-65` (son los públicos de garth, no un secreto real — solo mala señal de patrón); patrón `addTurn(...).catch(console.error)` repetido 8 veces en `lib/orchestrator.ts` (extraíble a helper); `AGENTS.md` desactualizado (ya avisado en el propio `CLAUDE.md`); no hay ningún test automatizado (la verificación es solo `tsc` + build, asumido por diseño).

## Sospechas a confirmar

- **`WHATSAPP_APP_SECRET` seteado en Vercel:** el código es fail-open (finding 4); si en prod está vacío, el webhook está abierto. **No verificable desde el filesystem.**
- **Estado real del deploy y de los crons de cron-job.org** (water-reminder, reminders c/15min, sleep-notifications extra): configuración externa. **No verificable desde el filesystem.**
- **Garmin SSO scraping (`lib/garmin.ts`)**: por diseño es frágil (login por HTML + CSRF extraction); no puedo verificar si hoy funciona sin ejecutarlo contra Garmin. El código está preparado para inyección manual de sesión (`/api/fitness/garmin-session`) como plan B, lo que sugiere que ya se rompió al menos una vez.
- **API externa de finanzas (`finanzas-lemon`)**: la dependencia cruzada con el middleware de ESA app (documentada en `CLAUDE.md` como gotcha) implica que un cambio allá rompe finanzas acá silenciosamente, salvo por el chequeo de content-type de `financesApiFetch`.
- **Retries de Meta y mensajes duplicados:** `WhatsAppMessage.waMessageId` es `@unique` (`prisma/schema.prisma:721`), lo que dedupea por accidente (el `create` del retry tira), pero el retry ya habrá gastado transcripción de Whisper y typing indicator antes de fallar. Menor, verificar en logs de Axiom si ocurre.

## Por dimensión

**1. Funcionalidad — 🟢.** `tsc --noEmit` en 0 errores. No encontré lógica rota ni features a medio hacer: los 8 módulos + vapes están completos y el flujo del orquestador (pending bypass → fast-path vapes → clasificación Haiku → agente → Sonnet/verbatim → memoria) es coherente de punta a punta. Los TODOs existentes son menores u obsoletos (finding 10). `PENDIENTES.md` documenta honestamente el único recorte real (granularidad de crons por plan Hobby).

**2. Calidad de código — 🟢.** Arquitectura limpia y consistente (`lib/` negocio, `agents/` conversacional, `app/` UI+API), cliente Claude centralizado con retry/backoff (`lib/claude.ts`), logger fire-and-forget que nunca bloquea (`lib/logger.ts`), comentarios con racionales (el porqué del `await` en el callback `jwt` de `auth.ts:31-34` es ejemplar). Deuda contenida: 62 `any`, model IDs duplicados, archivos grandes (`lib/fitness.ts` 1442 líneas, `lib/scoring.ts` 858).

**3. Dependencias — 🟡.** `npm audit`: 10 vulns (1 low, 3 moderate, 6 high). Las high accionables: next (fix S vía `npm audit fix`) y la cadena next-pwa (fix M, migrar a serwist). Además next-auth beta y Prisma 5 vs 7 (finding 6).

**4. Seguridad — 🟡.** **Sin secretos commiteados** (verificado: `.gitignore` cubre `.env*`, historial limpio — el único `.env*` en git history es `.env.local.example` con placeholders). Auth con allowlist de emails (`auth.config.ts:37-46`), API routes con `auth()` propio, webhook con HMAC timing-safe, crons con secreto. Lo amarillo: secret por query param (finding 3) y fail-open del webhook (finding 4). Nada crítico.

**5. Mantenibilidad — 🟡.** `CLAUDE.md` es de lo mejor que vi en proyectos personales (gotchas, arquitectura, crons, env vars, historial en `docs/session-history.md`), `.env.local.example` completo y comentado. Lo que lo baja a amarillo: **no hay README.md** (para alguien que no usa Claude Code el entry point no es obvio), el módulo vapes y sus env vars no están documentados (finding 5), `vercel.json` desincronizado con la doc de crons, y cero tests (el "contrato" es solo el typechecker).

**6. Reutilización — ver sección siguiente.**

## Código reutilizable para Kairo

Candidatos concretos para un paquete compartido (`@kairo/*`), ordenados por valor/esfuerzo:

1. **`lib/claude.ts`** — cliente Claude API con retry + backoff exponencial + `retry-after`, sin SDK, cero dependencias, nunca lanza. Extraíble tal cual. El de mayor valor inmediato.
2. **`lib/whatsapp.ts`** — cliente completo de WhatsApp Business API: envío de texto/templates, typing indicator, descarga de audio, verificación HMAC de webhooks y transcripción con Whisper. Junto con el patrón `200 + after()` del webhook (`app/api/whatsapp/webhook/route.ts`) es un starter kit de bots de WhatsApp para clientes de la agencia.
3. **Patrón orquestador + agentes** (`lib/orchestrator.ts`, `lib/nlp.ts`, `agents/*` con `AgentInput/AgentOutput` de `lib/types.ts`, `lib/conversation.ts` con rolling window + summary) — arquitectura genérica de asistente multi-dominio: clasificador barato (Haiku) → agente especialista → respuesta con voz (Sonnet) → memoria. Reutilizable cambiando `MODULE_DESCRIPTIONS` y los agentes.
4. **Split NextAuth v5 edge-safe** (`auth.config.ts` + `auth.ts` + `middleware.ts`) — patrón Google OAuth con allowlist, JWT strategy para Edge, y persistencia correcta de refresh tokens en serverless. Boilerplate directo para cualquier app interna de Kairo.
5. **`lib/cron.ts`** — `verifyCronSecret` multi-formato (Vercel/cron-job.org), tras aplicar el fix del finding 3.
6. **`lib/logger.ts`** — wrapper Axiom fire-and-forget con fallback a console. Trivial de extraer.
7. **`lib/notion.ts`** — cliente Notion con credenciales por usuario + fallback a env, y mapeo tolerante de status. Útil si otros proyectos de Kairo tocan Notion.
8. **`lib/garmin.ts`** — cliente Garmin Connect no oficial (SSO + OAuth1 + inyección de sesión). Nicho y frágil, pero no existe equivalente listo; reutilizable solo para proyectos personales, no para clientes.

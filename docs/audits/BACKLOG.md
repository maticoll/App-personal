# BACKLOG — qué falta hacer (listo para ejecutar)

> Actualizado: 2026-07-13. Origen: `AUDIT-2026-07-13-timezone-y-mejoras.md` + `AUDIT-app-personal.md` (2026-07-07).
> Para arrancar la próxima sesión: **"ejecutá la Fase 3 del @docs/audits/BACKLOG.md"** (o la fase que toque).
> Verificación estándar: `npx tsc --noEmit` (0 errores) + `npm run build`. Commits atómicos por ítem o grupo.

## ✅ Ya hecho (no tocar)

- Fase 1: fix del calendario (agenda corrida un día) — commit `0da8bfe`
- Fase 2 completa: timezone en TODA la app (~30 puntos) — commits `af0a8da`, `01550a2`, `61e41b0`
- Score de hoy sin congelar + `financesScore` en `getStoredScore` — commit `01550a2`
- Quick wins: sync global, fast-paths sin IA, tareas por WhatsApp, morning summary con tareas, tira de vapes — commit `ac2d38d`

---

## 🔴 Fase 3 — Robustez (la próxima sesión)

Orden sugerido: 3.1 → 3.2 → 3.3 → 3.4 → 3.5. Los tres primeros son los que protegen plata y mensajes.

### 3.1 Claim atómico de pendings — evita transacciones y stock DUPLICADOS

- **Problema:** dos mensajes de WhatsApp casi simultáneos (doble "sí", retry de Meta) leen el mismo pending antes de que ninguno lo borre → dos transacciones en finanzas-lemon o doble descuento de stock en Nubez. El flujo actual es _read → efecto externo → clear_.
- **Dónde:** `agents/finances/index.ts` (`handleConfirmation`, ~línea 340-357: crea transacción y DESPUÉS `clearPending`) · `agents/vapes/index.ts` (`handleBuyerReply`, ~663-685) · lecturas en `lib/orchestrator.ts` (`getVapePending` / `getPending`).
- **Fix:** claim atómico ANTES de ejecutar efectos externos:
  ```ts
  const { count } = await db.pendingTransaction.deleteMany({
    where: { userId },
  });
  if (count === 0) return "Ya lo estoy procesando 👍"; // otra lambda ganó
  // recién acá llamar a createTransaction / ejecutarMovimientos
  ```
  Mismo patrón para el pending de vapes (`lib/pending-vape.ts`). Si el efecto externo falla después del claim, recrear el pending o avisar.

### 3.2 Error visible al usuario cuando `orchestrate()` explota

- **Problema:** si `orchestrate` o el envío lanzan, el catch solo loguea → el usuario queda mirando "escribiendo…" y el mensaje INBOUND queda `PENDING` para siempre.
- **Dónde:** `app/api/whatsapp/webhook/route.ts` (~194-196, catch de `processIncomingMessage`).
- **Fix:** en el catch, best-effort `sendTextMessage(from, "Uy, algo se rompió procesando eso. Probá de nuevo.")` (envuelto en su propio try) + marcar el `WhatsAppMessage` INBOUND como `FAILED`.

### 3.3 Reminders de Calendar: enviar ANTES de marcar `sent`

- **Problema:** `db.reminder.create({ sent: true })` ocurre ANTES de `sendReminderTemplate`. Si Meta falla, el dedupe queda marcado y el aviso se pierde para siempre.
- **Dónde:** `app/api/cron/reminders/route.ts` (~140-151, Parte 2 / alertas de Calendar).
- **Fix:** crear con `sent: false` → enviar → marcar `sent: true`; o borrar el registro en el catch. (La Parte 1 del mismo archivo ya hace send-then-mark: copiar ese patrón.)

### 3.4 Axiom nunca flushea — logs fantasma en serverless

- **Problema:** `lib/logger.ts:40` hace `void client.ingest(...)`; el buffer muere cuando la lambda se congela. Cero llamadas a `flush()` en el repo.
- **Fix:** migrar a `@axiomhq/nextjs` (**ya está instalado y sin usar**, `package.json`), o `await client.flush()` dentro de `after()` al final de cada request. Si no se usa, desinstalar `@axiomhq/logging` y `@axiomhq/nextjs`.

### 3.5 `addTurn` en paralelo pierde un turno de memoria

- **Problema:** `Promise.all([addTurn(user), addTurn(assistant)])` en los paths de pending y fast-path: `addTurn` es read-modify-write no atómico → el último write pisa al otro casi siempre.
- **Dónde:** `lib/orchestrator.ts` (los 4 bloques `Promise.all([addTurn..., addTurn...])`) · `lib/conversation.ts` (~66-120).
- **Fix:** crear `addTurns(userId, turns[])` en `lib/conversation.ts` (un solo read + un solo write) y reemplazar los 4 call sites.

### 3.6 (Menor) `.catch(() => null)` en pendings convierte DB caída en misrouting

- **Dónde:** `lib/orchestrator.ts` (lecturas de pending), `lib/pending-transaction.ts:83`, `lib/pending-vape.ts:53`.
- **Fix:** distinguir `{ ok: false }` (error) de `null` (no hay pending); ante error responder "dame un segundo y repetímelo" en vez de mandar el "sí" al clasificador.

---

## 🟠 Fase 4 — Seguridad/deps (heredado de la auditoría 2026-07-07, sigue pendiente)

- **4.1** `npm audit fix` → Next.js 15.5.20 (middleware bypass GHSA-26hh-7cqf-hhc6, el auth de páginas depende del middleware).
- **4.2** Webhook WhatsApp fail-closed: si falta `WHATSAPP_APP_SECRET` en producción, rechazar (`lib/whatsapp.ts:19-23` devuelve `true` hoy).
- **4.3** `CRON_SECRET`: mover cron-job.org al header `x-cron-secret` (ya soportado en `lib/cron.ts:14`), comparación con `crypto.timingSafeEqual`, rotar el secret después.
- **4.4** Prompt injection: mover el historial de conversación del rol **system** al rol **user** con delimitadores `<historial>...</historial>` (`lib/orchestrator.ts` `generateFinalResponse`, `agents/prompts.ts:257`).
- **4.5** (Grande, planificar aparte) Migrar `next-pwa` → `@serwist/next`.

---

## 🟡 Fase 5 — Costos de IA

- **5.1** Fusionar clasificador de módulo + intent en UNA llamada Haiku: el clasificador devuelve `"modulo.intent"` (ej: `"calendar.query_tomorrow"`) — `MODULE_DESCRIPTIONS` e intents son estáticos. Tocar `lib/orchestrator.ts` + `lib/nlp.ts`; migrable módulo a módulo. Recorta ~⅓ de las llamadas.
- **5.2** Marcar `verbatim: true` las confirmaciones simples de finanzas, nutrición y calendar (hoy Sonnet reescribe hasta "✅ Registrado: -$500").

---

## 🟢 Limpieza (una tarde, todo junto en un commit)

- Código muerto: `agents/finances/index.ts` (~380: `getGoals` + `buildFinancesPrompt` calculados y descartados), `agents/fitness/index.ts` (ídem + import `detectIntentAI` sin usar), `agents/ideas/index.ts` (`void normalize`).
- Catch vacíos sin log en `agents/fitness`, `agents/finances`, `agents/calendar`, `agents/synthesis`, `lib/reminders` → `console.error("[agente]", err)` uniforme (vapes e ideas ya lo hacen).
- `lib/fitness.ts` `getExerciseBests` (~897): acotar a 12 meses o `take`.
- `agents/scoring/index.ts` `recalculateWeek`: secuencial o chunks de 3 (hoy ~35 queries paralelas contra Neon).
- `agents/prompts.ts:153` `buildFinancesPrompt`: guard si `financesMonthlyIncome === 0` (NaN%).
- `lib/ideas.ts` `getAllIdeas`: agregar `take`.

---

## 🔵 Features medianas (elegir según ganas — detalles en AUDIT-2026-07-13 §4)

1. **Alertas proactivas de gasto** — cron semanal en cron-job.org, compara gasto por categoría vs promedio con `getMonthlyReport`, avisa solo con desvío >X%. Única promesa del blueprint del agente de finanzas sin cumplir.
2. **Heatmap de streaks en /scoring** — grid tipo GitHub con `DailyScore` (datos ya persistidos, `getScoreHistory`).
3. **Página /vapes + deudores** — ventas del mes, top sabores, margen y "quién me debe" (requiere `GET /api/metricas` en el repo de Nubez). Bonus: intent "¿quién me debe?" por WhatsApp.
4. **Foto de comida por WhatsApp** — rama `image` en el webhook → Haiku con visión estima plato y macros → `processNutritionMessage`.
5. **Recap nocturno (~23:00 UY)** — cron que persiste el score final del día + mensaje corto (score, qué faltó, racha).

### Apuestas grandes (planificar con /spec antes)

- Pipeline de IA con tool-use (una tool por módulo, intents como enum).
- Weekly review automático con memoria de tendencias (persistir reporte semanal y comparar).
- Web Push del PWA para recordatorios de bajo valor (agua/dormir).

---

## Notas

- **Datos históricos:** los registros guardados de noche ANTES del fix de timezone quedaron con fecha corrida en la DB. El fix no reescribe el pasado. Si molesta en los gráficos, se puede hacer un script de migración puntual (revisar `DailyScore`, `Meal`, `WaterLog`, `SleepLog` de fechas previas al 2026-07-13).
- **Drift documental de vapes:** el módulo vapes sigue sin sección propia en `CLAUDE.md` y `NUBEZ_API_URL`/`NUBEZ_API_KEY` no están en `.env.local.example` (finding 5 de la auditoría 2026-07-07).

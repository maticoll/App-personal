# Auditoría 2026-07-13 — Bug de timezone + robustez + roadmap

> Auditoría multi-agente (3 auditores en paralelo, verificación contra código real).
> Complementa `AUDIT-app-personal.md` (2026-07-07) — **no repite** sus findings (npm audit, next-pwa, CRON_SECRET, webhook fail-open, drift vapes, versiones, model IDs duplicados).
> Disparador: HERMES respondía "qué tengo mañana" con los eventos del miércoles siendo mañana martes.

---

## 1. El bug reportado — ARREGLADO en este commit

**Root cause:** el servidor (Vercel) corre en UTC y el usuario vive en UY (UTC-3). Dos errores combinados en la capa de calendario:

1. **All-day events corridos un día:** `mapGoogleEvent` parseaba `"YYYY-MM-DD" + "T00:00:00"` sin offset → medianoche UTC = 21:00 UY del día **anterior**. Un evento de todo el día del miércoles se mostraba el martes.
2. **Límites de día del servidor:** `getTodayEvents`/`getWeekEvents` usaban `setHours(0,0,0,0)` → después de las 21:00 UY, "hoy" pasaba a ser mañana. El agrupado semanal con `toDateString()` (UTC) corría los eventos nocturnos al día siguiente.
3. Además `end.date` de Google en all-day es **exclusivo** → el evento "derramaba" un día extra.
4. No existía intent "qué tengo mañana" — caía en `query_week` y Sonnet interpretaba sobre datos ya corridos.

**Fix aplicado (commit `fix(calendar)`):**

- `lib/dates.ts` nuevo: `startOfDayUY`, `endOfDayUY`, `uyDateKey`, `atHourUY`, `addDays`, `currentHourUY`.
- `lib/calendar.ts`: límites de día en UY en `getTodayEvents`, `getWeekEvents`, `findEventByTitle`, `findFreeSlots`; all-day anclado a `-03:00`; `getTomorrowEvents()` nuevo.
- `agents/calendar/index.ts`: intent `query_tomorrow` + agrupado semanal por `uyDateKey`.
- Gotcha documentado en `CLAUDE.md`.

---

## 2. El mismo bug vive en TODA la app (pendiente — prioridad máxima)

El barrido encontró **~30 puntos más** con el mismo patrón: "día = medianoche del reloj del servidor". Ventana crítica: **21:00–23:59 UY** (el día UTC ya es mañana). Las horas leídas con `getHours()` corren 3h siempre.

### Alta severidad

| Dónde                                                  | Síntoma en prod                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/scoring.ts:36-46` + callers                       | Después de las 21:00 UY el score de "hoy" se calcula y **se guarda bajo la fecha de mañana** en `DailyScore`. Agravante: `app/(app)/page.tsx:66-71` y `app/api/scoring/today/route.ts:25-33` no recalculan si existe stored → **mañana amanece con el score congelado** de anoche |
| `lib/scoring.ts:212-213`                               | `stepsDateKey` con `toISOString()` → de noche busca los pasos de mañana → bloque cardio del fitness score da 0                                                                                                                                                                    |
| `lib/scoring.ts:149`                                   | `bedTime.getHours()` en UTC: acostarse 22:30 UY se lee 01:30 → siempre "hora muy tardía", pierde hasta 30 pts                                                                                                                                                                     |
| `lib/scoring.ts:206-208`                               | `getDay()` UTC → de noche evalúa `isGymDay` con el día de mañana                                                                                                                                                                                                                  |
| `agents/scoring/index.ts:22,41-48,99,112-117`          | "¿Cómo vengo hoy?" a las 22:00 calcula/guarda el score de mañana; "score de ayer" devuelve el de hoy; `recalculateWeek` corre la semana un día                                                                                                                                    |
| `lib/sleep.ts:348-352`                                 | `getToday` corrido → el **streak de sueño se corta a 0 todas las noches** (busca la key de mañana)                                                                                                                                                                                |
| `agents/sleep/index.ts:383-388`                        | "Me acosté a las 23" guarda **23:00 UTC = 20:00 UY** — instante falso permanente en DB, rompe merge con Garmin                                                                                                                                                                    |
| `lib/fitness.ts:122-131,233-237,277-282`               | Workout a las 21:30 UY cae en el día siguiente para stats, score y dashboard                                                                                                                                                                                                      |
| `lib/fitness.ts:446-461`                               | `checkSmartHabitDeviation` interpreta `expectedGymTime` como hora UTC → con el cron a las 7:10 UTC (4:10 UY), la alerta "pasó la hora del gym" puede dispararse **a las 4 AM**                                                                                                    |
| `lib/nutrition.ts:64-68,328,364,86-91`                 | **Cena y agua después de las 21:00 se guardan con fecha de mañana**; el resumen de hoy aparece vacío de noche. Probablemente el síntoma más visible del "día corrido"                                                                                                             |
| `agents/finances/index.ts:255` + `lib/finances.ts:249` | Gasto registrado a las 22:00 queda **fechado mañana** en finanzas-lemon — dato financiero incorrecto permanente                                                                                                                                                                   |
| `agents/nutrition/index.ts:57-61`                      | `detectMealType` por hora UTC: desayuno de las 9:00 UY se clasifica LUNCH, merienda 17:30 → DINNER (corrido 3h siempre)                                                                                                                                                           |

### Media severidad

- `app/api/settings/day-data/route.ts:39-45` — "Borrar datos de hoy" de noche **borra el día equivocado** (acción destructiva).
- `app/api/cron/morning-summary/route.ts:193-195` — el resumen matutino pierde sistemáticamente lo registrado después de las 21:00 de anoche (consecuencia de las escrituras corridas).
- `app/api/fitness/sync-garmin/route.ts:28` + `agents/fitness/index.ts:259` — sync manual de noche pide a Garmin un día futuro → "no hay actividades nuevas".
- Cron `sleep-sync` a las 8:00 UTC = **5 AM UY**: el usuario duerme, Garmin no cerró la noche → el sueño se sincroniza 24h tarde. Mover a `0 11 * * *`.
- `agents/synthesis/index.ts:106-153` — `toLocaleDateString` sin `timeZone` → los insights de Sonnet mezclan días ("entrenaste el martes" cuando fue lunes de noche).
- `lib/tasks.ts:41-67`, `lib/projects.ts:49-58` — "completadas hoy"/semana en UTC.
- `agents/finances/index.ts:95` — el prompt dice "Hoy es {fecha UTC}" → "ayer/hoy" en lenguaje natural se resuelven corridos de noche.

### Baja severidad

`app/api/scoring/history/route.ts:19-43` (bordes del gráfico), `lib/scoring.ts:652-653` (proyección de ahorro en cambio de mes), `lib/fitness.ts:1367-1372` y `lib/ideas.ts:417-421` (semana UTC), `app/api/cron/water-reminder/route.ts:34`, y el hack frágil de `sleep-notifications:50` (reemplazar por `atHourUY`).

**Orden de fix sugerido** (todo con `lib/dates.ts`, ya creado):

1. Escrituras de keys: `lib/nutrition.ts`, `lib/sleep.ts` (`getToday`/`getDateForSleep`), `agents/sleep` (`extractTime`), fecha default de finanzas.
2. `lib/scoring.ts` completo + recalcular en vez de devolver stored para "hoy".
3. `checkSmartHabitDeviation` + horario del cron `sleep-sync`.
4. `detectMealType` + prompts con fecha.
5. Ventanas de stats, síntesis, tasks/projects, history.

> Nota: las keys existentes en DB están en medianoche UTC. Al migrar lecturas+escrituras juntas por módulo no hay corrupción; los registros históricos nocturnos ya estaban corridos.

---

## 3. Robustez y calidad (fuera de timezone)

### Alta

1. **Doble procesamiento de confirmaciones = plata/stock duplicados** (`webhook` sin lock por usuario + flujo _read → efecto externo → clear_ en `agents/finances/index.ts:340-357` y `agents/vapes/index.ts:663-685`). Dos "sí" casi simultáneos crean **dos transacciones** en finanzas-lemon o **doble descuento de stock** en Nubez. Fix: claim atómico (`deleteMany` con `count` como lock) antes de ejecutar efectos externos.

### Media

2. **`Promise.all([addTurn, addTurn])` pierde un turno de memoria** en todos los paths de pending (`lib/orchestrator.ts:231-278`; `addTurn` es read-modify-write no atómico). Fix: secuenciar o `addTurns()` con un solo write.
3. **Costo Claude: 3-4 llamadas por mensaje** (Haiku módulo + Haiku intent + Haiku parseo + Sonnet). Fix: fusionar módulo+intent en una llamada (`"calendar.create_event"`), y `verbatim` en confirmaciones simples. Lo más accionable en costos.
4. **Prompt injection al system prompt:** los últimos 8 turnos crudos del usuario (incluye audios transcriptos y reenvíos) se concatenan al rol system (`lib/orchestrator.ts:209`) y pueden envenenar el summary persistido. Fix: mover historial al rol user con delimitadores.
5. **Axiom nunca flushea** (`lib/logger.ts:40`, cero `flush()` en el repo) → logs fantasma en serverless. `@axiomhq/nextjs` está instalado y sin usar — resolvería exactamente esto.
6. **Recordatorios de Calendar se marcan `sent:true` ANTES de enviar** (`app/api/cron/reminders/route.ts:140-151`) → si Meta falla, el aviso se pierde para siempre.
7. **Si `orchestrate()` explota, el usuario no recibe nada** (`webhook:194-196` solo loguea). Fix: mensaje best-effort "algo se rompió" + marcar INBOUND `FAILED`.
8. **`.catch(() => null)` en chequeos de pending** convierte una caída de DB en misrouting (el "sí" de un gasto va al clasificador).

### Baja

9. Código muerto: `getGoals` + prompt calculados y descartados (`agents/finances:380`, `agents/fitness:218`), `void normalize` (`agents/ideas:167`), import sin usar.
10. Catch vacíos sin log en ~6 agentes (vapes e ideas sí loguean — uniformar).
11. `getExerciseBests` carga todos los workouts históricos sin cota; `recalculateWeek` dispara ~35 queries paralelas contra Neon (convención propia: p-limit ≤ 5).
12. `buildFinancesPrompt` divide por cero si `financesMonthlyIncome = 0` → "NaN% del ingreso".
13. Deps muertas: `@axiomhq/logging`, `@axiomhq/nextjs` (usarlas para el punto 5 o desinstalar).
14. Tres patrones distintos de detección de intent y dos formas de exponer agentes — cada agente nuevo copia uno diferente.

**Verificado OK (no re-auditar):** IDOR (51 handlers con `auth()` + ownership), ConversationMemory acotada por diseño, dedupe de Meta por `waMessageId @unique`, retry/backoff de `lib/claude.ts`.

---

## 4. Qué agregarle a la app (roadmap propuesto)

### Quick wins (< 1 sesión)

1. **Fix score congelado + `financesScore` perdido:** `getStoredScore` (`lib/scoring.ts:766`) no mapea `financesScore` → el tile de Finanzas muestra "—" con score cacheado; y el dashboard congela el score del día en la primera visita. (Se solapa con el fix de timezone del scoring — hacer juntos.)
2. **Tasks por WhatsApp:** el bloque de tareas es lo primero del dashboard y ningún agente usa `lib/tasks.ts`. Intents `add/complete/list_week_tasks`.
3. **Comando "sync" global** (blueprint §4.5): fast-path regex antes de Haiku → Garmin sueño + actividad + pasos + Notion con `Promise.allSettled`. Cero costo de IA.
4. **Morning summary completo:** sumar tareas de la semana (`getThisWeekTasks`) y Notion pendientes — era la mitad del valor del resumen según el blueprint.
5. **Tile de Vapes en el dashboard:** stock total y sabores por agotarse vía `getProductos()` (fail-silent, timeout corto).
6. **Fast-paths regex para mensajes frecuentes** ("tomé un termo", "me desperté"): ahorra 3 llamadas de IA en los mensajes más repetidos.

### Medianas (1-3 sesiones)

1. **Alertas proactivas de gasto** (única promesa del agente de finanzas sin cumplir): cron semanal en cron-job.org comparando gasto por categoría vs promedio, avisa solo con desvío >X%.
2. **Heatmap de streaks en /scoring** (blueprint §5.3): grid tipo GitHub con `DailyScore` — datos ya persistidos, cero datos nuevos.
3. **Página /vapes con métricas + deudores:** ventas del mes, top sabores, margen y "quién me debe" (plata real que hoy solo vive en Sheets). Bonus: intent "¿quién me debe?" por WhatsApp.
4. **Foto de comida por WhatsApp:** rama `image` en el webhook → Haiku con visión estima plato y macros. Paga solo cuando se usa.
5. **Recap nocturno (~23:00 UY):** persiste el score final del día (cierra de raíz el score congelado) + mensaje corto con score, qué faltó y racha.

### Apuestas grandes

1. **Pipeline de IA con tool-use:** una sola llamada Haiku con tools (una por módulo, intents como enum) reemplaza clasificador + intent. Recorta ~⅓ de las llamadas, migrable módulo a módulo detrás de flag.
2. **Weekly review automático con memoria de tendencias:** cron dominical sobre `synthesisAgent`, persiste reporte semanal y compara contra semanas previas ("tercera semana bajando sueño"). Convierte a HERMES de registrador en coach.
3. **Web Push del PWA para recordatorios de bajo valor** (agua, dormir): reduce dependencia de la ventana de 24h de Meta; WhatsApp queda para lo conversacional.

---

## 5. Plan de acción sugerido (orden)

> ⚡ **Estado vivo del plan: ver `docs/audits/BACKLOG.md`** (qué está hecho y qué falta, listo para ejecutar).

1. ✅ Fix calendario (commit `0da8bfe`).
2. ✅ **Fase timezone** completa (commits `af0a8da`, `01550a2`, `61e41b0`) — sección 2 cerrada, incluido el score congelado.
3. ⬜ Robustez alta/media: claim atómico de pendings (#1), error visible al usuario (#7), reminders send-then-mark (#6), Axiom flush (#5). → BACKLOG Fase 3.
4. ✅ Quick wins de producto (commit `ac2d38d`): sync global, fast-paths, tareas por WhatsApp, morning summary con tareas, tira de vapes.
5. ⬜ Costos de IA: fusión módulo+intent + verbatim en confirmaciones. → BACKLOG Fase 5.

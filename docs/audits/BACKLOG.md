# BACKLOG — qué falta hacer (listo para ejecutar)

> Actualizado: 2026-07-14. Origen: `AUDIT-2026-07-13-timezone-y-mejoras.md` + `AUDIT-app-personal.md` (2026-07-07).
> Para arrancar la próxima sesión: **"ejecutá la Fase 5 del @docs/audits/BACKLOG.md"** (o la fase que toque).
> Verificación estándar: `npx tsc --noEmit` (0 errores) + `npm run build`. Commits atómicos por ítem o grupo.

## ✅ Ya hecho (no tocar)

- Fase 1: fix del calendario (agenda corrida un día) — commit `0da8bfe`
- Fase 2 completa: timezone en TODA la app (~30 puntos) — commits `af0a8da`, `01550a2`, `61e41b0`
- Score de hoy sin congelar + `financesScore` en `getStoredScore` — commit `01550a2`
- Quick wins: sync global, fast-paths sin IA, tareas por WhatsApp, morning summary con tareas, tira de vapes — commit `ac2d38d`
- Fase 3 completa (robustez, 6 ítems): claim atómico de pendings (`claimPending`/`claimVapePending` antes de efectos externos), error visible + INBOUND `FAILED` cuando el webhook explota, reminders de Calendar send-then-mark, flush de Axiom vía `after()` (y desinstalados `@axiomhq/logging`/`@axiomhq/nextjs`), `addTurns` para no perder turnos de memoria, y pendings que distinguen DB caída de "no hay pending" — commits `a942113`, `65df600`, `959990f`, `2792096`, `8158446`, `5248fcf`
- Fase 4 (seguridad/deps) 4.1–4.4: Next 15.5.20 + next-auth beta.31 vía `npm audit fix` (GHSA-26hh-7cqf-hhc6), webhook WhatsApp fail-closed en producción sin `WHATSAPP_APP_SECRET`, `CRON_SECRET` con `timingSafeEqual` (y `?secret=` deprecado con warn), historial de conversación movido del system prompt a `<historial>` en rol user — commits `15d29e0`, `f9323cd`, `0f4fe28`, `0a035e9`

---

## 🟠 Fase 4 — pendientes residuales

- **4.3 (acción manual del usuario):** en cron-job.org, cambiar los jobs de `?secret=` al header `x-cron-secret` y DESPUÉS rotar `CRON_SECRET` en Vercel (el viejo quedó en logs de acceso). El código ya soporta ambos y loguea warn cuando entra por query.
- **4.5** (Grande, planificar aparte con /spec) Migrar `next-pwa` → `@serwist/next`. Es lo único que destraba las 8 vulnerabilidades restantes de `npm audit` (cadena serialize-javascript → workbox → next-pwa).

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

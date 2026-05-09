# Skill: Dashboard + Scoring
> Sesión 2 — Dashboard principal y sistema de scoring

---

## Qué se hizo en esta sesión

Se construyó el dashboard principal (`/`) y el sistema completo de scoring. Todo el código es TypeScript estricto, sin datos hardcodeados en lógica de negocio. Los datos de módulos son reales desde la DB — si están vacíos se muestra un estado vacío, no un placeholder inventado. Solo el gráfico de tendencia usa datos mock cuando no hay scores guardados.

---

## Archivos creados/modificados

### Nuevos

| Archivo | Descripción |
|---------|-------------|
| `lib/scoring.ts` | Lógica completa de cálculo de scores por módulo |
| `app/api/scoring/today/route.ts` | GET — score de hoy (calcula si no existe) |
| `app/api/scoring/history/route.ts` | GET — histórico con period + rangos de fecha |
| `app/api/scoring/calculate/route.ts` | POST — recálculo forzado |
| `components/scoring/PeriodSelector.tsx` | Tabs diario/semanal/mensual |
| `components/scoring/GlobalScoreRing.tsx` | Anillo SVG animado del score global |
| `components/scoring/ScoreCardModule.tsx` | Card expandible con met/missed por módulo |
| `components/scoring/ScoreTrendChart.tsx` | Gráfico de líneas temporal (Recharts) |
| `components/scoring/ModuleToggle.tsx` | Toggle de módulos para el gráfico |
| `components/scoring/DailyScoreCard.tsx` | Card de un día en el historial |
| `components/scoring/ScoringDashboard.tsx` | Wrapper client del scoring en el dashboard |
| `components/scoring/ScoringHistoryClient.tsx` | Componente client completo de /scoring |
| `components/dashboard/ModuleSummaryCard.tsx` | Card de resumen rápido por módulo |

### Modificados

| Archivo | Cambio |
|---------|--------|
| `app/(app)/page.tsx` | Reescritura completa del dashboard |
| `app/(app)/scoring/page.tsx` | Implementación completa de la página de historial |
| `agents/scoring/index.ts` | Implementación real con lib/scoring.ts |

---

## Lógica de scoring

### Criterios por módulo

**Sueño (/100)**
| Condición | Puntos |
|-----------|--------|
| Hay registro de sueño | +30 |
| Duración 7–9h (ideal) | +40 |
| Duración 6–7h ó 9–10h (aceptable) | +15 |
| Score de Garmin presente | +30 proporcional |

**Fitness (/100)**
| Condición | Puntos |
|-----------|--------|
| Workout registrado (base) | +60 |
| Fue al gym (tipo GYM) | +20 |
| Actividad cardiovascular extra | +20 |
| Duración total ≥ 45 min | +20 |

**Nutrición (/100)**
| Condición | Puntos |
|-----------|--------|
| Desayuno registrado | +20 |
| Almuerzo registrado | +30 |
| Cena registrada | +30 |
| Agua ≥ meta diaria | +20 |

**Proyectos (/100)**
| Condición | Puntos |
|-----------|--------|
| ≥ 1 proyecto en IN_PROGRESS | +30 |
| Tarea completada hoy | +40 |
| Proyecto actualizado hoy | +30 |

**Ideas (/100)**
| Condición | Puntos |
|-----------|--------|
| ≥ 1 idea capturada hoy | 100 (binario) |

**Global** = promedio de los módulos con datos (nulls excluidos)

### Comportamiento de null vs 0

Los módulos sin datos retornan `null`, no `0`. Esto permite distinguir entre "no hizo ejercicio (score 0)" y "no hay datos del módulo (null)". El global excluye nulls del promedio, así que no penaliza módulos no usados aún.

---

## Arquitectura de componentes

```
Dashboard (/page.tsx — Server Component)
  ├── loadTodayScore()        → calcula/lee score del día
  ├── loadModuleSummaries()   → lee resúmenes reales de la DB
  ├── ScoringDashboard        → Client Component
  │     ├── GlobalScoreRing   → SVG animado
  │     └── ScoreCardModule × 5  → Card expandible por módulo
  └── ModuleSummaryCard × 6  → Cards de acceso rápido

Scoring (/scoring/page.tsx — Server Component)
  ├── getScoreHistory()       → lee histórico de la DB
  ├── generateMockHistory()   → fallback si no hay datos
  └── ScoringHistoryClient    → Client Component
        ├── PeriodSelector    → Tabs
        ├── Stats (avg/max/min)
        ├── ScoreTrendChart   → Recharts LineChart
        │     ↑ ModuleToggle  → filtro de líneas
        └── DailyScoreCard × N → Cards del historial
```

---

## API Routes

### GET /api/scoring/today
- Lee el `DailyScore` de hoy de la DB
- Si no existe, llama a `calculateFullScore` + `saveScore`
- Retorna: `{ score: DailyScoreData, cached: boolean }`

### GET /api/scoring/history
Query params:
- `period`: `"daily"` (14d) | `"weekly"` (56d) | `"monthly"` (180d)
- `from`, `to`: ISO dates (override del rango)
- `mock=true`: fuerza datos de ejemplo
- Si no hay datos reales, devuelve mock transparentemente con `mock: true`

### POST /api/scoring/calculate
- Body: `{ date?: string }` — default hoy
- Fuerza recálculo y guarda en DB
- Útil para corregir retroactivamente

---

## Datos mock

La función `generateMockHistory(days)` en `lib/scoring.ts` genera datos semirandom con seed por fecha (misma sesión = mismos números). Se usa solo cuando no hay datos reales en la DB. Los componentes siempre muestran un aviso cuando están en modo mock.

---

## Animaciones implementadas

- **GlobalScoreRing:** SVG circle con `stroke-dashoffset` transicionado — el anillo "se llena" en 1s al montar
- **ScoreCardModule:** desplegable con `max-height` transition — animación CSS suave al expandir/colapsar
- **ScoreBar** (existente): barra con `width` transition de 700ms

---

## Agente de Scoring — nuevas funciones

```typescript
scoringAgent.calculateDailyScore(userId, date)  // calcula + guarda
scoringAgent.getTodayScore(userId)               // solo lee DB
scoringAgent.getHistorical(userId, period, from, to)
scoringAgent.recalculateWeek(userId)             // recalcula 7 días
scoringAgent.getSummaryText(userId, date)        // texto para Morning Summary (Sesión 8)
```

---

## Gráfico de tendencias (Recharts)

- Tipo: `LineChart` con `ResponsiveContainer`
- Datos: `HistoricalScoreEntry[]` — un punto por día/semana/mes
- Agregación: el Client Component hace la agregación semanal/mensual en memoria
- Módulos: toggle independiente, líneas con `strokeDasharray` para distinguirlas del global
- Tooltip: custom con fecha formateada en español y todos los valores

---

## Decisiones técnicas

| Decisión | Alternativa | Razón |
|----------|-------------|-------|
| Server Component carga datos en paralelo con `Promise.all` | Waterfall de fetches | Performance — dashboard carga en un solo round-trip |
| Scoring se calcula en el Server Component, no en el cliente | Solo API route | Evita loading state en el dashboard; el score se ve inmediatamente |
| `null` para módulos sin datos | `0` por defecto | Permite excluir módulos del promedio global honestamente |
| Datos mock en gráfico cuando no hay datos | Mostrar gráfico vacío | La UI se ve completa desde el primer día; el usuario entiende cómo funciona |
| Agregación temporal en cliente | En DB con SQL | Más simple, datos ya están en memoria, volumen personal es mínimo |
| `upsert` para guardar score | `create` + manejo de duplicados | Permite recalcular sin errores de constraint |
| `max-height` para desplegables | JS con altura calculada | CSS-only, sin reflows, funciona bien para contenido de altura variable |

---

## Cómo arrancar (sin cambios al flujo de Sesión 1)

```bash
# Sin cambios al schema de Prisma — no hay npm run db:push
npm run dev
# → / muestra dashboard con score calculado (vacío si no hay datos)
# → /scoring muestra historial (con mock si no hay datos reales)
```

---

*Sesión 2 completada — Mayo 2026*
*Próximo paso: Sesión 3 — Módulo de Sueño*

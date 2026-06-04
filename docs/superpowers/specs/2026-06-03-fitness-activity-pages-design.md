# Diseño — Páginas dedicadas por actividad (Fitness + Garmin)

> Fecha: 2026-06-03
> Estado: aprobado (brainstorming) — pendiente plan de implementación

## 1. Contexto

El módulo de fitness (`/fitness`, Next.js App Router, mobile-first, dark + cyan) hoy tiene:
- **`FitnessModuleClient`** con 3 tabs: **Hoy** / **Stats** / **Routines**.
- En **Hoy**: `StepsCard` (pasos Garmin), `GymRoutineCard` (rutina del día), `TodayWorkoutCard`, botón "Empezar workout vacío" → `/fitness/session`, **`FitnessQuickActions`** (fila de 5 pills: Gym/Correr/Nadar/Caminar/Bike + caja NLP), `GarminSyncButton`.
- En **Stats**: `WeeklyVolumeChart` + `WorkoutHistoryList` (14 días).
- En **Routines**: `RoutineManager`.
- Pantalla de sesión activa en `/fitness/session` (logger estilo Hevy, spec 2026-06-02).
- Modelo `Workout` (Prisma): `type` (WorkoutType: GYM/RUNNING/SWIMMING/WALKING/CYCLING/OTHER), `durationMinutes`, `distanceKm`, `calories`, `steps`, `title`, `source` (MANUAL/GARMIN), `garminActivityId`, `notes`, relación `exercises`. Pasos diarios en `DailySteps` (único por `userId+date`).
- Garmin (`lib/garmin.ts`): auth OAuth Bearer (migrada). `fetchGarminActivities` → `parseGarminActivity` → `upsertWorkoutFromGarmin`. `fetchGarminDailySteps`. `GARMIN_ACTIVITY_TYPE_MAP` mapea typeKeys → WorkoutType.

**Hallazgo clave (del JSON real del reloj del usuario):** Garmin devuelve por actividad muchas más métricas de las que hoy se guardan. Casi universales (presentes en la mayoría): `averageHR`, `maxHR`, `movingDuration`, `hrTimeInZone_1..5`, `elevationGain/Loss`, `averageSpeed`, `maxSpeed`. **Opcionales/frecuentemente ausentes:** `locationName` (solo en actividades con GPS/ubicación — falta en indoor/cortas), `vO2MaxValue` (solo en algunas), `avgStrideLength`. Específicas: correr/caminar (`averageRunningCadenceInStepsPerMinute`, `steps`), nado (`poolLength`, `activeLengths`, `averageSwolf`, `averageSwimCadenceInStrokesPerMinute`, `strokes`), y tipos no mapeados como `resort_snowboarding` (hoy caen en OTHER). `distance` viene en **metros**, `duration` en **segundos** con decimales, `averageSpeed` en **m/s**.

## 2. Objetivo

Convertir la fila "Registrar actividad" en un **menú de navegación**: cada actividad (Gym, Correr, Nadar, Caminar, Bici) abre una **página dedicada** con stats propias alimentadas por Garmin + registro manual. Las stats globales de `/fitness` se mantienen.

## 3. No objetivos (YAGNI)

- Página propia para snowboard u otras actividades fuera de las 5 (quedan en el feed global; el sync igual guarda sus métricas).
- Pantalla nueva de configuración de metas (se reusan `UserGoals`).
- Gráficos por métrica avanzados (ritmo histórico, etc.) más allá de los que ya existen.
- Mapas / polylines de recorrido.

## 4. Decisiones de diseño (del brainstorming)

| Decisión | Elección |
|---|---|
| Estructura `/fitness` | Mantener tabs **Hoy** / **Stats**; **quitar Routines** (migra a página Gym) — Opción B del mockup |
| Entrada a actividades | Las 5 pills de "Registrar actividad" navegan a `/fitness/<slug>` |
| Slugs | Español: `caminar`, `correr`, `nadar`, `bici`, `gym` |
| Header de cada página | `← Volver a fitness` + ícono/color de la actividad |
| Rol de cada página | **Stats + registrar, todo junto** (CTA registrar/empezar arriba) |
| Anillo de progreso | **Solo en Caminar** (pasos / meta) — Opción B |
| Stats visibles | Distancia + calorías siempre visibles; el resto en desplegable **"Más stats"** |
| Página Gym | **Absorbe** rutinas (`RoutineManager`) + empezar sesión + stats de gym recreadas |
| Metas | Configurables vía `UserGoals` con defaults; sin UI nueva por ahora |
| Snowboard / otros | Sin página propia; aparecen en el global |

## 5. Estructura de rutas y navegación

```
/fitness                      → FitnessModuleClient (tabs Hoy / Stats)
/fitness/caminar              → WALKING  (con anillo de pasos)
/fitness/correr               → RUNNING
/fitness/nadar                → SWIMMING
/fitness/bici                 → CYCLING
/fitness/gym                  → GYM (rutinas + empezar + stats gym)
/fitness/session              → (existente) sesión activa de gym
```

- Mapa slug ↔ WorkoutType en un módulo compartido (`lib/fitness-activities.ts`): `{ caminar: "WALKING", correr: "RUNNING", nadar: "SWIMMING", bici: "CYCLING", gym: "GYM" }`, con ícono, color y label por actividad (reusando los de `FitnessQuickActions`). **El label de CYCLING se unifica a "Bici"** (hoy `FitnessQuickActions` dice "Bike").
- **Implementación decidida (no se deja al plan):** ruta dinámica `app/(app)/fitness/[actividad]/page.tsx` para las **4 cardio** + ruta explícita `app/(app)/fitness/gym/page.tsx` para Gym. `/fitness/session` (existente) y `/fitness/gym` son estáticas → ganan sobre la dinámica (comportamiento correcto de Next App Router, sin conflicto de build). **Requisito duro:** el server component dinámico debe validar el slug contra el mapa y llamar `notFound()` si no existe, para evitar rutas fantasma (`/fitness/cualquiercosa`).
- `FitnessQuickActions` se simplifica: las pills pasan a ser `<Link>` a cada slug. El formulario inline de registro se **elimina de acá** y se reencarna como componente `ActivityLogForm` dentro de cada página (CTA "+ Registrar"). La caja NLP "Quick Log" se mantiene en el tab Hoy.

## 6. Template de página de actividad cardio (Correr / Nadar / Bici / Caminar)

Componente cliente reutilizable, p. ej. `ActivityPageClient`, parametrizado por tipo. Server component de la ruta carga datos con `Promise.all` y los pasa.

Estructura visual:
1. **Header**: `← Volver a fitness` (link a `/fitness`) + ícono/color + nombre.
2. **Hero** (solo Caminar): anillo de pasos del día (`StepsRing`, ver §8) — `pasos / meta`.
3. **Stats principales (2 cards, siempre visibles)**: distancia + calorías de la **última actividad del tipo**. Para Caminar, los pasos/anillo vienen de `DailySteps` (resumen diario) pero distancia/calorías vienen de la última actividad `WALKING` registrada — **puede haber pasos sin actividad WALKING** → en ese caso las cards muestran "—" (el anillo igual se llena). El template debe tolerar la ausencia de una actividad del tipo.
4. **CTA "+ Registrar"** (`ActivityLogForm`): form de registro manual que reusa `POST /api/fitness/workout`. Campos según tipo: duración (min) siempre; distancia para correr/caminar/bici en **km**; nado en **metros** (se convierte a km antes de postear, ya que el endpoint espera `distanceKm`). Tras registrar, `router.refresh()` para recargar el server component (mismo patrón que el resto del módulo, sin endpoint nuevo).
5. **Desplegable "Más stats"** (colapsado por default), con las métricas específicas del tipo:
   - **Correr / Caminar**: ritmo /km (de `averageSpeed`), FC media / FC máx, desnivel (`elevationGain`), cadencia, **zonas de FC** (barras de `hrTimeInZone_1..5`), VO2max si existe.
   - **Nadar**: largos (`activeLengths`), SWOLF (`averageSwolf`), brazadas (`strokes`), ritmo /100m, FC media / máx, largo de pileta (`poolLength`).
   - **Bici**: velocidad media / máx (km/h), FC media / máx, desnivel.
6. **"Esta semana"** (resumen): distancia total + cantidad de actividades del tipo en la semana.
7. **Historial**: lista de actividades de ese tipo (con `locationName` si existe, si no el título/fecha; distancia, duración).

### Derivaciones de métricas
- **Ritmo (min/km)** = `1000 / averageSpeed` segundos → `mm:ss`. Para nado, **ritmo /100m** = `100 / averageSpeed`.
- **Velocidad (km/h)** = `averageSpeed * 3.6`.
- **Distancia (km)** = `distance / 1000` (redondeo 1–2 decimales).
- **Duración** = `Math.round(duration)` s → min.
- Tolerar `0`/`null` (p. ej. nado con `distance: 0`, o actividades sin GPS).

## 7. Página de Gym

`/fitness/gym` — componente cliente propio (no usa el template cardio). Contiene:
- **Header** `← Volver a fitness` + ícono/color Gym.
- **CTA "Empezar sesión"** → `/fitness/session` (vacío) y "Empezar rutina" desde la rutina del día.
- **Rutinas**: el `RoutineManager` se muda acá (se quita del tab Routines de `/fitness`).
- **Stats de gym recreadas**: sesiones esta semana, **volumen total (kg)**, **PRs** recientes, frecuencia (sesiones/semana), historial de sesiones de gym. Reusa helpers existentes de `lib/fitness.ts` (`exerciseVolume`, `getRoutinesWithLastPerformance`, etc.) y datos de `Workout` type GYM + `WorkoutExercise`/`WorkoutSet`.
- `FitnessModuleClient` deja de renderizar el tab **Routines** (TABS pasa a `[Hoy, Stats]`).

## 8. Componente `StepsRing` (anillo estilo iPhone)

- Anillo circular SVG (o conic-gradient) que se llena según `pasos / meta`.
- Color verde de la actividad Caminar (`#34D399`).
- Centro: número de pasos grande + "de N pasos".
- Meta desde `UserGoals.fitnessDailyStepsGoal` (default 8000).
- Se puede extraer de / reemplazar el `StepsCard` actual, manteniendo `StepsCard` en el tab Hoy o reusando el anillo en ambos lugares.

## 9. Capa de datos — modelo `Workout`

Agregar columnas (vía SQL directo en Supabase — `prisma db push` falla; luego `npm run db:generate`):

**Universales (columnas explícitas):**
- `avgHr Int?`
- `maxHr Int?`
- `elevationGainM Int?`
- `avgSpeedMps Float?`
- `maxSpeedMps Float?`
- `movingSeconds Int?`
- `cadence Float?`            // SOLO running cadence (spm). La cadencia de nado va en garminMetrics.swimCadence — no se duplica acá.
- `locationName String?`     // opcional, frecuentemente ausente (solo GPS). UI usa fallback al título/"—".

**Específicas / menos comunes (un solo campo JSON para no inflar el schema):**
- `garminMetrics Json?` con, según tipo:
  - `hrZones`: `[z1..z5]` segundos (de `hrTimeInZone_1..5`)
  - `vo2Max`: number
  - `strideLengthCm`: number
  - nado: `poolLengthM`, `activeLengths`, `avgSwolf`, `strokes`, `swimCadence`

> Nota de estilo: el repo usa columnas explícitas. Se usa `Json?` solo para el subconjunto de métricas raras/por-tipo, manteniendo explícitas las universales que se muestran siempre. Confirmar en el plan si se prefieren todas explícitas.

## 10. Capa de datos — parsing y sync (`lib/garmin.ts`)

- **`GarminActivityData`**: extender el tipo con los campos nuevos.
- **`parseGarminActivity`**: extraer `averageHR`, `maxHR`, `elevationGain`, `averageSpeed`, `maxSpeed`, `movingDuration`, cadencia (running/swim), `locationName`, `hrTimeInZone_1..5`, `vO2MaxValue`, `avgStrideLength`, y campos de nado. Tolerar ausencias.
- **`GARMIN_ACTIVITY_TYPE_MAP`**: agregar `resort_snowboarding` y otros faltantes. Los que no encajen en las 5 → `OTHER` (quedan en el global).
- **`upsertWorkoutFromGarmin` — política de merge (corregida):** el merge actual NO protege datos manuales como se creía; un workout MANUAL nunca tiene `garminActivityId` (así que jamás se toca), y un workout GARMIN se reescribe entero en cada re-sync. Política explícita para las columnas nuevas:
  - Las **métricas de hardware** (avgHr, maxHr, elevation, speed, moving, cadence, locationName, `garminMetrics`) tienen a **Garmin como fuente de verdad** → se escriben siempre en el UPDATE (un re-sync las refresca, está OK).
  - Los **campos editables por el usuario** sobre una actividad importada (`notes`, y `title` si el usuario lo cambió) **NO se incluyen en el UPDATE** para no pisar ediciones manuales en re-syncs. (Hoy `title` sí se setea en el create; en el update conviene dejarlo fuera o solo setearlo si está vacío.)
- `fetchGarminDailySteps` ya provee los pasos para el anillo de Caminar (sin cambios).

## 11. APIs

- **Decidido:** sin endpoint nuevo. La carga inicial de cada página de actividad la hace su **server component** (con `Promise.all` sobre helpers de `lib/fitness.ts`), y tras registrar manual se hace `router.refresh()`. Esto evita superficie de API extra y es consistente con el resto del módulo.
- `POST /api/fitness/workout` (existente) sigue manejando el registro manual desde el CTA.
- `POST /api/fitness/sync-garmin` (existente) ahora persiste las métricas nuevas automáticamente.

## 12. Componentes (nuevos / modificados)

**Nuevos:**
- `app/(app)/fitness/[actividad]/page.tsx` (cardio dinámica) — server component, carga + valida slug.
- `app/(app)/fitness/gym/page.tsx` — server component Gym.
- `components/fitness/ActivityPageClient.tsx` — template cardio.
- `components/fitness/GymPageClient.tsx` — página Gym.
- `components/fitness/StepsRing.tsx` — anillo de pasos.
- `components/fitness/ActivityStatsDisclosure.tsx` — desplegable "Más stats".
- `components/fitness/HrZonesBar.tsx` — barras de zonas de FC.
- `components/fitness/ActivityLogForm.tsx` — form de registro manual por tipo (CTA "+ Registrar"; unidades por tipo, ver §6.4).
- `lib/fitness-activities.ts` — mapa slug↔tipo + meta visual (ícono/color/label).

**Modificados:**
- `FitnessQuickActions.tsx` → pills como `<Link>`; quitar form inline (se mueve a las páginas).
- `FitnessModuleClient.tsx` → TABS sin Routines.
- `lib/garmin.ts` → parsing/sync extendidos.
- `prisma/schema.prisma` → columnas nuevas en `Workout`.
- `lib/fitness.ts` → **helpers nuevos** (se crean desde cero): agregación por tipo (resumen semanal `{distanceKm, count}`, última actividad del tipo con métricas, historial del tipo) y stats de gym (sesiones/semana, volumen total, PRs, frecuencia) si no existen. Todas filtran por `type` y rango de fecha.

## 13. Verificación

- `npx tsc --noEmit` en 0 errores + `npm run build`.
- SQL aplicado en Supabase + `npm run db:generate`.
- Prueba manual con Garmin: el usuario ofrece hacer actividades cortas (mover el brazo) para validar qué llega por tipo; sync y ver que las métricas aparecen en cada página.
- Caminar: el anillo refleja `DailySteps` del día vs meta.

## 14. Riesgos / notas

- `prisma db push` falla con Supabase → schema por SQL directo (gotcha conocido).
- Si Garmin no manda una métrica para cierta actividad (p. ej. nado sin pileta configurada), la UI debe ocultar/“—” esa stat, no romper.
- El sync histórico no recalcula actividades viejas salvo re-sync; las métricas nuevas aparecen al volver a sincronizar el rango.

# Páginas dedicadas por actividad (Fitness + Garmin) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir la fila "Registrar actividad" de `/fitness` en un menú que abre una página dedicada por actividad (Caminar/Correr/Nadar/Bici/Gym), cada una con stats alimentadas por Garmin + registro manual.

**Architecture:** Ruta dinámica `app/(app)/fitness/[actividad]/page.tsx` (server component) para las 4 cardio + `gym/page.tsx` explícita. Cada server component carga datos con `Promise.all` sobre helpers nuevos de `lib/fitness.ts` y los pasa a un client component. Garmin gana columnas nuevas en `Workout` (universales explícitas + `garminMetrics` JSON para lo raro). Sin endpoints nuevos: mutaciones manuales reusan `POST /api/fitness/workout` + `router.refresh()`.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind (dark + cyan), Prisma/Supabase, lucide-react, Recharts (ya presente).

**Verificación (este repo NO tiene framework de tests):** la verificación de cada tarea es `npx tsc --noEmit` en 0 errores. Al final, `npm run build` + prueba manual con Garmin. No escribir tests unitarios (no hay runner).

**Spec de referencia:** `docs/superpowers/specs/2026-06-03-fitness-activity-pages-design.md`

---

## File Structure

**Crear:**
- `lib/fitness-activities.ts` — mapa slug↔WorkoutType + meta visual (ícono/color/label) + helpers de slug.
- `app/(app)/fitness/[actividad]/page.tsx` — server component cardio (valida slug, carga datos, `notFound()`).
- `app/(app)/fitness/gym/page.tsx` — server component Gym.
- `components/fitness/ActivityPageClient.tsx` — template cardio (header, hero, stats, CTA, disclosure, historial).
- `components/fitness/GymPageClient.tsx` — página Gym (CTA empezar, rutinas, stats gym, historial).
- `components/fitness/StepsRing.tsx` — anillo de pasos estilo iPhone (SVG).
- `components/fitness/HrZonesBar.tsx` — barras de zonas de FC.
- `components/fitness/ActivityStatsDisclosure.tsx` — desplegable "Más stats".
- `components/fitness/ActivityLogForm.tsx` — form de registro manual por tipo.

**Modificar:**
- `prisma/schema.prisma` — columnas nuevas en `Workout`.
- `lib/garmin.ts` — `GarminActivityData`, `parseGarminActivity`, `GARMIN_ACTIVITY_TYPE_MAP`, `upsertWorkoutFromGarmin`.
- `lib/fitness.ts` — helpers nuevos de agregación por tipo + stats de gym; `WorkoutWithExercises` con campos nuevos.
- `components/fitness/FitnessQuickActions.tsx` — pills → `<Link>`, quitar form inline.
- `components/fitness/FitnessModuleClient.tsx` — quitar tab Routines.

---

## FASE 1 — Capa de datos (Garmin + schema)

### Task 1: Columnas nuevas en `Workout`

**Files:**
- Modify: `prisma/schema.prisma` (modelo `Workout`)
- SQL: Supabase SQL Editor (gotcha: `db push` falla)

- [ ] **Step 1: Aplicar SQL en Supabase SQL Editor**

```sql
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS "avgHr" INTEGER;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS "maxHr" INTEGER;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS "elevationGainM" INTEGER;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS "avgSpeedMps" DOUBLE PRECISION;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS "maxSpeedMps" DOUBLE PRECISION;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS "movingSeconds" INTEGER;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS "cadence" DOUBLE PRECISION;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS "locationName" TEXT;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS "garminMetrics" JSONB;
```

- [ ] **Step 2: Reflejar en `prisma/schema.prisma`** (dentro de `model Workout`, después de `steps Int?`)

```prisma
  // Métricas Garmin por actividad (sesión activity-pages)
  avgHr          Int?
  maxHr          Int?
  elevationGainM Int?
  avgSpeedMps    Float?
  maxSpeedMps    Float?
  movingSeconds  Int?
  cadence        Float?   // SOLO running cadence (spm); swim cadence va en garminMetrics
  locationName   String?
  garminMetrics  Json?    // hrZones[5], vo2Max, strideLengthCm, nado: poolLengthM/activeLengths/avgSwolf/strokes/swimCadence
```

- [ ] **Step 3: Regenerar Prisma Client**

Run: `npm run db:generate`
Expected: "Generated Prisma Client" sin errores.

- [ ] **Step 4: Verificar tipado**

Run: `npx tsc --noEmit`
Expected: 0 errores (los campos nuevos existen en el client).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(fitness): columnas Garmin por actividad en Workout"
```

---

### Task 2: Tipo `GarminMetrics` + extender `GarminActivityData` y `parseGarminActivity`

**Files:**
- Modify: `lib/garmin.ts` (sección ACTIVIDADES, ~líneas 534-626)

- [ ] **Step 1: Extender el tipo `GarminActivityData`** — agregar campos opcionales:

```ts
export type GarminActivityMetrics = {
  hrZones?: number[];          // [z1..z5] segundos
  vo2Max?: number;
  strideLengthCm?: number;
  poolLengthM?: number;
  activeLengths?: number;
  avgSwolf?: number;
  strokes?: number;
  swimCadence?: number;
};

export type GarminActivityData = {
  garminActivityId: string;
  date: Date;
  title: string;
  type: "GYM" | "RUNNING" | "SWIMMING" | "WALKING" | "CYCLING" | "OTHER";
  durationSeconds: number;
  distanceMeters: number | null;
  calories: number | null;
  steps: number | null;
  startTimeGMT: Date;
  // nuevos
  avgHr: number | null;
  maxHr: number | null;
  elevationGainM: number | null;
  avgSpeedMps: number | null;
  maxSpeedMps: number | null;
  movingSeconds: number | null;
  cadence: number | null;       // running spm
  locationName: string | null;
  metrics: GarminActivityMetrics | null;
};
```

- [ ] **Step 2: Reescribir `parseGarminActivity`** para extraer lo nuevo (tolerando ausencias):

```ts
function parseGarminActivity(
  item: Record<string, unknown>
): GarminActivityData | null {
  const id = item.activityId;
  if (!id) return null;

  const typeKey =
    ((item.activityType as Record<string, unknown>)?.typeKey as string) ?? "other";
  const type = GARMIN_ACTIVITY_TYPE_MAP[typeKey] ?? "OTHER";

  const startTimeStr = item.startTimeGMT as string | undefined;
  if (!startTimeStr) return null;
  const startTimeGMT = new Date(startTimeStr.replace(" ", "T") + "Z");

  const num = (k: string): number | null => {
    const v = item[k];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };

  const zones = [1, 2, 3, 4, 5].map((z) => num(`hrTimeInZone_${z}`) ?? 0);
  const hasZones = zones.some((z) => z > 0);

  const metrics: GarminActivityMetrics = {};
  if (hasZones) metrics.hrZones = zones;
  if (num("vO2MaxValue") !== null) metrics.vo2Max = num("vO2MaxValue")!;
  if (num("avgStrideLength") !== null) metrics.strideLengthCm = num("avgStrideLength")!;
  if (num("poolLength") !== null) metrics.poolLengthM = num("poolLength")!;
  if (num("activeLengths") !== null) metrics.activeLengths = num("activeLengths")!;
  if (num("averageSwolf") !== null) metrics.avgSwolf = num("averageSwolf")!;
  if (num("strokes") !== null) metrics.strokes = num("strokes")!;
  if (num("averageSwimCadenceInStrokesPerMinute") !== null)
    metrics.swimCadence = num("averageSwimCadenceInStrokesPerMinute")!;

  return {
    garminActivityId: String(id),
    date: startTimeGMT,
    title: (item.activityName as string) ?? type,
    type,
    durationSeconds: Math.round((item.duration as number) ?? 0),
    distanceMeters: num("distance"),
    calories: num("calories"),
    steps: num("steps"),
    startTimeGMT,
    avgHr: num("averageHR"),
    maxHr: num("maxHR"),
    elevationGainM: num("elevationGain") !== null ? Math.round(num("elevationGain")!) : null,
    avgSpeedMps: num("averageSpeed"),
    maxSpeedMps: num("maxSpeed"),
    movingSeconds: num("movingDuration") !== null ? Math.round(num("movingDuration")!) : null,
    cadence: num("averageRunningCadenceInStepsPerMinute"),
    locationName: (item.locationName as string) ?? null,
    metrics: Object.keys(metrics).length ? metrics : null,
  };
}
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 4: Commit**

```bash
git add lib/garmin.ts
git commit -m "feat(garmin): parsear métricas ricas por actividad (FC, desnivel, velocidad, nado, zonas)"
```

---

### Task 3: Mapear `resort_snowboarding` y typeKeys faltantes

**Files:**
- Modify: `lib/garmin.ts` (`GARMIN_ACTIVITY_TYPE_MAP`, ~líneas 546-569)

- [ ] **Step 1: Agregar entradas** al objeto `GARMIN_ACTIVITY_TYPE_MAP`:

```ts
  resort_snowboarding: "OTHER",
  resort_skiing: "OTHER",
  backcountry_snowboarding: "OTHER",
  mountain_biking: "CYCLING",
  gravel_cycling: "CYCLING",
  cyclocross: "CYCLING",
  elliptical: "GYM",
  stair_climbing: "GYM",
```

(Los `OTHER` quedan en el feed global; no rompen nada.)

- [ ] **Step 2: Verificar y commit**

Run: `npx tsc --noEmit` → 0 errores.

```bash
git add lib/garmin.ts
git commit -m "feat(garmin): mapear snowboard y más typeKeys de actividad"
```

---

### Task 4: Persistir métricas en `upsertWorkoutFromGarmin` (con política de merge)

**Files:**
- Modify: `lib/fitness.ts` (`upsertWorkoutFromGarmin`, ~líneas 1314-1360); su firma del parámetro `activity`.

- [ ] **Step 1: Ampliar el tipo del parámetro `activity`** para aceptar los campos nuevos (importar/replicar de `GarminActivityData`). Reemplazar el inline type por:

```ts
export async function upsertWorkoutFromGarmin(
  userId: string,
  activity: import("@/lib/garmin").GarminActivityData
): Promise<void> {
```

- [ ] **Step 2: Calcular y armar el bloque de métricas** dentro de la función (antes del `if (existing)`):

```ts
  const durationMinutes = Math.round(activity.durationSeconds / 60);
  const distanceKm = activity.distanceMeters ? activity.distanceMeters / 1000 : null;

  // Métricas hardware: Garmin es fuente de verdad → se escriben siempre.
  const garminFields = {
    durationMinutes,
    ...(distanceKm !== null && { distanceKm }),
    ...(activity.calories !== null && { calories: activity.calories }),
    avgHr: activity.avgHr,
    maxHr: activity.maxHr,
    elevationGainM: activity.elevationGainM,
    avgSpeedMps: activity.avgSpeedMps,
    maxSpeedMps: activity.maxSpeedMps,
    movingSeconds: activity.movingSeconds,
    cadence: activity.cadence,
    locationName: activity.locationName,
    steps: activity.steps,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    garminMetrics: (activity.metrics ?? undefined) as any,
  };
```

- [ ] **Step 3: Reescribir las ramas update/create.** En `update` usar SOLO `garminFields` (NO incluir `title`/`notes` → preserva ediciones manuales). En `create` incluir `garminFields` + `title`/`source`:

```ts
  const existing = await db.workout.findFirst({
    where: { garminActivityId: activity.garminActivityId },
  });

  if (existing) {
    await db.workout.update({
      where: { id: existing.id },
      data: garminFields as Parameters<typeof db.workout.update>[0]["data"],
    });
  } else {
    await db.workout.create({
      data: {
        userId,
        date: activity.date,
        type: activity.type,
        garminActivityId: activity.garminActivityId,
        title: activity.title,
        source: "GARMIN",
        ...garminFields,
      } as Parameters<typeof db.workout.create>[0]["data"],
    });
  }
```

- [ ] **Step 4: Verificar y commit**

Run: `npx tsc --noEmit` → 0 errores.

```bash
git add lib/fitness.ts
git commit -m "feat(fitness): persistir métricas Garmin con merge que respeta ediciones manuales"
```

---

### Task 5: `lib/fitness-activities.ts` (mapa slug ↔ tipo + meta visual)

**Files:**
- Create: `lib/fitness-activities.ts`

- [ ] **Step 1: Crear el archivo**

```ts
// lib/fitness-activities.ts
// Mapa slug ↔ WorkoutType + metadata visual de cada actividad del menú.

export type ActivitySlug = "caminar" | "correr" | "nadar" | "bici" | "gym";
export type ActivityWorkoutType = "WALKING" | "RUNNING" | "SWIMMING" | "CYCLING" | "GYM";

export type ActivityMeta = {
  slug: ActivitySlug;
  type: ActivityWorkoutType;
  label: string;
  icon: string;   // material-symbols
  color: string;  // hex
  isCardio: boolean;
};

export const ACTIVITIES: Record<ActivitySlug, ActivityMeta> = {
  gym:     { slug: "gym",     type: "GYM",      label: "Gym",     icon: "fitness_center",  color: "#06B6D4", isCardio: false },
  correr:  { slug: "correr",  type: "RUNNING",  label: "Correr",  icon: "directions_run",  color: "#FB923C", isCardio: true },
  nadar:   { slug: "nadar",   type: "SWIMMING", label: "Nadar",   icon: "pool",            color: "#60A5FA", isCardio: true },
  caminar: { slug: "caminar", type: "WALKING",  label: "Caminar", icon: "directions_walk", color: "#34D399", isCardio: true },
  bici:    { slug: "bici",    type: "CYCLING",  label: "Bici",    icon: "pedal_bike",      color: "#A78BFA", isCardio: true },
};

export const ACTIVITY_ORDER: ActivitySlug[] = ["gym", "correr", "nadar", "caminar", "bici"];

export function getActivityBySlug(slug: string): ActivityMeta | null {
  return (ACTIVITIES as Record<string, ActivityMeta>)[slug] ?? null;
}
```

- [ ] **Step 2: Verificar y commit**

Run: `npx tsc --noEmit` → 0 errores.

```bash
git add lib/fitness-activities.ts
git commit -m "feat(fitness): mapa de actividades (slug, tipo, meta visual)"
```

---

### Task 6: Helpers de agregación por tipo + stats de gym

**Files:**
- Modify: `lib/fitness.ts` (agregar al final, antes de cierre; y extender `WorkoutWithExercises`)

- [ ] **Step 1: Extender `WorkoutWithExercises`** (líneas 14-29) con los campos nuevos (todos opcionales para no romper consumidores):

```ts
  avgHr: number | null;
  maxHr: number | null;
  elevationGainM: number | null;
  avgSpeedMps: number | null;
  maxSpeedMps: number | null;
  movingSeconds: number | null;
  cadence: number | null;
  locationName: string | null;
  garminMetrics: unknown | null;
```

> Nota: si los `select`/`include` de Prisma usados por los getters existentes no traen estos campos por default, revisar que devuelvan el row completo (los getters que hacen `db.workout.findMany()` sin `select` ya los incluyen).

- [ ] **Step 2: Agregar tipos y helpers nuevos**

```ts
export type ActivityTypeSummary = {
  weekDistanceKm: number;
  weekCount: number;
  weekDurationMin: number;
};

const startOfWeek = (d: Date): Date => {
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7; // lunes=0
  x.setDate(x.getDate() - day);
  return x;
};

/** Resumen de la semana actual para un tipo de actividad. */
export async function getActivityWeekSummary(
  userId: string,
  type: LogActivityInput["type"]
): Promise<ActivityTypeSummary> {
  const from = startOfWeek(new Date());
  const rows = await db.workout.findMany({
    where: { userId, type, date: { gte: from } },
  });
  return {
    weekDistanceKm: rows.reduce((s, w) => s + (w.distanceKm ?? 0), 0),
    weekCount: rows.length,
    weekDurationMin: rows.reduce((s, w) => s + (w.durationMinutes ?? 0), 0),
  };
}

/** Última actividad registrada de un tipo (con exercises para gym). */
export async function getLastActivityOfType(
  userId: string,
  type: LogActivityInput["type"]
): Promise<WorkoutWithExercises | null> {
  const w = await db.workout.findFirst({
    where: { userId, type },
    orderBy: { date: "desc" },
    include: { exercises: { include: { sets: true }, orderBy: { order: "asc" } } },
  });
  return (w as unknown as WorkoutWithExercises) ?? null;
}

/** Historial de un tipo (N más recientes). */
export async function getActivityHistory(
  userId: string,
  type: LogActivityInput["type"],
  limit = 20
): Promise<WorkoutWithExercises[]> {
  const rows = await db.workout.findMany({
    where: { userId, type },
    orderBy: { date: "desc" },
    take: limit,
    include: { exercises: { include: { sets: true }, orderBy: { order: "asc" } } },
  });
  return rows as unknown as WorkoutWithExercises[];
}

export type GymStats = {
  weekSessions: number;
  totalVolumeKg: number;   // volumen de la última sesión
  weekVolumeKg: number;    // volumen acumulado de la semana
};

/** Stats de gym recreadas para la página de Gym. */
export async function getGymStats(userId: string): Promise<GymStats> {
  const from = startOfWeek(new Date());
  const sessions = await db.workout.findMany({
    where: { userId, type: "GYM", date: { gte: from } },
    include: { exercises: { include: { sets: true } } },
  });
  const volOf = (w: (typeof sessions)[number]) =>
    w.exercises.reduce(
      (s, e) => s + e.sets.reduce((ss, set) => ss + (set.weightKg ?? 0) * (set.reps ?? 0), 0),
      0
    );
  return {
    weekSessions: sessions.length,
    totalVolumeKg: sessions.length ? Math.round(volOf(sessions[0])) : 0,
    weekVolumeKg: Math.round(sessions.reduce((s, w) => s + volOf(w), 0)),
  };
}
```

> Si `startOfDay` no está exportado/accesible en ese scope, ya existe como helper interno (línea 112) — reusarlo.

- [ ] **Step 3: Verificar y commit**

Run: `npx tsc --noEmit` → 0 errores.

```bash
git add lib/fitness.ts
git commit -m "feat(fitness): helpers de agregación por tipo y stats de gym"
```

---

## FASE 2 — Navegación

### Task 7: Pills de `FitnessQuickActions` → links, quitar form inline

**Files:**
- Modify: `components/fitness/FitnessQuickActions.tsx`

- [ ] **Step 1: Reemplazar el bloque "Activity pills"** para que cada pill sea un `<Link href={/fitness/<slug>}>`. Usar `ACTIVITY_ORDER`/`ACTIVITIES` de `@/lib/fitness-activities`. Eliminar: estado `selectedActivity`, `duration`, `distance`, `handleActivity`, `handleGym`, `needsDistance`, y el `<form>` inline. Mantener la sección NLP "Quick Log" intacta.

```tsx
import Link from "next/link";
import { ACTIVITY_ORDER, ACTIVITIES } from "@/lib/fitness-activities";
// ...
<div className="glass-card rounded-2xl p-4 space-y-3">
  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
    Registrar actividad
  </span>
  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
    {ACTIVITY_ORDER.map((slug) => {
      const a = ACTIVITIES[slug];
      return (
        <Link
          key={slug}
          href={`/fitness/${slug}`}
          className="flex-shrink-0 flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-xl transition-all active:scale-90"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: a.color }}
        >
          <span className="material-symbols-outlined text-[22px]">{a.icon}</span>
          <span className="text-[11px] font-semibold">{a.label}</span>
        </Link>
      );
    })}
  </div>
</div>
```

- [ ] **Step 2: Verificar y commit**

Run: `npx tsc --noEmit` → 0 errores (ojo con imports y `loading` ahora solo `"nlp"`).

```bash
git add components/fitness/FitnessQuickActions.tsx
git commit -m "feat(fitness): pills de actividad navegan a su página dedicada"
```

---

### Task 8: Quitar tab Routines de `FitnessModuleClient`

**Files:**
- Modify: `components/fitness/FitnessModuleClient.tsx`

- [ ] **Step 1:** Cambiar `type Tab = "hoy" | "stats" | "rutinas"` → `"hoy" | "stats"`. Quitar la entrada `{ id: "rutinas", label: "Routines" }` de `TABS`. Eliminar el bloque `{tab === "rutinas" && (...)}` y el import de `RoutineManager`. (El RoutineManager se reutiliza en la página Gym — Task 15.)

- [ ] **Step 2: Verificar y commit**

Run: `npx tsc --noEmit` → 0 errores.

```bash
git add components/fitness/FitnessModuleClient.tsx
git commit -m "feat(fitness): quitar tab Routines (migra a página Gym)"
```

---

## FASE 3 — Componentes compartidos

### Task 9: `StepsRing`

**Files:**
- Create: `components/fitness/StepsRing.tsx`

- [ ] **Step 1: Crear componente** (anillo SVG, color por prop, default verde):

```tsx
"use client";

type Props = { steps: number; goal: number; color?: string };

export default function StepsRing({ steps, goal, color = "#34D399" }: Props) {
  const pct = goal > 0 ? Math.min(steps / goal, 1) : 0;
  const reached = steps >= goal;
  const R = 70, C = 2 * Math.PI * R;
  return (
    <div className="flex justify-center my-4">
      <div className="relative w-[180px] h-[180px]">
        <svg width="180" height="180" className="-rotate-90">
          <circle cx="90" cy="90" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
          <circle
            cx="90" cy="90" r={R} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - pct)}
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-on-surface">{steps.toLocaleString("es-UY")}</span>
          <span className="text-xs" style={{ color }}>
            {reached ? "Meta cumplida ✓" : `de ${goal.toLocaleString("es-UY")} pasos`}
          </span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar y commit**

Run: `npx tsc --noEmit` → 0 errores.

```bash
git add components/fitness/StepsRing.tsx
git commit -m "feat(fitness): componente StepsRing (anillo de pasos)"
```

---

### Task 10: `HrZonesBar`

**Files:**
- Create: `components/fitness/HrZonesBar.tsx`

- [ ] **Step 1: Crear componente** (5 barras proporcionales a los segundos por zona):

```tsx
"use client";

const ZONE_COLORS = ["#60A5FA", "#34D399", "#FBBF24", "#FB923C", "#EF4444"];

export default function HrZonesBar({ zones }: { zones: number[] }) {
  const max = Math.max(...zones, 1);
  return (
    <div>
      <div className="flex gap-1 h-9 items-end">
        {zones.map((z, i) => (
          <div
            key={i}
            className="flex-1 rounded-t"
            style={{ height: `${Math.max((z / max) * 100, 4)}%`, background: ZONE_COLORS[i] }}
            title={`Z${i + 1}: ${Math.round(z / 60)} min`}
          />
        ))}
      </div>
      <div className="flex gap-1 mt-1">
        {zones.map((_, i) => (
          <span key={i} className="flex-1 text-center text-[9px] text-on-surface-variant">Z{i + 1}</span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar y commit**

Run: `npx tsc --noEmit` → 0 errores.

```bash
git add components/fitness/HrZonesBar.tsx
git commit -m "feat(fitness): componente HrZonesBar (zonas de FC)"
```

---

### Task 11: `ActivityStatsDisclosure`

**Files:**
- Create: `components/fitness/ActivityStatsDisclosure.tsx`

- [ ] **Step 1: Crear componente** desplegable genérico:

```tsx
"use client";
import { useState, type ReactNode } from "react";

export default function ActivityStatsDisclosure({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex justify-between items-center glass-card rounded-xl px-4 py-3 text-sm font-semibold text-on-surface"
      >
        <span>Más stats</span>
        <span className="material-symbols-outlined text-[18px]">{open ? "expand_less" : "expand_more"}</span>
      </button>
      {open && <div className="space-y-3">{children}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Verificar y commit**

Run: `npx tsc --noEmit` → 0 errores.

```bash
git add components/fitness/ActivityStatsDisclosure.tsx
git commit -m "feat(fitness): componente ActivityStatsDisclosure"
```

---

### Task 12: `ActivityLogForm`

**Files:**
- Create: `components/fitness/ActivityLogForm.tsx`

- [ ] **Step 1: Crear componente** de registro manual por tipo (nado en metros → convierte a km):

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ActivityMeta } from "@/lib/fitness-activities";

export default function ActivityLogForm({ activity }: { activity: ActivityMeta }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [duration, setDuration] = useState("");
  const [dist, setDist] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isSwim = activity.type === "SWIMMING";
  const needsDist = ["RUNNING", "SWIMMING", "CYCLING", "WALKING"].includes(activity.type);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErr(null);
    try {
      const distanceKm = dist ? (isSwim ? parseFloat(dist) / 1000 : parseFloat(dist)) : undefined;
      const res = await fetch("/api/fitness/workout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: activity.type,
          ...(duration && { durationMinutes: parseInt(duration) }),
          ...(distanceKm !== undefined && { distanceKm }),
        }),
      });
      if (!res.ok) throw new Error();
      setOpen(false); setDuration(""); setDist("");
      router.refresh();
    } catch {
      setErr("Error al registrar");
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-3 rounded-full font-bold text-sm text-[#0D0F14] active:scale-95 transition-all"
        style={{ background: activity.color }}
      >
        + Registrar {activity.label.toLowerCase()}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="glass-card rounded-2xl p-4 space-y-2">
      <div className={`grid gap-2 ${needsDist ? "grid-cols-2" : "grid-cols-1"}`}>
        <div>
          <label className="text-xs text-on-surface-variant mb-1 block">Duración (min)</label>
          <input type="number" min="1" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="45" className="input text-base" />
        </div>
        {needsDist && (
          <div>
            <label className="text-xs text-on-surface-variant mb-1 block">{isSwim ? "Distancia (m)" : "Distancia (km)"}</label>
            <input type="number" step={isSwim ? "10" : "0.1"} min="0" value={dist} onChange={(e) => setDist(e.target.value)} placeholder={isSwim ? "1000" : "5.0"} className="input text-base" />
          </div>
        )}
      </div>
      {err && <p className="text-xs text-red-400">{err}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2 rounded-full text-sm font-semibold text-on-surface-variant bg-white/5">Cancelar</button>
        <button type="submit" disabled={loading} className="flex-1 py-2 rounded-full text-sm font-bold text-[#0D0F14] disabled:opacity-60" style={{ background: activity.color }}>
          {loading ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Verificar y commit**

Run: `npx tsc --noEmit` → 0 errores.

```bash
git add components/fitness/ActivityLogForm.tsx
git commit -m "feat(fitness): componente ActivityLogForm (registro manual por tipo)"
```

---

## FASE 4 — Páginas cardio

### Task 13: `ActivityPageClient` (template cardio)

**Files:**
- Create: `components/fitness/ActivityPageClient.tsx`

- [ ] **Step 1: Crear el template.** Recibe `activity`, `last` (última actividad del tipo o null), `week` (summary), `history`, y para caminar `steps`/`goal`. Renderiza header con back, hero (StepsRing solo si `activity.type === "WALKING"`), 2 stats principales (distancia/calorías de `last`, "—" si null), `ActivityLogForm`, `ActivityStatsDisclosure` con stats derivadas + `HrZonesBar`, resumen semanal, e historial.

```tsx
"use client";
import Link from "next/link";
import type { ActivityMeta } from "@/lib/fitness-activities";
import type { WorkoutWithExercises, ActivityTypeSummary } from "@/lib/fitness";
import StepsRing from "./StepsRing";
import ActivityLogForm from "./ActivityLogForm";
import ActivityStatsDisclosure from "./ActivityStatsDisclosure";
import HrZonesBar from "./HrZonesBar";

type Props = {
  activity: ActivityMeta;
  last: WorkoutWithExercises | null;
  week: ActivityTypeSummary;
  history: WorkoutWithExercises[];
  steps?: number;
  goal?: number;
};

const fmtPace = (mps: number | null, per = 1000): string => {
  if (!mps || mps <= 0) return "—";
  const sec = per / mps;
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};
const fmtKmh = (mps: number | null): string => (mps && mps > 0 ? (mps * 3.6).toFixed(1) : "—");
const fmtKm = (km: number | null): string => (km != null ? km.toFixed(km < 10 ? 2 : 1) : "—");

function Stat({ v, k }: { v: string; k: string }) {
  return (
    <div className="glass-card rounded-xl p-3">
      <div className="text-lg font-bold text-on-surface">{v}</div>
      <div className="text-[10px] text-on-surface-variant uppercase tracking-wide">{k}</div>
    </div>
  );
}

export default function ActivityPageClient({ activity, last, week, history, steps, goal }: Props) {
  const isWalk = activity.type === "WALKING";
  const isSwim = activity.type === "SWIMMING";
  const isBike = activity.type === "CYCLING";
  const m = (last?.garminMetrics as Record<string, unknown> | null) ?? null;
  const zones = (m?.hrZones as number[] | undefined) ?? null;

  return (
    <div className="space-y-4">
      <Link href="/fitness" className="inline-flex items-center gap-1 text-sm text-accent-cyan">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span> Volver a fitness
      </Link>
      <h1 className="text-2xl font-bold text-on-surface flex items-center gap-2">
        <span className="material-symbols-outlined" style={{ color: activity.color }}>{activity.icon}</span>
        {activity.label}
      </h1>

      {isWalk && steps != null && goal != null && <StepsRing steps={steps} goal={goal} color={activity.color} />}

      <div className="grid grid-cols-2 gap-2">
        <Stat v={fmtKm(last?.distanceKm ?? null) + (last?.distanceKm != null ? " km" : "")} k="Última distancia" />
        <Stat v={last?.calories != null ? String(last.calories) : "—"} k="Calorías" />
      </div>

      <ActivityLogForm activity={activity} />

      <ActivityStatsDisclosure>
        <div className="grid grid-cols-2 gap-2">
          {!isBike && <Stat v={fmtPace(last?.avgSpeedMps ?? null, isSwim ? 100 : 1000)} k={isSwim ? "Ritmo /100m" : "Ritmo /km"} />}
          {isBike && <Stat v={fmtKmh(last?.avgSpeedMps ?? null) + " km/h"} k="Velocidad media" />}
          {isBike && <Stat v={fmtKmh(last?.maxSpeedMps ?? null) + " km/h"} k="Velocidad máx" />}
          <Stat v={last?.avgHr != null ? `${last.avgHr} bpm` : "—"} k="FC media" />
          <Stat v={last?.maxHr != null ? String(last.maxHr) : "—"} k="FC máx" />
          {!isSwim && <Stat v={last?.elevationGainM != null ? `+${last.elevationGainM} m` : "—"} k="Desnivel" />}
          {!isSwim && last?.cadence != null && <Stat v={String(Math.round(last.cadence))} k="Cadencia" />}
          {isSwim && m?.activeLengths != null && <Stat v={String(m.activeLengths)} k="Largos" />}
          {isSwim && m?.avgSwolf != null && <Stat v={String(m.avgSwolf)} k="SWOLF" />}
          {isSwim && m?.strokes != null && <Stat v={String(m.strokes)} k="Brazadas" />}
        </div>
        {zones && (
          <div>
            <div className="text-[10px] text-on-surface-variant uppercase tracking-wide mb-1">Zonas de FC</div>
            <HrZonesBar zones={zones} />
          </div>
        )}
      </ActivityStatsDisclosure>

      <div className="glass-card rounded-xl p-3 text-sm text-on-surface-variant">
        Esta semana: <span className="text-on-surface font-semibold">{fmtKm(week.weekDistanceKm)} km</span> · {week.weekCount} {week.weekCount === 1 ? "salida" : "salidas"}
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest px-1">Historial</h3>
        {history.length === 0 && <p className="text-sm text-outline px-1">Sin actividades todavía.</p>}
        {history.map((w) => (
          <div key={w.id} className="glass-card rounded-xl px-3 py-2 flex justify-between text-sm">
            <span className="text-on-surface">{w.locationName ?? w.title ?? new Date(w.date).toLocaleDateString("es-UY")}</span>
            <span className="text-on-surface-variant">{fmtKm(w.distanceKm)} km · {w.durationMinutes ?? 0} min</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar y commit**

Run: `npx tsc --noEmit` → 0 errores.

```bash
git add components/fitness/ActivityPageClient.tsx
git commit -m "feat(fitness): template ActivityPageClient para páginas cardio"
```

---

### Task 14: Ruta dinámica `app/(app)/fitness/[actividad]/page.tsx`

**Files:**
- Create: `app/(app)/fitness/[actividad]/page.tsx`

- [ ] **Step 1: Crear server component** que valida slug (`notFound()` si no existe o si es `gym`, que tiene ruta propia), carga datos en paralelo y pasa a `ActivityPageClient`:

```tsx
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getActivityBySlug } from "@/lib/fitness-activities";
import {
  getActivityWeekSummary,
  getLastActivityOfType,
  getActivityHistory,
  getTodaySteps,
} from "@/lib/fitness";
import ActivityPageClient from "@/components/fitness/ActivityPageClient";

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ actividad: string }>;
}) {
  const { actividad } = await params;
  const activity = getActivityBySlug(actividad);
  if (!activity || activity.type === "GYM") notFound(); // gym tiene su propia ruta

  const session = await auth();
  if (!session?.user?.id) notFound();
  const userId = session.user.id;

  const [last, week, history, stepsInfo] = await Promise.all([
    getLastActivityOfType(userId, activity.type),
    getActivityWeekSummary(userId, activity.type),
    getActivityHistory(userId, activity.type),
    activity.type === "WALKING" ? getTodaySteps(userId) : Promise.resolve(null),
  ]);

  return (
    <ActivityPageClient
      activity={activity}
      last={last}
      week={week}
      history={history}
      steps={stepsInfo?.steps}
      goal={stepsInfo?.goal}
    />
  );
}
```

> Nota App Router: `params` es Promise en versiones recientes de Next. Si el repo usa la forma síncrona, ajustar (mirar otra page existente con params, ej. `app/api/fitness/workout/[id]`).

- [ ] **Step 2: Verificar y commit**

Run: `npx tsc --noEmit` → 0 errores. Probar navegación: `/fitness/correr` carga, `/fitness/xyz` da 404.

```bash
git add "app/(app)/fitness/[actividad]/page.tsx"
git commit -m "feat(fitness): ruta dinámica de páginas de actividad cardio"
```

---

## FASE 5 — Página Gym

### Task 15: `GymPageClient`

**Files:**
- Create: `components/fitness/GymPageClient.tsx`

- [ ] **Step 1: Crear componente.** Header con back, CTA "Empezar sesión" → `/fitness/session`, stats de gym (sesiones semana, volumen semana, volumen última), reusar `RoutineManager` (manejo de rutinas) y un historial de sesiones de gym. Props: `stats: GymStats`, `history: WorkoutWithExercises[]`.

```tsx
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { GymStats, WorkoutWithExercises } from "@/lib/fitness";
import { ACTIVITIES } from "@/lib/fitness-activities";
import RoutineManager from "./RoutineManager";

export default function GymPageClient({ stats, history }: { stats: GymStats; history: WorkoutWithExercises[] }) {
  const router = useRouter();
  const gym = ACTIVITIES.gym;
  return (
    <div className="space-y-4">
      <Link href="/fitness" className="inline-flex items-center gap-1 text-sm text-accent-cyan">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span> Volver a fitness
      </Link>
      <h1 className="text-2xl font-bold text-on-surface flex items-center gap-2">
        <span className="material-symbols-outlined" style={{ color: gym.color }}>{gym.icon}</span> Gym
      </h1>

      <div className="grid grid-cols-3 gap-2">
        <div className="glass-card rounded-xl p-3"><div className="text-lg font-bold text-on-surface">{stats.weekSessions}</div><div className="text-[10px] text-on-surface-variant uppercase">Sesiones/sem</div></div>
        <div className="glass-card rounded-xl p-3"><div className="text-lg font-bold text-on-surface">{stats.weekVolumeKg.toLocaleString("es-UY")}</div><div className="text-[10px] text-on-surface-variant uppercase">Volumen/sem (kg)</div></div>
        <div className="glass-card rounded-xl p-3"><div className="text-lg font-bold text-on-surface">{stats.totalVolumeKg.toLocaleString("es-UY")}</div><div className="text-[10px] text-on-surface-variant uppercase">Última (kg)</div></div>
      </div>

      <button onClick={() => router.push("/fitness/session")} className="w-full py-3 rounded-full font-bold text-sm text-[#0D0F14]" style={{ background: gym.color }}>
        + Empezar sesión
      </button>

      <div className="space-y-2">
        <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest px-1">Rutinas</h3>
        <RoutineManager onChanged={() => router.refresh()} />
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest px-1">Historial</h3>
        {history.length === 0 && <p className="text-sm text-outline px-1">Sin sesiones todavía.</p>}
        {history.map((w) => (
          <div key={w.id} className="glass-card rounded-xl px-3 py-2 flex justify-between text-sm">
            <span className="text-on-surface">{w.title ?? "Sesión de gym"}</span>
            <span className="text-on-surface-variant">{new Date(w.date).toLocaleDateString("es-UY")} · {w.durationMinutes ?? 0} min</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

> Verificar la firma real de `RoutineManager` (props `onChanged`); si difiere, ajustar.

- [ ] **Step 2: Verificar y commit**

Run: `npx tsc --noEmit` → 0 errores.

```bash
git add components/fitness/GymPageClient.tsx
git commit -m "feat(fitness): GymPageClient (rutinas + stats + historial)"
```

---

### Task 16: Ruta `app/(app)/fitness/gym/page.tsx`

**Files:**
- Create: `app/(app)/fitness/gym/page.tsx`

- [ ] **Step 1: Crear server component**

```tsx
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getGymStats, getActivityHistory } from "@/lib/fitness";
import GymPageClient from "@/components/fitness/GymPageClient";

export default async function GymPage() {
  const session = await auth();
  if (!session?.user?.id) notFound();
  const userId = session.user.id;

  const [stats, history] = await Promise.all([
    getGymStats(userId),
    getActivityHistory(userId, "GYM"),
  ]);

  return <GymPageClient stats={stats} history={history} />;
}
```

- [ ] **Step 2: Verificar y commit**

Run: `npx tsc --noEmit` → 0 errores. Probar `/fitness/gym`.

```bash
git add "app/(app)/fitness/gym/page.tsx"
git commit -m "feat(fitness): ruta de página Gym"
```

---

## FASE 6 — Verificación final

### Task 17: Build + prueba manual con Garmin

**Files:** ninguno (verificación)

- [ ] **Step 1: Typecheck completo**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 2: Build de producción**

Run: `npm run build`
Expected: build OK (incluye `prisma generate`). Revisar que las rutas `/fitness/[actividad]` y `/fitness/gym` aparezcan en el output.

- [ ] **Step 3: Prueba manual de navegación (dev)**

Run: `npm run dev` y abrir logueado:
- `/fitness` → tabs Hoy/Stats (sin Routines); pills navegan.
- `/fitness/caminar` → anillo de pasos refleja `DailySteps` de hoy vs meta.
- `/fitness/correr|nadar|bici` → stats + desplegable.
- `/fitness/gym` → rutinas + stats + historial.
- `/fitness/xyz` → 404.

- [ ] **Step 4: Prueba de sync Garmin**

Sincronizar (botón Garmin sync o `POST /api/fitness/sync-garmin`). Verificar que una actividad nueva trae FC/desnivel/etc. El usuario puede hacer actividades cortas (mover el brazo) para validar qué llega por tipo y ajustar el render si falta algún campo.

- [ ] **Step 5: Commit final (si hubo ajustes)**

```bash
git add -A
git commit -m "feat(fitness): páginas dedicadas por actividad — verificación e2e"
```

---

## Notas / riesgos

- **`prisma db push` falla con Supabase** → schema por SQL directo (Task 1). Tras el SQL, `npm run db:generate`.
- **Forma de `params` en App Router**: confirmar sync vs Promise mirando una page existente del repo antes de Task 14/16.
- **`RoutineManager` props**: confirmar firma real (`onChanged`) antes de Task 15.
- **Garmin puede omitir métricas** por tipo (nado sin pileta, indoor sin GPS) → la UI ya usa "—"/condicionales; no romper.
- **Snowboard y otros `OTHER`**: sin página propia; aparecen en el global. OK por diseño.

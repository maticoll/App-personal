# Pantalla de Workout Activo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar una pantalla mobile-first para loguear sesiones de gimnasio en vivo (estilo Hevy): empezar desde una rutina o vacío, cargar series con el "anterior" precargado, marcar series con ✓ + descanso, detectar PRs y mostrar un resumen al finalizar.

**Architecture:** Pantalla cliente en `/fitness/session` con estado en React + respaldo en localStorage; persiste a la DB en un solo POST al "Finish", reusando el modelo `Workout`/`WorkoutExercise`/`WorkoutSet`. Dos endpoints nuevos: `prep` (trae ejercicios + "anterior" + récords) y `session` (guarda + devuelve resumen con PRs). Lógica nueva en `lib/fitness.ts`.

**Tech Stack:** Next.js App Router, TypeScript estricto, Prisma (Supabase), Tailwind (dark + cyan), lucide-react. Sin framework de tests → verificación con `npx tsc --noEmit` + `npm run build` + prueba manual.

**Spec:** `docs/superpowers/specs/2026-06-02-active-workout-logger-design.md`

**Convención de este plan (sin tests):** cada tarea = implementar el cambio → correr `npx tsc --noEmit` (0 errores) → commit. Build completo en hitos. Verificación manual en la última tarea. Sin cambios de schema Prisma.

---

## File Structure

**lib/**
- `lib/fitness.ts` (modificar) — `getExerciseBests`, `getSessionPrep`, `saveWorkoutSession`, helper `weightKey`, tipos `ExerciseBests`, `SessionPrep`, `WorkoutSessionPayload`, `WorkoutSessionSummary`.

**API (app/api/fitness/session/)**
- `prep/route.ts` (crear) — `GET` prep.
- `route.ts` (crear) — `POST` guardar sesión.

**UI (components/fitness/)**
- `RestTimer.tsx` (crear)
- `SetRow.tsx` (crear)
- `ExerciseLogCard.tsx` (crear)
- `WorkoutSummary.tsx` (crear)
- `ActiveWorkoutClient.tsx` (crear) — orquestador.

**Página**
- `app/(app)/fitness/session/page.tsx` (crear)

**Entradas (modificar)**
- `components/fitness/GymRoutineCard.tsx` — "Empezar" navega a la sesión.
- `components/fitness/RoutineManager.tsx` — "Hacer hoy" navega a la sesión.
- `components/fitness/FitnessModuleClient.tsx` — botón "Empezar vacío".

---

## Task 1: Capa de datos en `lib/fitness.ts`

**Files:**
- Modify: `lib/fitness.ts` (agregar al final de la sección de rutinas / antes del CRUD; helpers reusan `normalizeName`, `exerciseTopSet`, `exerciseVolume`, `startGymWorkout`, `addExerciseSets`, `getRoutines`, `matchRoutineByName`, `findLastRoutineSession`, `buildExercisePerformance`, `startOfDay` ya existentes)

- [ ] **Step 1: Agregar tipos y helper `weightKey`**

```ts
export type ExerciseBests = {
  maxWeightKg: number | null;
  maxSessionVolume: number | null;
  repsAtWeight: Record<string, number>; // weightKey -> mejores reps históricas
};

export type SessionPrepExercise = {
  name: string;
  plannedSets: number;
  repsRange: string | null;
  lastSets: { weightKg: number | null; reps: number | null }[];
  bests: ExerciseBests;
};

export type SessionPrep = {
  routineId: string | null;
  routineName: string | null;
  exercises: SessionPrepExercise[];
};

export type WorkoutSessionPayload = {
  routineName: string | null;
  durationSeconds: number;
  exercises: { name: string; sets: { weightKg: number | null; reps: number | null }[] }[];
};

export type WorkoutSessionPR = {
  exercise: string;
  kind: "weight" | "volume" | "reps";
  detail: string;
};

export type WorkoutSessionSummary = {
  workoutId: string;
  durationSeconds: number;
  totalSets: number;
  totalVolume: number;
  prs: WorkoutSessionPR[];
};

/** Clave canónica de peso para repsAtWeight (16.5 -> "16.5"). Misma fn en prep y server. */
export function weightKey(weightKg: number | null): string {
  return weightKg == null ? "0" : String(weightKg);
}
```

- [ ] **Step 2: Implementar `getExerciseBests`**

Calcula récords históricos por ejercicio (por nombre normalizado) sobre todos los workouts del usuario, opcionalmente antes de `beforeDate` (para no contar la sesión de hoy).

```ts
export async function getExerciseBests(
  userId: string,
  names: string[],
  beforeDate?: Date
): Promise<Record<string, ExerciseBests>> {
  const wanted = new Set(names.map(normalizeName));
  const workouts = await db.workout.findMany({
    where: {
      userId,
      type: "GYM",
      ...(beforeDate ? { date: { lt: beforeDate } } : {}),
    },
    include: { exercises: { include: { sets: true } } },
  });

  const out: Record<string, ExerciseBests> = {};
  for (const n of names) {
    out[normalizeName(n)] = { maxWeightKg: null, maxSessionVolume: null, repsAtWeight: {} };
  }

  for (const w of workouts) {
    for (const ex of w.exercises) {
      const key = normalizeName(ex.name);
      if (!wanted.has(key)) continue;
      const b = out[key];
      let sessionVol = 0;
      for (const s of ex.sets) {
        const wk = s.weightKg ?? null;
        const reps = s.reps ?? null;
        if (wk != null && (b.maxWeightKg == null || wk > b.maxWeightKg)) b.maxWeightKg = wk;
        if (wk != null && reps != null) {
          sessionVol += wk * reps;
          const k = weightKey(wk);
          if (b.repsAtWeight[k] == null || reps > b.repsAtWeight[k]) b.repsAtWeight[k] = reps;
        }
      }
      if (sessionVol > 0 && (b.maxSessionVolume == null || sessionVol > b.maxSessionVolume)) {
        b.maxSessionVolume = sessionVol;
      }
    }
  }
  return out;
}
```

- [ ] **Step 3: Implementar `getSessionPrep`**

Reusa `getRoutines` + `matchRoutineByName`/lookup por id, `findLastRoutineSession`, `buildExercisePerformance` (que ya devuelve `lastSets`), y `getExerciseBests`.

```ts
export async function getSessionPrep(
  userId: string,
  routineId: string | null
): Promise<SessionPrep> {
  if (!routineId) return { routineId: null, routineName: null, exercises: [] };

  const routines = await getRoutines(userId);
  const routine = routines.find((r) => r.id === routineId) ?? null;
  if (!routine) return { routineId: null, routineName: null, exercises: [] };

  const last = await findLastRoutineSession(userId, routine.name);
  const perf = buildExercisePerformance(routine, last); // {name, plannedSets, repsRange, lastSets, top}
  const bests = await getExerciseBests(userId, routine.exercises.map((e) => e.name));

  return {
    routineId: routine.id,
    routineName: routine.name,
    exercises: perf.map((p) => ({
      name: p.name,
      plannedSets: p.plannedSets,
      repsRange: p.repsRange,
      lastSets: p.lastSets,
      bests: bests[normalizeName(p.name)] ?? { maxWeightKg: null, maxSessionVolume: null, repsAtWeight: {} },
    })),
  };
}
```

- [ ] **Step 4: Implementar `saveWorkoutSession`** (ORDEN: bests ANTES de insertar)

```ts
export async function saveWorkoutSession(
  userId: string,
  payload: WorkoutSessionPayload
): Promise<WorkoutSessionSummary> {
  // 1. Filtrar series vacías
  const exercises = payload.exercises
    .map((e) => ({
      name: e.name.trim(),
      sets: e.sets.filter((s) => s.weightKg != null || s.reps != null),
    }))
    .filter((e) => e.name && e.sets.length > 0);

  if (exercises.length === 0) {
    throw new Error("No hay series con datos para guardar.");
  }

  // 2. Bests históricos ANTES de insertar (no contar la sesión de hoy)
  const bests = await getExerciseBests(userId, exercises.map((e) => e.name), startOfDay(new Date()));

  // 3. Crear/reutilizar sesión GYM de hoy etiquetada con la rutina
  const workout = await startGymWorkout(userId, payload.routineName ?? undefined);

  // 4. Insertar ejercicios + series
  for (const ex of exercises) {
    await addExerciseSets(
      workout.id,
      ex.name,
      ex.sets.map((s) => ({ reps: s.reps ?? null, weightKg: s.weightKg ?? null }))
    );
  }

  // 5. Duración
  const durationMinutes = Math.max(1, Math.round(payload.durationSeconds / 60));
  await db.workout.update({ where: { id: workout.id }, data: { durationMinutes: Math.min(durationMinutes, 300) } });

  // 6. PRs y totales
  const prs: WorkoutSessionPR[] = [];
  let totalSets = 0;
  let totalVolume = 0;
  for (const ex of exercises) {
    const b = bests[normalizeName(ex.name)] ?? { maxWeightKg: null, maxSessionVolume: null, repsAtWeight: {} };
    const top = exerciseTopSet(ex.sets);
    const vol = exerciseVolume(ex.sets);
    totalSets += ex.sets.length;
    totalVolume += vol;

    if (top?.weightKg != null && (b.maxWeightKg == null || top.weightKg > b.maxWeightKg)) {
      prs.push({ exercise: ex.name, kind: "weight", detail: `${top.weightKg}kg` });
    }
    if (vol > 0 && (b.maxSessionVolume == null || vol > b.maxSessionVolume)) {
      prs.push({ exercise: ex.name, kind: "volume", detail: `${Math.round(vol)} vol` });
    }
    for (const s of ex.sets) {
      if (s.weightKg != null && s.reps != null) {
        const prev = b.repsAtWeight[weightKey(s.weightKg)];
        if (prev == null || s.reps > prev) {
          prs.push({ exercise: ex.name, kind: "reps", detail: `${s.reps} reps @ ${s.weightKg}kg` });
          break; // un PR de reps por ejercicio alcanza
        }
      }
    }
  }

  return {
    workoutId: workout.id,
    durationSeconds: payload.durationSeconds,
    totalSets,
    totalVolume: Math.round(totalVolume),
    prs,
  };
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errores. (Si `buildExercisePerformance` no estuviera exportado/visible en el módulo, ya lo está — es función del mismo archivo.)

- [ ] **Step 6: Commit**

```bash
git add lib/fitness.ts
git commit -m "feat(fitness): capa de datos para workout activo (prep, bests, save+PRs)"
```

---

## Task 2: Endpoint `GET /api/fitness/session/prep`

**Files:**
- Create: `app/api/fitness/session/prep/route.ts`

- [ ] **Step 1: Crear la route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSessionPrep } from "@/lib/fitness";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const routineId = req.nextUrl.searchParams.get("routineId");
    const prep = await getSessionPrep(session.user.id, routineId);
    return NextResponse.json(prep);
  } catch (err) {
    console.error("[GET /api/fitness/session/prep]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit` → 0 errores.
- [ ] **Step 3: Commit** — `git add app/api/fitness/session/prep/route.ts && git commit -m "feat(fitness): endpoint prep de sesion"`

---

## Task 3: Endpoint `POST /api/fitness/session`

**Files:**
- Create: `app/api/fitness/session/route.ts`

- [ ] **Step 1: Crear la route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { saveWorkoutSession, type WorkoutSessionPayload } from "@/lib/fitness";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = (await req.json()) as WorkoutSessionPayload;
    if (!body || !Array.isArray(body.exercises)) {
      return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
    }

    const summary = await saveWorkoutSession(session.user.id, {
      routineName: body.routineName ?? null,
      durationSeconds: Math.max(0, Number(body.durationSeconds) || 0),
      exercises: body.exercises,
    });
    return NextResponse.json({ summary }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al guardar la sesión";
    console.error("[POST /api/fitness/session]", err);
    const status = message.includes("series con datos") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit` → 0 errores.
- [ ] **Step 3: Commit** — `git add app/api/fitness/session/route.ts && git commit -m "feat(fitness): endpoint POST de sesion (guarda + PRs)"`

---

## Task 4: Componente `RestTimer`

**Files:**
- Create: `components/fitness/RestTimer.tsx`

- [ ] **Step 1: Implementar** — chip flotante con cuenta regresiva. Props: `{ seconds: number; onDone: () => void; onSkip: () => void; onAdjust: (delta: number) => void }`. Usa `useEffect` con `setInterval` (1s) y limpia al desmontar. Muestra `m:ss`, botones `-15s / +15s / Saltar`. Estilo: `bg-[rgba(6,182,212,0.15)] text-accent-cyan rounded-full`, posición `fixed bottom-20 left-1/2 -translate-x-1/2 z-40`.

```tsx
"use client";
import { useEffect, useState } from "react";

type Props = { seconds: number; onDone: () => void; onSkip: () => void; onAdjust: (delta: number) => void };

export default function RestTimer({ seconds, onDone, onSkip, onAdjust }: Props) {
  const [remaining, setRemaining] = useState(seconds);
  useEffect(() => setRemaining(seconds), [seconds]);
  useEffect(() => {
    if (remaining <= 0) { onDone(); return; }
    const t = setInterval(() => setRemaining((r) => r - 1), 1000);
    return () => clearInterval(t);
  }, [remaining, onDone]);

  const mm = Math.floor(Math.max(remaining, 0) / 60);
  const ss = String(Math.max(remaining, 0) % 60).padStart(2, "0");
  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-[#06B6D4]/15 text-accent-cyan rounded-full px-3 py-2 backdrop-blur">
      <button onClick={() => onAdjust(-15)} className="px-2 font-bold">-15</button>
      <span className="font-mono font-bold tabular-nums">⏱ {mm}:{ss}</span>
      <button onClick={() => onAdjust(15)} className="px-2 font-bold">+15</button>
      <button onClick={onSkip} className="ml-1 text-xs underline">Saltar</button>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + Commit** — `git commit -m "feat(fitness): RestTimer"`

---

## Task 5: Componente `SetRow`

**Files:**
- Create: `components/fitness/SetRow.tsx`

- [ ] **Step 1: Implementar** — una fila de serie. Props: `{ index: number; prev: {weightKg:number|null;reps:number|null}|null; weightKg:number|null; reps:number|null; done:boolean; onChange:(patch:{weightKg?:number|null;reps?:number|null})=>void; onToggleDone:()=>void }`.
  - Grid `28px 1fr 56px 48px 32px`: nº, "anterior" (`{prev.weightKg}×{prev.reps}` o "—"), input KG (decimal), input REPS (entero), botón ✓.
  - Inputs `type="number"`, `inputMode="decimal"`/`"numeric"`. Al marcar ✓ con inputs vacíos pero hay `prev`, autocompletar con `prev` (UX Hevy). Fila `done` → fondo verde `bg-[rgba(16,185,129,0.10)]`.
  - Parseo: `e.target.value === "" ? null : parseFloat(...)` (KG) / `parseInt(...)` (reps).

- [ ] **Step 2: Typecheck + Commit** — `git commit -m "feat(fitness): SetRow"`

---

## Task 6: Componente `ExerciseLogCard`

**Files:**
- Create: `components/fitness/ExerciseLogCard.tsx`

- [ ] **Step 1: Implementar** — card de un ejercicio. Props: el `SessionExercise` (ver spec §6) + callbacks `onSetChange(setId, patch)`, `onToggleDone(setId)`, `onAddSet()`, `onRemoveExercise()`, `onRestChange(seconds)`. Header con nombre (cyan) + menú (quitar ejercicio, ajustar descanso). Header de columnas SET/ANTERIOR/KG/REPS/✓. Mapea `sets` a `SetRow`. Footer "+ Agregar serie". Marca 🔥 tentativo si la serie supera `bests` (peso o reps@peso) usando `weightKey`.

- [ ] **Step 2: Typecheck + Commit** — `git commit -m "feat(fitness): ExerciseLogCard"`

---

## Task 7: Componente `WorkoutSummary`

**Files:**
- Create: `components/fitness/WorkoutSummary.tsx`

- [ ] **Step 1: Implementar** — pantalla final. Props: `WorkoutSessionSummary` + `onClose()`. Muestra duración (`m:ss`/`h:mm`), series totales, volumen total, y lista de PRs con 🔥 (`{exercise}: {detail}` según kind). Botón "Listo" → `onClose` (router.push `/fitness`). Estado vacío de PRs: "Sin récords esta vez — igual sumaste 💪".

- [ ] **Step 2: Typecheck + Commit** — `git commit -m "feat(fitness): WorkoutSummary"`

---

## Task 8: Orquestador `ActiveWorkoutClient` + página

**Files:**
- Create: `components/fitness/ActiveWorkoutClient.tsx`
- Create: `app/(app)/fitness/session/page.tsx`

- [ ] **Step 1: Página (server component)**

```tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import ActiveWorkoutClient from "@/components/fitness/ActiveWorkoutClient";

export default async function SessionPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return <ActiveWorkoutClient />;
}
```

- [ ] **Step 2: `ActiveWorkoutClient` — estado, prep, localStorage**

Lógica (client component, `"use client"`):
  - Lee `routine` de `useSearchParams()`.
  - Tipos `SessionSet`/`SessionExercise`/`ActiveSession` (spec §6); ids locales con un contador incremental (NO `Math.random`/`Date.now` para ids reproducibles no hace falta; está OK usar `crypto.randomUUID()` en cliente).
  - Al montar: si hay sesión en `localStorage` (`active-workout`) sin terminar → mostrar "Retomar / Descartar". Si no, y hay `?routine=`, `fetch('/api/fitness/session/prep?routineId=...')` y construir `exercises` (cada ejercicio: `plannedSets` filas con `prev` = `lastSets[i]`, weight/reps null, done false, `restSeconds:90`, `bests`). Si vacío, arranca con 0 ejercicios.
  - `startedAtMs` = `Date.now()` al iniciar (cliente; permitido) — guardado en localStorage.
  - `useEffect` que serializa el estado a localStorage en cada cambio.
  - Cronómetro: `useEffect` con interval 1s calculando `Date.now() - startedAtMs`.
  - Rest timer: estado `restFor` (id de ejercicio activo) + `restSeconds`; al `onToggleDone` que marca done=true, set `restFor` con el `restSeconds` del ejercicio.
  - Handlers: setChange, toggleDone, addSet, removeExercise, addExercise (prompt simple de nombre o input inline), restChange.
  - **Finish:** arma `WorkoutSessionPayload` (routineName, durationSeconds, exercises→sets), `POST /api/fitness/session`, si ok limpia localStorage y muestra `WorkoutSummary` con la respuesta. Maneja error 400 (sin series) con un aviso.
  - **Descartar:** limpia localStorage y router.push `/fitness`.

- [ ] **Step 3: Typecheck** — `npx tsc --noEmit` → 0 errores.
- [ ] **Step 4: Commit** — `git add components/fitness/ActiveWorkoutClient.tsx "app/(app)/fitness/session/page.tsx" && git commit -m "feat(fitness): pantalla de workout activo (ActiveWorkoutClient + ruta)"`

---

## Task 9: Cablear entradas

**Files:**
- Modify: `components/fitness/GymRoutineCard.tsx`
- Modify: `components/fitness/RoutineManager.tsx`
- Modify: `components/fitness/FitnessModuleClient.tsx`

- [ ] **Step 1: `GymRoutineCard`** — el botón "Empezar gym" deja de hacer el `fetch('/api/fitness/start-routine')` y pasa a `router.push('/fitness/session?routine=' + routine.id)` (`useRouter` de `next/navigation`). Quitar el estado `starting`/`handleStart` viejo si queda sin uso, o reusarlo solo para navegar.

- [ ] **Step 2: `RoutineManager`** — el botón "Hacer hoy" (`handleStartToday`) pasa a `router.push('/fitness/session?routine=' + routine.id)` en vez del POST. Mantener el ícono `Play`.

- [ ] **Step 3: `FitnessModuleClient`** — agregar un botón "Empezar vacío" en la pestaña Today (cerca de Quick Actions) que hace `router.push('/fitness/session')`. Dejar el Quick Log NLP como atajo secundario (sin cambios funcionales).

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit` (0 errores) y luego `npm run build` (Compiled successfully + ruta `/fitness/session` listada).

- [ ] **Step 5: Commit** — `git commit -m "feat(fitness): entradas al workout activo (Empezar/Hacer hoy/vacio)"`

---

## Task 10: Verificación final + docs

- [ ] **Step 1: Build limpio** — `npm run build` → `Compiled successfully`, sin errores, `/fitness/session` aparece como ruta.

- [ ] **Step 2: Verificación manual (en dev o tras deploy)**
  - Routines → "Hacer hoy" en una rutina con historial → la pantalla precarga ejercicios con "anterior".
  - Cargar series, marcar ✓ → arranca descanso 90s; ajustar -15/+15; saltar.
  - Agregar serie / agregar ejercicio / quitar ejercicio.
  - Recargar la página → ofrece "Retomar"; retomar mantiene lo cargado y el cronómetro.
  - "Finish" → resumen con volumen/series/duración; si superaste algo, aparece PR 🔥.
  - Confirmar que "tráeme push A" (WhatsApp) y la web muestran los pesos nuevos (la sesión quedó etiquetada con el nombre de la rutina).
  - Empezar vacío → agregar ejercicio a mano → Finish.

- [ ] **Step 3: (Opcional) Documentar** en `CLAUDE.md` un bloque corto de esta feature, siguiendo la convención de bloques de sesión.

- [ ] **Step 4: Commit final** (si hubo docs) — `git commit -m "docs: bloque de sesion workout activo"`

---

## Notas para el implementador

- **No tocar el schema Prisma** — todo reusa `Workout`/`WorkoutExercise`/`WorkoutSet`. `Workout.title` guarda el nombre de la rutina (ya soportado por `startGymWorkout(userId, title?)`).
- **`startGymWorkout` deduplica** la sesión GYM del día: si el usuario hace Finish dos veces o ya había una sesión, se agrega a la misma (no duplica). Aceptable para el MVP.
- **PRs:** `getExerciseBests` SIEMPRE con `beforeDate = startOfDay(now)` al guardar, para no contar la sesión recién creada.
- **`weightKey`** debe usarse idéntica en prep (PR live) y server (PR definitivo).
- **Sin `Math.random`/`Date.now` en server**; en cliente está OK (`crypto.randomUUID`, `Date.now` para el cronómetro).
- Seguir el estilo dark + cyan existente (clases `bg-surface-container`, `text-accent-cyan`, `card`, etc.).

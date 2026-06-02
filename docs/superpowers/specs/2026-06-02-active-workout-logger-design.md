# Diseño — Pantalla de Workout Activo (estilo Hevy)

> Fecha: 2026-06-02
> Estado: aprobado (brainstorming) — pendiente plan de implementación

## 1. Contexto

La app personal (Next.js App Router, mobile-first, dark + cyan) ya tiene un módulo de fitness con:
- Modelos Prisma: `Workout` (type GYM, `title`, `durationMinutes`, `source`), `WorkoutExercise`, `WorkoutSet` (`setNumber`, `reps`, `weightKg`), `GymRoutine` + `GymRoutineExercise` (`name`, `sets`, `repsRange`).
- Funciones en `lib/fitness.ts`: `startGymWorkout(userId, title?)`, `addExerciseSets`, `getRoutines`, `findLastRoutineSession`, `getRoutineWithLastPerformance`, `getRoutinesWithLastPerformance`, `enrichRoutineWithLastPerformance`, helpers `exerciseTopSet`/`exerciseVolume`/`normalizeName`.
- Logueo actual en el app: caja NLP ("Quick Log") + botones "Empezar gym" / "Hacer hoy" que crean un Workout vacío. Logueo por WhatsApp: `logRoutineSession` (se mantiene intacto).

Hoy NO hay una pantalla para loguear series en vivo: el usuario debe escribir texto libre. Este diseño agrega esa pantalla, copiando el patrón de interacción de Hevy adaptado al design system propio (no se copian assets ni textos de Hevy).

## 2. Objetivos (MVP)

Las 6 funciones confirmadas:
1. Columna **"Anterior"** precargada por serie (peso×reps de la última vez).
2. **Checkboxes** por serie (marcar completada).
3. **Timer de descanso**: auto-start al marcar ✓, default 90s, editable por ejercicio.
4. **Resumen final**: volumen total, series, duración, PRs.
5. **Detección de PRs**: peso máximo, volumen del ejercicio en la sesión, y reps a un peso dado.
6. **Editar sobre la marcha**: agregar/quitar series y ejercicios durante el workout.

## 3. No objetivos (YAGNI)

Feed social / perfil público, librería de ejercicios con GIFs, supersets, RPE, calculadora de discos, gráficos por ejercicio. Futuras iteraciones.

## 4. Decisiones de diseño (del brainstorming)

| Decisión | Elección |
|---|---|
| Inicio | Desde rutina **o** vacío |
| Ubicación | Pantalla dedicada `/fitness/session` (client component) |
| Persistencia | **Guardar al finalizar** (estado en cliente + respaldo localStorage; 1 POST al Finish) |
| PRs | Peso máximo + volumen por sesión + reps a un peso dado |
| Descanso | Auto al ✓, 90s default, editable |
| Flujo viejo | El nuevo flujo reemplaza "Empezar"/"Hacer hoy" en el app; WhatsApp y "tráeme push A" intactos |

## 5. Flujo de usuario

1. **Entrada:** en `GymRoutineCard` (rutina del día) o en cada rutina de `RoutineManager`, el botón "Empezar" navega a `/fitness/session?routine=<routineId>`. Un botón "Empezar vacío" (en la pestaña Today) navega a `/fitness/session`.
2. **Prep:** la pantalla llama `GET /api/fitness/session/prep?routineId=…`. Devuelve los ejercicios de la rutina con, por ejercicio: series planificadas, repsRange, las series "anteriores" (de la última sesión de esa rutina) y los récords históricos (para PRs). Para workout vacío, prep devuelve estructura vacía y el usuario agrega ejercicios.
3. **Logueo:** estado en cliente. Cada ejercicio tiene filas de serie con: nº, "anterior" (read-only), input KG, input REPS, ✓. Al marcar ✓ se valida la serie y arranca el `RestTimer` (90s, ajustable). Se pueden agregar/quitar series y ejercicios. Cronómetro de sesión corre desde el inicio. Tira superior con volumen/series/PRs en vivo.
4. **Respaldo:** el estado se serializa a `localStorage` (clave única de sesión) en cada cambio, para sobrevivir recarga/cierre accidental. No toca la DB.
5. **Finish:** `POST /api/fitness/session` con el payload completo. El server crea un `Workout` + exercises + sets, calcula duración (del cronómetro) y PRs definitivos, y devuelve el resumen. Se limpia el localStorage. Se muestra `WorkoutSummary`.
6. **Descartar / retomar:** si el usuario vuelve a `/fitness/session` con una sesión en localStorage sin terminar, se ofrece "Retomar" o "Descartar".

## 6. Estado del cliente

```ts
type SessionSet = {
  id: string;            // uid local
  prevWeightKg: number | null;
  prevReps: number | null;
  weightKg: number | null;
  reps: number | null;
  done: boolean;
};
type SessionExercise = {
  id: string;            // uid local
  name: string;
  plannedSets: number;
  repsRange: string | null;
  restSeconds: number;   // default 90, editable
  sets: SessionSet[];
  bests?: ExerciseBests;  // récords históricos para PR live
};
type ActiveSession = {
  routineId: string | null;
  routineName: string | null;
  startedAtMs: number;   // para el cronómetro (Date.now al iniciar)
  exercises: SessionExercise[];
};
```

`startedAtMs` se setea en el cliente al iniciar; persiste en localStorage para reconstruir el cronómetro al retomar.

## 7. API

### GET /api/fitness/session/prep?routineId=ID
Auth requerida. Respuesta:
```ts
{
  routineId: string | null;
  routineName: string | null;
  exercises: Array<{
    name: string;
    plannedSets: number;
    repsRange: string | null;
    lastSets: { weightKg: number|null; reps: number|null }[]; // "anterior" por serie
    bests: {
      maxWeightKg: number | null;
      maxSessionVolume: number | null;
      repsAtWeight: Record<string, number>; // peso -> mejores reps históricas
    };
  }>;
}
```
Sin `routineId` → `{ routineId:null, routineName:null, exercises:[] }`.

### POST /api/fitness/session
Auth requerida. Body:
```ts
{
  routineName: string | null;
  durationSeconds: number;
  exercises: Array<{ name: string; sets: { weightKg: number|null; reps: number|null }[] }>;
}
```
El server (ORDEN IMPORTA por los PRs):
1. Ignora series totalmente vacías (sin peso y sin reps). Si no queda ninguna serie con datos → 400.
2. **Calcula los bests históricos PRIMERO** con `getExerciseBests(userId, names)` — ANTES de insertar nada — para que la sesión de hoy no se cuente a sí misma como baseline del PR. (Alternativa equivalente: pasar `beforeDate = startOfDay(now)`.)
3. Crea (o reutiliza si ya existe hoy) la sesión GYM con `startGymWorkout(userId, routineName ?? undefined)`.
4. Inserta exercises + sets con `addExerciseSets`.
5. Setea `durationMinutes = round(durationSeconds/60)`.
6. Compara la sesión de hoy contra los bests del paso 2 → PRs definitivos.
Respuesta:
```ts
{
  workoutId: string;
  summary: {
    durationSeconds: number;
    totalSets: number;
    totalVolume: number;
    prs: Array<{ exercise: string; kind: "weight"|"volume"|"reps"; detail: string }>;
  };
}
```

## 8. Lógica de PRs

`getExerciseBests(userId, names: string[], beforeDate?: Date)` agrega sobre todos los `WorkoutSet` históricos del usuario (join a Workout para fecha), agrupando por nombre de ejercicio normalizado:
- `maxWeightKg`: máximo `weightKg` registrado.
- `maxSessionVolume`: máximo, por sesión (Workout), de Σ(weightKg×reps) del ejercicio.
- `repsAtWeight`: por cada peso, máximas reps históricas.

Un PR en la sesión actual (solo series con ✓):
- **weight**: `topWeightHoy > maxWeightKg`.
- **volume**: `volumenEjercicioHoy > maxSessionVolume`.
- **reps**: existe una serie hoy con `reps > repsAtWeight[peso]` para ese peso.

Live (en el cliente) se usan los `bests` traídos en prep para mostrar 🔥 tentativos; el server recalcula los definitivos al guardar (fuente de verdad).

**Normalización de claves de peso:** `repsAtWeight` se indexa por el peso como string canónico vía `String(weightKg)` (ej. `16.5` → `"16.5"`, sin ceros de relleno). Prep y server DEBEN usar la misma función para evitar desajustes tipo `"16.5"` vs `"16.50"`.

## 9. Componentes / archivos

Nuevos:
- `app/(app)/fitness/session/page.tsx` — server: auth + render del client.
- `components/fitness/ActiveWorkoutClient.tsx` — orquesta estado, cronómetro, localStorage, Finish.
- `components/fitness/ExerciseLogCard.tsx` — un ejercicio + filas.
- `components/fitness/SetRow.tsx` — inputs + ✓.
- `components/fitness/RestTimer.tsx` — cuenta regresiva flotante.
- `components/fitness/WorkoutSummary.tsx` — resumen final + PRs.
- `app/api/fitness/session/prep/route.ts` — GET prep.
- `app/api/fitness/session/route.ts` — POST guardar.

Modificados:
- `lib/fitness.ts` — `getExerciseBests`, `getSessionPrep`, `saveWorkoutSession`, tipos.
- `components/fitness/GymRoutineCard.tsx` — botón "Empezar" → navega a `/fitness/session?routine=<id>` (en vez del POST actual).
- `components/fitness/RoutineManager.tsx` — "Hacer hoy" → navega a la sesión.
- `components/fitness/FitnessModuleClient.tsx` — botón "Empezar vacío"; el Quick Log NLP queda como atajo secundario (colapsado).

Sin cambios de schema Prisma (reutiliza Workout/WorkoutExercise/WorkoutSet).

## 10. Integración con scoring

El Workout guardado alimenta el scoring existente (`calcFitnessScore`: base + gym + duración + cardio/pasos) y la "última performance" / "tráeme push A" sin cambios. La duración real del cronómetro mejora el bloque de duración.

## 11. Casos borde

- Ejercicio nuevo sin historial → sin "anterior" ni PR (ok).
- Pesos decimales (ej. 16.5) soportados (Float).
- Series marcadas ✓ pero vacías → se ignoran al guardar.
- Finish sin ninguna serie con datos → error claro, no crea workout.
- Salir sin terminar → localStorage permite retomar o descartar.
- Ya existe un Workout GYM hoy → `startGymWorkout` lo reutiliza y le agrega los ejercicios (evita duplicado).
- **Una sola sesión activa a la vez** en localStorage. Si entrás a `/fitness/session` (sobre todo con otra rutina) y hay una sesión sin terminar guardada, se pregunta "Retomar / Descartar" antes de pisarla; nunca se sobreescribe en silencio.

## 12. Verificación

- `npx tsc --noEmit` en 0 y `npm run build` ok (no hay framework de tests).
- Prueba manual: empezar Push A → cargar series → marcar ✓ (descanso arranca) → Finish → ver resumen con volumen/duración/PR → confirmar que "tráeme push A" y la web muestran los pesos nuevos.

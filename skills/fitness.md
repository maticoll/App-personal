# Skill: Fitness Module — Sesión 4

> Referencia técnica completa del módulo de Fitness construido en la Sesión 4.
> Para contexto del proyecto general, ver `CLAUDE.md` y `BLUEPRINT.md`.

---

## Resumen de lo construido

Módulo completo de Fitness en `/fitness` con:
- Registro de entrenamientos (gym con NLP, actividades cardio con formulario)
- Sistema de rutinas de gym (CRUD completo)
- Historial y estadísticas semanales
- Sync con Garmin Connect API
- Smart habits (detección de gym perdido)
- Scoring real con conciencia del calendario de gym
- Agente de WhatsApp completo

---

## Schema Prisma (cambios Sesión 4)

### Campos nuevos en `Workout`
```prisma
title   String?           // Nombre de la actividad (Garmin o manual)
source  String  @default("MANUAL") // "MANUAL" | "GARMIN"
steps   Int?              // Pasos (Garmin walking/running)
```

**Modelos sin cambios** (ya existían en Sesión 1): `Workout`, `Exercise`, `WorkoutSet`, `GymRoutine`, `GymRoutineExercise`, `UserSettings` (con gymDays, expectedGymTime).

### Migración requerida
```bash
npm run db:push
npm run db:generate
```

---

## lib/fitness.ts

Lógica de negocio central del módulo. Todas las funciones son `async` y reciben `userId: string` como primer parámetro (excepto helpers).

### Tipos exportados

| Tipo | Descripción |
|------|-------------|
| `WorkoutWithExercises` | Workout + exercises[] + sets[] |
| `ExerciseWithSets` | Exercise con sets[] anidados |
| `WorkoutSetData` | Input para crear sets (setNumber, reps, weightKg) |
| `GymRoutineWithExercises` | Rutina + exercises[] ordenados |
| `RoutineExerciseData` | Input para ejercicio de rutina (name, sets, repsRange, order) |
| `WeeklyStatEntry` | { date, gymMinutes, cardioMinutes, totalMinutes } para gráfico |
| `LogActivityInput` | { type, durationMinutes?, distanceKm?, calories?, title? } |
| `CreateRoutineInput` | { name, days[], exercises[] } |
| `ParsedExercise` | { name, sets, reps, weightKg, notes? } — output del NLP |
| `SmartHabitStatus` | { shouldNotify, message?, expectedGymTime? } |

### Funciones de lectura

```typescript
getTodayWorkouts(userId)       // Workouts del día actual
getWorkoutHistory(userId, days) // Últimos N días (default 14)
getWeeklyStats(userId)         // 7 días para el gráfico
getTodayGymRoutine(userId)     // Rutina asignada al día de la semana actual
getRoutines(userId)            // Todas las rutinas activas
getTodayFitnessSummary(userId) // { hasWorkouts, gymSessions, cardioSessions, totalMinutes }
checkSmartHabitDeviation(userId) // SmartHabitStatus — compara gymDays + hora esperada
```

### Funciones de escritura

```typescript
logActivity(userId, input)            // Registra actividad cardio/otro
startGymWorkout(userId, title?)       // Crea workout GYM para hoy
addExerciseSets(userId, text, workoutId?) // Agrega sets a un ejercicio de gym
parseAndLogExerciseNLP(userId, text)  // NLP → parse → save (llama Claude Haiku)
createRoutine(userId, input)          // Crea rutina con ejercicios
updateRoutine(userId, id, input)      // Edita rutina
deleteRoutine(id)                     // Elimina rutina (y sus ejercicios en cascada)
updateWorkout(userId, id, data)       // Edita workout (duration, distance, etc.)
deleteWorkout(id)                     // Elimina workout
upsertWorkoutFromGarmin(userId, data) // Upsert por garminActivityId
```

### NLP de ejercicios

`parseAndLogExerciseNLP` funciona así:
1. Busca workout GYM activo del día del usuario (o lo crea)
2. Llama `parseExercisesFromText(text)` → fetch directo a Anthropic REST API
3. Usa `claude-haiku-4-5-20251001`, max_tokens: 1024
4. System prompt pide JSON `[{ name, sets, reps, weightKg }]`
5. Guarda cada ejercicio parseado con sus sets via Prisma

Ejemplo de input: `"press plano 100kg 4 reps 3 series"`
Ejemplo de output parseado: `[{ name: "Press plano", sets: 3, reps: 4, weightKg: 100 }]`

---

## lib/garmin.ts (extensión Sesión 4)

### Tipos nuevos

```typescript
type GarminActivityData = {
  garminActivityId: string;
  date: Date;
  title: string;
  type: "GYM" | "RUNNING" | "SWIMMING" | "WALKING" | "CYCLING" | "OTHER";
  durationSeconds: number;
  distanceMeters: number | null;
  calories: number | null;
  steps: number | null;
  startTimeGMT: Date;
};
```

### Función nueva

```typescript
fetchGarminActivities(userId, date, retrying?)
// Endpoint: /proxy/activitylist-service/activities/search/activities
// Params: startDate, endDate (mismo día), limit: 20
// Mapea typeKey → GarminActivityData.type via GARMIN_ACTIVITY_TYPE_MAP
```

### GARMIN_ACTIVITY_TYPE_MAP (typeKey → WorkoutType)
- `swimming`, `lap_swimming`, `pool_swimming` → `SWIMMING`
- `running`, `treadmill_running` → `RUNNING`
- `walking`, `indoor_walking` → `WALKING`
- `cycling`, `indoor_cycling`, `virtual_ride` → `CYCLING`
- `strength_training`, `gym_and_fitness_equipment` → `GYM`
- todo lo demás → `OTHER`

---

## lib/scoring.ts (actualización Sesión 4)

### Scoring de fitness — `calcFitnessScore(userId, date, workouts)`

4 bloques, 100 pts total:

| Bloque | Puntos | Criterio |
|--------|--------|----------|
| Base | 40 | Cualquier workout registrado |
| Gym | 20 | Al menos un workout de tipo GYM |
| Duración | 20 | totalMinutes >= 45 |
| Cardio | 20 | RUNNING, SWIMMING o CYCLING presente |

**Null vs 0:**
- `null` = sin datos **y** hoy no es día de gym configurado (se excluye del promedio global)
- `0` = gymDays incluye hoy **pero** no hay ningún workout registrado

### Exportación para el agente
```typescript
export async function calcFitnessScoreForDate(
  userId: string,
  date: Date
): Promise<number | null>
```

---

## API Routes

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/fitness/today` | Workouts hoy + rutina del día + smartHabit |
| GET | `/api/fitness/workout?days=14` | Historial |
| POST | `/api/fitness/workout` | Crear workout |
| GET/PATCH/DELETE | `/api/fitness/workout/[id]` | Gestionar workout |
| POST | `/api/fitness/workout/[id]/exercise` | Agregar ejercicios |
| GET | `/api/fitness/weekly-stats` | Stats 7 días para gráfico |
| GET/POST | `/api/fitness/routines` | Listar / crear rutinas |
| PATCH/DELETE | `/api/fitness/routines/[id]` | Editar / eliminar rutina |
| POST | `/api/fitness/log-exercise` | NLP → ejercicio (usa Claude) |
| POST | `/api/fitness/sync-garmin` | Sync manual desde Garmin |

### Cron Jobs (vercel.json)

| Cron | Schedule | Acción |
|------|----------|--------|
| `/api/cron/fitness-sync` | `0 6 * * *` (6 AM) | Sync Garmin de todos los usuarios con sesión activa |
| `/api/cron/fitness-habits` | `10 7 * * *` (7:10 AM) | Check smart habits, loguea desviaciones en consola |

Ambos protegidos con header `Authorization: Bearer $CRON_SECRET`.

---

## Componentes React

Todos en `components/fitness/`. Todos son Client Components (`"use client"`).

| Componente | Props principales | Descripción |
|------------|-------------------|-------------|
| `FitnessModuleClient` | `initial*` props + `garminConnected` | Wrapper principal con tabs (Hoy/Stats/Rutinas), gestiona estado y refresh |
| `TodayWorkoutCard` | `workouts`, `onDeleted`, `isRefreshing?` | Entrenamientos del día con ejercicios expandibles |
| `GymRoutineCard` | `routine`, `onStarted` | Card de la rutina esperada hoy, botón "Empezar gym" |
| `FitnessQuickActions` | `onLogged` | 5 botones rápidos (Gym/Run/Swim/Walk/Cycle) + form cardio + NLP input |
| `WeeklyVolumeChart` | `data: WeeklyStatEntry[]` | BarChart 7 días, Cell color-coded (cyan=gym, naranja=cardio, violeta=otro) |
| `WorkoutHistoryList` | `workouts`, `onDeleted` | Agrupado por día (Hoy/Ayer/fecha), expandible por workout |
| `RoutineManager` | `onChanged?` | CRUD completo de rutinas (lista + form inline crear/editar) |
| `SmartHabitAlert` | `message` | Alert naranja con ícono AlertTriangle |
| `GarminSyncButton` | `isConnected`, `onSynced` | Badge de estado + botón sync manual |

### Colores del módulo
- Gym: `#06B6D4` → `text-module-fitness`, `bg-[#06B6D4]/10`, `bg-[#06B6D4]/20`
- Cardio/Running: `text-orange-400`, `bg-orange-400/10`
- Swimming: `text-blue-400`
- Walking: `text-green-400`
- Cycling: `text-purple-400`

---

## Página `/fitness` (page.tsx)

Server Component. Carga en paralelo con `Promise.all`:
1. `getTodayWorkouts(userId)`
2. `getWorkoutHistory(userId, 14)`
3. `getWeeklyStats(userId)`
4. `getTodayGymRoutine(userId)`
5. `checkSmartHabitDeviation(userId)`
6. `checkGarminStatus(userId)`

Todos con `.catch(() => fallback)` para evitar que un error rompa la página completa.
Pasa todos los datos como props iniciales a `FitnessModuleClient`.

---

## Agente de Fitness (`agents/fitness/index.ts`)

Detecta 6 intenciones via regex:

| Intención | Palabras clave | Acción |
|-----------|---------------|--------|
| `gym_start` | "fui al gym", "hice gym" | `startGymWorkout` |
| `gym_log` | números + términos de ejercicio | `parseAndLogExerciseNLP` |
| `cardio_log` | "corrí", "nadé", "bici" | `logActivity` + parse de duración/distancia |
| `query` | "cuánto", "score", "resumen" | Arma texto con historial 7d |
| `sync_garmin` | "garmin", "sincronizar" | `fetchGarminActivities` + `upsertWorkoutFromGarmin` |
| `unknown` | fallback | Mensaje de ayuda |

### Funciones exportadas

```typescript
fitnessAgent.process(input)           // Handler principal para WhatsApp
fitnessAgent.syncGarmin(userId, date?) // Para cron jobs
fitnessAgent.checkSmartHabits(userId)  // Para cron habits
fitnessAgent.calculateScore(userId, date) // Para scoring global
fitnessAgent.getSummaryText(userId)    // Para Morning Summary (Sesión 8)
```

---

## UserSettings relevantes

Los siguientes campos de `UserSettings` son usados por este módulo:

| Campo | Tipo | Uso |
|-------|------|-----|
| `gymDays` | `String[]` | Días de gym (ej: ["MONDAY", "WEDNESDAY", "FRIDAY"]) |
| `expectedGymTime` | `String?` | Hora esperada de gym (ej: "18:00") |
| `garminSessionKey` | `String?` | Token de sesión Garmin (gestión interna) |
| `garminSessionExp` | `DateTime?` | Expiración del token Garmin |

---

## Variables de entorno (nuevas en Sesión 4)

```env
ANTHROPIC_API_KEY="sk-ant-..."   # Para NLP de ejercicios (Claude Haiku)
# Garmin ya estaba en Sesión 3:
GARMIN_EMAIL="..."
GARMIN_PASSWORD="..."
CRON_SECRET="..."
```

---

## Smart Habits — Lógica

`checkSmartHabitDeviation(userId)`:
1. Lee `UserSettings.gymDays` y `UserSettings.expectedGymTime`
2. Verifica si hoy es día de gym según `gymDays`
3. Parsea `expectedGymTime` → hora en minutos
4. Suma 60 min de gracia: si `now < expectedGymTime + 60min`, devuelve `shouldNotify: false`
5. Busca workouts GYM del día
6. Si no hay ninguno y ya pasó la hora (+ gracia): `shouldNotify: true` con mensaje
7. TODO Sesión 7: llamar Calendar API para reagendar

---

## Patrones de código importantes

### Upsert por garminActivityId
```typescript
// En upsertWorkoutFromGarmin — evita duplicados de Garmin
await db.workout.upsert({
  where: { garminActivityId: data.garminActivityId },
  create: { ...fields },
  update: { ...fields },
});
```

### Manejo de Prisma fields nuevos
Los campos `title`, `source`, `steps` se agregan con type casting hasta que `npm run db:generate` se ejecute:
```typescript
body: JSON.stringify({ type: "GYM", title: routine.name } as Parameters<typeof db.workout.create>[0]["data"])
```

### Refresh pattern en FitnessModuleClient
El cliente mantiene estado local de los workouts. Después de cualquier mutación (log, delete, sync), llama `refreshAll()` que re-fetcha `today` + `workout?days=14` + `weekly-stats` en paralelo.

---

## Comandos útiles

```bash
# Después de los cambios de schema
npm run db:push
npm run db:generate

# Development
npm run dev

# Test NLP (desde browser console)
fetch('/api/fitness/log-exercise', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: 'press plano 100kg 4 reps 3 series' })
}).then(r => r.json()).then(console.log)

# Test sync Garmin
fetch('/api/fitness/sync-garmin', { method: 'POST' }).then(r => r.json()).then(console.log)
```

---

*Sesión 4 completada — Mayo 2026*

# Skeleton Screens — Spec de Diseño
**Fecha:** 2026-06-04  
**Estado:** Aprobado (v2 — post review)  
**Páginas cubiertas:** 10 (`/`, `/sleep`, `/fitness`, `/nutrition`, `/projects`, `/ideas`, `/finances`, `/scoring`, `/tasks`, `/settings`)

---

## Contexto y problema

Todas las páginas de la app ya tienen archivos `loading.tsx` de Next.js App Router, pero todos usan el mismo `PageSkeleton` genérico (4 cards rectangulares idénticas). La excepción es `/tasks`, que no tiene `loading.tsx` y debe crearse. Esto produce una experiencia de carga visualmente desconectada del contenido real.

El objetivo es reemplazar ese skeleton genérico por **skeleton screens específicos por página** que repliquen fielmente la estructura visual de cada módulo, con una animación shimmer premium.

---

## Decisiones de diseño

| Decisión | Elección | Motivo |
|----------|----------|--------|
| Animación | **Shimmer** — clase CSS `.skeleton-shimmer` en `globals.css` | Más premium que `animate-pulse`. NO se agrega una clase Tailwind `animate-shimmer` para evitar ambigüedad. |
| Arquitectura | **Componente por página** + primitivos base | Separación de responsabilidades. Fácil de mantener por módulo. |
| Colores skeleton | `#1c1f29` (surface-container) → `#272a34` (surface-container-high) | Ya existentes en el design system Stitch. |
| `Sk.Card` | **Solo shell estático** — NO aplica shimmer | La card es el contenedor glass (`glass-card rounded-2xl`). Solo los primitivos hoja (`Sk.Line`, `Sk.Circle`, `Sk.Block`) aplican `.skeleton-shimmer`. |
| Accesibilidad | `aria-busy="true"` en el root de cada skeleton | Screen readers anuncian el estado de carga. |

---

## Arquitectura de archivos

### Nuevos archivos a crear

```
components/ui/skeletons/
├── SkeletonBase.tsx          ← átomos primitivos reutilizables
├── DashboardSkeleton.tsx
├── SleepSkeleton.tsx
├── FitnessSkeleton.tsx
├── NutritionSkeleton.tsx
├── ProjectsSkeleton.tsx
├── IdeasSkeleton.tsx
├── FinancesSkeleton.tsx
├── ScoringSkeleton.tsx
├── TasksSkeleton.tsx
└── SettingsSkeleton.tsx

app/(app)/tasks/loading.tsx   ← CREAR (no existe actualmente)
```

### Archivos a modificar

```
app/globals.css               ← agrega @keyframes shimmer + .skeleton-shimmer
app/(app)/loading.tsx         ← usa DashboardSkeleton
app/(app)/sleep/loading.tsx   ← usa SleepSkeleton
app/(app)/fitness/loading.tsx ← usa FitnessSkeleton
app/(app)/nutrition/loading.tsx ← usa NutritionSkeleton
app/(app)/projects/loading.tsx  ← usa ProjectsSkeleton
app/(app)/ideas/loading.tsx     ← usa IdeasSkeleton
app/(app)/finances/loading.tsx  ← usa FinancesSkeleton
app/(app)/scoring/loading.tsx   ← usa ScoringSkeleton
app/(app)/settings/loading.tsx  ← usa SettingsSkeleton
```

**`PageSkeleton.tsx` no se elimina** — se mantiene como fallback genérico.  
**`tailwind.config.ts` no se modifica** — el shimmer vive solo en `globals.css`.

---

## Implementación del shimmer

### `app/globals.css` — agregar al final

```css
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}

.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    #1c1f29 25%,
    #272a34 50%,
    #1c1f29 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.6s ease-in-out infinite;
  border-radius: inherit;
}
```

---

## SkeletonBase — Primitivos

`components/ui/skeletons/SkeletonBase.tsx` exporta el objeto `Sk` con sub-componentes. **Solo los primitivos hoja aplican `skeleton-shimmer`**. `Sk.Card` es un shell estático.

### API

| Componente | Props | Defaults | Uso |
|------------|-------|---------|-----|
| `Sk.Line` | `w?: string`, `h?: string`, `className?: string` | `h="h-4"`, `w="w-full"`, `rounded-lg` | Líneas de texto body |
| `Sk.LineH` | igual que `Sk.Line` | `h="h-6"`, `w="w-full"`, `rounded-lg` | Líneas heading (h1/h2 level) |
| `Sk.Circle` | `size: number`, `className?: string` | `rounded-full`, `flex-shrink-0` | Avatars, score ring, iconos, dots |
| `Sk.Block` | `h?: string`, `w?: string`, `className?: string` | `h="h-16"`, `w="w-full"`, `rounded-xl` | Bloques de contenido (charts, áreas) |
| `Sk.Card` | `children`, `className?: string` | `glass-card rounded-2xl p-4 space-y-3` | Shell de card — **sin shimmer** |
| `Sk.TabNav` | `tabs?: number` | 2 | Tab nav placeholder (segmented control) |

**`Sk.TabNav` estructura:**  
```tsx
<div className="flex p-1 bg-surface-container rounded-xl">
  {Array.from({ length: tabs }).map((_, i) => (
    <div key={i} className="flex-1 h-9 rounded-lg skeleton-shimmer" />
  ))}
</div>
```

**Root de cada skeleton page:**  
```tsx
<div className="space-y-6" aria-busy="true" aria-label="Cargando...">
  {/* contenido */}
</div>
```

---

## Skeletons por página

### 1. Dashboard (`/`)

Replica: saludo header, GlobalScoreRing, bento grid 2×3, TasksBlock, Garmin Sync button.

```
space-y-6 aria-busy:

section:
  Sk.LineH w-44          ← "Buenos dias, Matias ☀️"
  Sk.Line w-32 h-3 mt-1  ← fecha

section flex justify-center:
  Sk.Circle size=120     ← GlobalScoreRing

Grid grid-cols-2 gap-3:
  × 6 Sk.Card (aspect-square — no shimmer en card)
       flex justify-between:
         Sk.Line w-16 h-2    ← label módulo
         Sk.Circle size=20   ← icon
       mt-auto:
         Sk.LineH w-10       ← score "85"
         Sk.Line w-24 h-2 mt-1.5  ← summary text

Sk.Card:
  Sk.Line w-36           ← "Tareas de la semana"
  space-y-2 mt-2:
    × 3 flex gap-2 items-center:
        Sk.Circle size=16
        Sk.Line w-48

flex justify-center:
  Sk.Block h-11 w-44 rounded-full  ← Garmin Sync button
```

### 2. Sleep (`/sleep`)

Replica: header, QuickActions (2 botones pill), TodayCard, WeekStats (4 pills), TabNav, 3 charts.

```
space-y-6 aria-busy:

Header:
  flex gap-2: Sk.Circle size=20 + Sk.LineH w-20

Sk.Card:
  flex gap-3:
    Sk.Block h-10 w-full rounded-full  ← botón "Registrar"
    Sk.Block h-10 w-full rounded-full  ← botón "Despertar"

Sk.Card:
  Sk.LineH w-24          ← "Hoy"
  Sk.LineH h-8 w-20 mt-1 ← "7h 30min"
  flex gap-4 mt-3:
    × 3 Sk.Block h-14 w-full rounded-xl  ← calidad / inicio / fin

Grid grid-cols-4 gap-3:
  × 4 Sk.Card p-3 text-center:
      Sk.LineH h-5 w-8 mx-auto
      Sk.Line h-3 w-12 mx-auto

Sk.TabNav              ← Gráficos | Historial

Sk.Card:
  Sk.Block h-40          ← DurationChart

Sk.Card:
  Sk.Block h-32          ← QualityChart

Sk.Card:
  Sk.Block h-32          ← TimingChart
```

### 3. Fitness (`/fitness`)

Replica: header, TabNav (Today | Stats), StepsCard, GymRoutineCard, CTA button, FitnessQuickActions (carrusel de actividades).

```
space-y-6 aria-busy:

Header:
  flex gap-2: Sk.Circle size=20 + Sk.LineH w-24

Sk.TabNav              ← Today | Stats

Sk.Card:               ← StepsCard
  flex gap-4 items-center:
    Sk.Circle size=64
    div space-y-2:
      Sk.Line w-24
      Sk.LineH h-6 w-32
      Sk.Block h-2 w-full rounded-full  ← progress bar

Sk.Card:               ← GymRoutineCard
  Sk.LineH w-36
  space-y-3 mt-2:
    × 3 flex gap-2 items-center:
        Sk.Circle size=16
        Sk.Line w-40
        Sk.Line w-20 ml-auto

Sk.Block h-12 w-full rounded-full   ← CTA "Empezar workout"

Sk.Card:               ← FitnessQuickActions (carrusel actividades)
  Sk.Line h-2 w-32     ← "Registrar actividad"
  flex gap-2 overflow-hidden pb-1:
    × 5 Sk.Block h-16 w-14 flex-shrink-0 rounded-xl  ← activity icon+label
```

### 4. Nutrition (`/nutrition`)

Replica: header, WaterTracker, QuickActions NLP, MealCards (3), MacrosChart, WeekStats.

```
space-y-6 aria-busy:

Header:
  flex gap-2: Sk.Circle size=20 + Sk.LineH w-24

Sk.Card:               ← WaterTracker
  flex justify-between:
    Sk.Line w-24
    Sk.Line w-16
  Sk.Block h-3 w-full rounded-full mt-2  ← progress bar
  flex gap-2 mt-3:
    × 4 Sk.Block h-8 w-full rounded-full

Sk.Card:               ← NutritionQuickActions
  Sk.Block h-10 rounded-lg

× 3 Sk.Card:           ← MealLogCards
  flex justify-between:
    Sk.LineH w-20
    Sk.Line w-16
  Sk.Line h-3 w-40 mt-1

Sk.Card:               ← MacrosChart
  Sk.Block h-40

Grid grid-cols-3 gap-3:
  × 3 Sk.Card text-center:
      Sk.LineH h-5 w-12 mx-auto
      Sk.Line h-3 w-16 mx-auto
```

### 5. Projects (`/projects`)

Replica: header, lista de 4 project cards activos.

```
space-y-6 aria-busy:

Header:
  flex gap-2: Sk.Circle size=20 + Sk.LineH w-24

space-y-3:
  × 4 Sk.Card:
      flex justify-between items-start:
        Sk.LineH w-40
        Sk.Block h-6 w-20 rounded-full   ← status badge
      Sk.Line h-3 w-full mt-2
      Sk.Line h-3 w-3/4
      flex gap-2 mt-3:
        Sk.Block h-5 w-16 rounded-full   ← tag
        Sk.Line h-3 w-20 ml-auto        ← "2 tareas"
```

### 6. Ideas (`/ideas`)

Replica: header, stats row (3 pills), capture form, filter tabs, search, 4 idea cards.

```
space-y-6 aria-busy:

Header:
  flex gap-2: Sk.Circle size=20 + Sk.LineH w-16

Grid grid-cols-3 gap-3:
  × 3 Sk.Card text-center:
      Sk.LineH h-6 w-8 mx-auto
      Sk.Line h-3 w-14 mx-auto

Sk.Card:               ← Capture form
  flex gap-2 items-center:
    Sk.Circle size=16
    Sk.Line w-24
  Sk.Block h-16 rounded-lg mt-2         ← textarea
  flex gap-2 mt-3 flex-wrap:
    × 4 Sk.Block h-6 w-16 rounded-full  ← priority pills
    Sk.Block h-7 w-20 rounded-lg ml-auto ← submit

flex gap-2 overflow-hidden:
  × 4 Sk.Block h-7 w-20 rounded-full flex-shrink-0  ← filter tabs

Sk.Block h-9 w-full rounded-lg         ← search input

space-y-2:
  × 4 Sk.Card:         ← IdeaCards
      flex gap-3 items-start:
        Sk.Circle size=8   ← priority dot (mt-1.5)
        div flex-1:
          Sk.LineH w-48
          flex gap-1 mt-1:
            × 2 Sk.Block h-4 w-12 rounded-full  ← tags
        Sk.Block h-5 w-16 rounded-full ml-auto  ← status badge
```

### 7. Finances (`/finances`)

Replica: header con refresh icon, stats 3 cards, top categorías (5 barras), donut, evolution chart, last6months, card expenses, balances, transacciones (8 rows).

```
space-y-6 aria-busy:

flex justify-between items-center:
  Sk.Line w-28           ← mes actual
  Sk.Circle size=28      ← refresh icon button

Grid grid-cols-3 gap-2:
  × 3 Sk.Card:
      Sk.Line h-2 w-16
      Sk.LineH h-5 w-24 mt-1
      Sk.Block h-5 w-14 rounded-full mt-2  ← trend chip

Sk.Card space-y-4:      ← Top Categorías
  Sk.Line h-2 w-24      ← section label
  × 5 div:
      flex justify-between:
        Sk.Line w-24
        Sk.Line w-16
      Sk.Block h-2 w-full rounded-full

Sk.Card flex-col items-center:  ← Donut
  Sk.Circle size=176
  Grid grid-cols-2 gap-x-6 gap-y-2 w-full mt-5:
    × 6 flex gap-2 items-center:
        Sk.Circle size=10
        Sk.Line w-20

Sk.Card:               ← DailyEvolution
  Sk.Block h-36

Sk.Card:               ← Last6Months
  flex items-end justify-between h-24 gap-2:
    × 6 div flex-col items-center gap-1:
        Sk.Block h-[60%] w-5 rounded-t-sm  (height varies per bar)

Sk.Card:               ← CardExpenses
  space-y-4:
    × 3 div:
        flex justify-between: Sk.Line w-24 + Sk.Line w-20
        Sk.Block h-2 w-full rounded-full

Sk.Card:               ← Balances
  space-y-2:
    × 3 flex justify-between items-center:
        Sk.Line w-24
        Sk.Line w-20

Sk.Card px-4:          ← Transactions
  × 8 flex justify-between items-center py-2.5 border-b border-outline-variant/10:
      div:
        Sk.Line w-40
        Sk.Line h-3 w-28 mt-1
      Sk.Line w-20
```

### 8. Scoring (`/scoring`)

Replica real (`ScoringHistoryClient`): PeriodSelector → Stats grid 3 cols → Chart card → "Días recientes" lista de DailyScoreCard.

```
space-y-4 aria-busy:

Header:
  flex gap-2: Sk.Circle size=20 + Sk.LineH w-24

PeriodSelector placeholder:
  flex gap-2:
    × 3 Sk.Block h-9 w-24 rounded-full  ← daily / weekly / monthly

Grid grid-cols-3 gap-3:  ← stats Promedio/Máximo/Mínimo
  × 3 Sk.Card text-center py-3:
      Sk.LineH h-6 w-10 mx-auto
      Sk.Line h-3 w-16 mx-auto

Sk.Card space-y-4:       ← Gráfico tendencia
  flex justify-between:
    Sk.Line w-32
    Sk.Line w-28 ml-auto
  Sk.Block h-[220px] rounded-xl

div:                     ← Días recientes
  Sk.Line h-3 w-28 mb-3
  space-y-3:
    × 7 Sk.Card:         ← DailyScoreCard
        flex justify-between items-center:
          div:
            Sk.Line w-24
            Sk.Line h-3 w-16 mt-1
          Sk.LineH h-7 w-12  ← score "85"
        Sk.Block h-2 w-full rounded-full mt-2  ← progress bar
```

### 9. Tasks (`/tasks`)

Replica real (`TasksPageClient`): 3 secciones — Pendientes (task rows) + Tablero (tab switcher + KanbanBoard) + Tareas terminadas.

`app/(app)/tasks/loading.tsx` debe ser **creado** (no existe actualmente).

```
space-y-8 aria-busy:

section:               ← Sección A: Pendientes
  flex justify-between mb-3:
    Sk.Line h-2 w-20   ← "Pendientes" label
    Sk.Block h-5 w-8 rounded-full  ← count badge
  space-y-2:
    × 5 Sk.Card:
        flex gap-3 items-center:
          Sk.Circle size=18   ← checkbox
          div:
            Sk.Line w-48
            Sk.Line h-3 w-32 mt-1

section:               ← Sección B: Tablero (CRÍTICO — no omitir)
  flex justify-between mb-3:
    Sk.Line h-2 w-16   ← "Tablero" label
    flex gap-2:
      Sk.Block h-7 w-20 rounded-full   ← Notion sync
      Sk.Block h-7 w-28 rounded-xl     ← Kanban | Timeline switcher
  Sk.Block h-64 w-full rounded-2xl    ← KanbanBoard placeholder

section:               ← Sección C: Tareas terminadas
  Sk.Line h-2 w-32 mb-3  ← "Tareas terminadas" label
  space-y-2:
    × 3 Sk.Card opacity-60:
        flex gap-3 items-center:
          Sk.Circle size=18
          Sk.Line w-40
```

### 10. Settings (`/settings`)

Replica: header + 4 secciones con form rows (label + control) y toggles.

```
space-y-6 aria-busy:

Header:
  flex gap-2: Sk.Circle size=20 + Sk.LineH w-28

× 4 Sk.Card space-y-4:  ← secciones (Sueño / Gym / General / Integraciones)
  Sk.Line h-2 w-24      ← section label
  space-y-4:
    × 3 flex justify-between items-center:
        div:
          Sk.Line w-32
          Sk.Line h-3 w-48 mt-1
        Sk.Block h-7 w-12 rounded-full  ← toggle / input / badge
```

---

## Transición skeleton → contenido

- Next.js App Router reemplaza el `loading.tsx` automáticamente cuando el Server Component termina de renderizar
- El `animate-fade-in` ya presente en cada `page.tsx` garantiza que el contenido aparezca con un fade suave de 0.3s
- Los skeletons replican las mismas alturas aproximadas del contenido real, evitando layout shifts

---

## Performance

- Los componentes skeleton son **100% estáticos** — solo CSS, cero JS ejecutado, cero fetch
- La animación shimmer usa `background-position` (composited, no layout/paint)
- `SkeletonBase` es tree-shakeable: cada skeleton importa solo lo que usa
- Usar `.skeleton-shimmer` CSS (globals.css), **no** una clase Tailwind custom

---

## No incluido en este spec

- `/fitness/session` — workout activo, no tiene `loading.tsx` y el estado es muy dinámico
- `/fitness/[actividad]` — página de actividad específica, mismo motivo
- `/fitness/gym` — derivado de fitness
- `PageSkeleton.tsx` original — se mantiene sin cambios como fallback

# Skeleton Screens — Spec de Diseño
**Fecha:** 2026-06-04  
**Estado:** Aprobado  
**Páginas cubiertas:** 10 (`/`, `/sleep`, `/fitness`, `/nutrition`, `/projects`, `/ideas`, `/finances`, `/scoring`, `/tasks`, `/settings`)

---

## Contexto y problema

Todas las páginas de la app ya tienen archivos `loading.tsx` de Next.js App Router, pero todos usan el mismo `PageSkeleton` genérico (4 cards rectangulares idénticas). Esto produce una experiencia de carga visualmente desconectada del contenido real: el usuario ve 4 bloques genéricos en lugar de la estructura real de la página.

El objetivo es reemplazar ese skeleton genérico por **skeleton screens específicos por página** que repliquen fielmente la estructura visual de cada módulo, con una animación shimmer premium.

---

## Decisiones de diseño

| Decisión | Elección | Motivo |
|----------|----------|--------|
| Animación | **Shimmer** (ola de gradiente) | Más premium que `animate-pulse`. Estándar en Linear, Notion, Vercel. |
| Arquitectura | **Componente por página** + primitivos base | Separación de responsabilidades. Fácil de mantener por módulo. |
| Colores skeleton | `#1c1f29` (surface-container) → `#272a34` (surface-container-high) | Ya existentes en el design system Stitch. |
| Estructura | Réplica fiel del layout real | El skeleton debe ser "la página vacía", no una abstracción genérica. |
| Responsividad | Mobile-first (mismas clases responsive que el contenido real) | La app es mobile-first. |

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
```

### Archivos a modificar

```
tailwind.config.ts            ← agrega keyframe shimmer + clase animate-shimmer
app/globals.css               ← clase .skeleton-shimmer con gradiente + keyframe
app/(app)/loading.tsx         ← usa DashboardSkeleton
app/(app)/sleep/loading.tsx   ← usa SleepSkeleton
app/(app)/fitness/loading.tsx ← usa FitnessSkeleton
app/(app)/nutrition/loading.tsx ← usa NutritionSkeleton
app/(app)/projects/loading.tsx  ← usa ProjectsSkeleton
app/(app)/ideas/loading.tsx     ← usa IdeasSkeleton
app/(app)/finances/loading.tsx  ← usa FinancesSkeleton
app/(app)/scoring/loading.tsx   ← usa ScoringSkeleton
app/(app)/tasks/loading.tsx     ← usa TasksSkeleton
app/(app)/settings/loading.tsx  ← usa SettingsSkeleton
```

`PageSkeleton.tsx` **no se elimina** — se mantiene como fallback genérico.

---

## Implementación del shimmer

### `app/globals.css`

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

### `tailwind.config.ts` (dentro de `theme.extend`)

```ts
animation: {
  shimmer: "shimmer 1.6s ease-in-out infinite",
},
keyframes: {
  shimmer: {
    "0%":   { backgroundPosition: "-200% 0" },
    "100%": { backgroundPosition: "200% 0" },
  },
},
```

---

## SkeletonBase — Primitivos

`components/ui/skeletons/SkeletonBase.tsx` exporta el objeto `Sk` con sub-componentes:

### API

| Componente | Props | Uso |
|------------|-------|-----|
| `Sk.Line` | `w?: string`, `h?: string`, `className?: string` | Líneas de texto |
| `Sk.Circle` | `size: number`, `className?: string` | Avatars, score ring, iconos |
| `Sk.Block` | `h?: string`, `w?: string`, `className?: string` | Bloques de contenido (charts, imágenes) |
| `Sk.Card` | `children`, `className?: string` | Shell de glass card con padding |
| `Sk.TabNav` | `tabs?: number` | Placeholder de tab navigation (default 2 tabs) |

**Defaults:**
- `Sk.Line`: `h="h-4"`, `w="w-full"`, rounded-lg
- `Sk.Circle`: rounded-full, flex-shrink-0
- `Sk.Block`: `h="h-16"`, `w="w-full"`, rounded-xl
- `Sk.Card`: `glass-card rounded-2xl p-4 space-y-3`

Todos los primitivos aplican la clase `skeleton-shimmer`.

---

## Skeletons por página

### 1. Dashboard (`/`)

Replica: saludo header, GlobalScoreRing, bento grid 2×3, TasksBlock.

```
Sk.Line w-44           ← "Buenos dias, Matias ☀️"
Sk.Line w-32 h-3       ← fecha

Sk.Circle size=120     ← GlobalScoreRing (centrado)

Grid grid-cols-2 gap-3:
  × 6 Sk.Card aspect-square
      flex justify-between:
        Sk.Line w-16 h-2   ← label módulo
        Sk.Circle size=20  ← icon
      Sk.Line w-10 h-6     ← score "85"
      Sk.Line w-24 h-2     ← summary text

Sk.Card                ← TasksBlock
  Sk.Line w-28         ← "Tareas de la semana"
  × 3 flex gap-2:
      Sk.Circle size=16
      Sk.Line w-48
```

### 2. Sleep (`/sleep`)

Replica: header, QuickActions (2 botones), TodayCard, WeekStats (4 pills), TabNav, 3 charts.

```
Header: Sk.Circle size=20 + Sk.Line w-16

Sk.Card                ← QuickActions
  flex gap-3:
    Sk.Block h-10 w-full rounded-full  × 2

Sk.Card                ← TodayCard
  Sk.Line w-24
  Sk.Line h-8 w-16     ← "7h 30min"
  flex gap-4: Sk.Block h-14 × 3      ← calidad/inicio/fin

Grid grid-cols-4:
  × 4 Sk.Card text-center
      Sk.Line h-5 w-8 mx-auto
      Sk.Line h-3 w-12 mx-auto

Sk.TabNav              ← Gráficos | Historial

Sk.Card h-40           ← DurationChart
Sk.Card h-32           ← QualityChart
Sk.Card h-32           ← TimingChart
```

### 3. Fitness (`/fitness`)

Replica: header, TabNav, StepsCard, GymRoutineCard, CTA button, QuickActions.

```
Header: Sk.Circle size=20 + Sk.Line w-20

Sk.TabNav              ← Today | Stats

Sk.Card                ← StepsCard
  flex gap-4:
    Sk.Circle size=64  ← ring de pasos
    div space-y-2:
      Sk.Line w-24
      Sk.Line h-6 w-32
      Sk.Line h-2 w-full  ← progress bar

Sk.Card                ← GymRoutineCard
  Sk.Line w-32
  × 3 flex gap-2:
      Sk.Circle size=16
      Sk.Line w-40
      Sk.Line w-20 ml-auto

Sk.Block h-12 w-full rounded-full   ← CTA "Empezar workout"

Sk.Card                ← FitnessQuickActions (NLP input)
  Sk.Block h-10 rounded-lg
```

### 4. Nutrition (`/nutrition`)

Replica: header, WaterTracker, QuickActions, MealCards, MacrosChart, WeekStats.

```
Header: Sk.Circle size=20 + Sk.Line w-24

Sk.Card                ← WaterTracker
  flex justify-between:
    Sk.Line w-24
    Sk.Line w-16
  Sk.Block h-3 w-full rounded-full  ← progress bar
  flex gap-2: Sk.Block h-8 rounded-full × 4  ← botones +0.5L

Sk.Card                ← QuickActions
  Sk.Block h-10 rounded-lg

× 3 Sk.Card            ← MealLogCards
  flex justify-between:
    Sk.Line w-20
    Sk.Line w-16
  Sk.Line h-3 w-32

Sk.Card                ← MacrosChart
  Sk.Block h-40

Grid grid-cols-3:
  × 3 Sk.Card          ← WeekStats
      Sk.Line h-5 w-12 mx-auto
      Sk.Line h-3 w-16 mx-auto
```

### 5. Projects (`/projects`)

Replica: header, lista de project cards activos.

```
Header: Sk.Circle size=20 + Sk.Line w-24

× 4 Sk.Card            ← ProjectCard
  flex justify-between:
    Sk.Line w-40
    Sk.Block h-6 w-20 rounded-full  ← status badge
  Sk.Line h-3 w-full
  Sk.Line h-3 w-3/4
  flex gap-2 mt-2:
    Sk.Block h-5 w-16 rounded-full  ← tag
    Sk.Line w-20 ml-auto h-3       ← "2 tareas"
```

### 6. Ideas (`/ideas`)

Replica: header, stats row (3 pills), capture form, filter tabs, search, idea cards.

```
Header: Sk.Circle size=20 + Sk.Line w-16

Grid grid-cols-3:
  × 3 Sk.Card text-center
      Sk.Line h-6 w-8 mx-auto
      Sk.Line h-3 w-14 mx-auto

Sk.Card                ← Capture form
  flex gap-2:
    Sk.Circle size=16
    Sk.Line w-24
  Sk.Block h-16 rounded-lg     ← textarea
  flex gap-2:
    × 4 Sk.Block h-6 w-16 rounded-full  ← priority pills
    Sk.Block h-7 w-20 rounded-lg ml-auto ← submit

flex gap-2 overflow-hidden:
  × 4 Sk.Block h-7 w-20 rounded-full   ← filter tabs

Sk.Block h-9 w-full rounded-lg         ← search input

× 4 Sk.Card            ← IdeaCards
  flex gap-3:
    Sk.Circle size=8   ← priority dot
    div:
      Sk.Line w-48
      flex gap-1: Sk.Block h-4 w-12 rounded-full × 2  ← tags
    Sk.Block h-5 w-16 rounded-full ml-auto  ← status
```

### 7. Finances (`/finances`)

Replica: header, stats 3 cards, top categorías, donut, evolution chart, last6months, card expenses, balances, transacciones.

```
Header: Sk.Line w-28 + Sk.Circle size=28 ml-auto

Grid grid-cols-3 gap-2:
  × 3 Sk.Card
      Sk.Line h-2 w-16
      Sk.Line h-5 w-24
      Sk.Block h-5 w-14 rounded-full  ← trend chip

Sk.Card                ← Top Categorías
  Sk.Line h-2 w-24     ← section label
  × 5 div:
      flex justify-between: Sk.Line w-24 + Sk.Line w-16
      Sk.Block h-2 w-full rounded-full

Sk.Card flex-col items-center ← Donut
  Sk.Circle size=176         ← donut (sin agujero; shimmer sobre el círculo)
  Grid grid-cols-2 mt-4:
    × 6 flex gap-2: Sk.Circle size=10 + Sk.Line w-20

Sk.Card h-36           ← DailyEvolution SVG

Sk.Card                ← Last6Months
  flex items-end h-24 gap-2:
    × 6 div: Sk.Block h-[60%] w-5 rounded-t-sm

Sk.Card                ← Balances
  × 3 flex justify-between:
      Sk.Line w-24 + Sk.Line w-20

Sk.Card                ← Transactions
  × 8 flex justify-between py-2 border-b:
      div: Sk.Line w-40 + Sk.Line h-3 w-24
      Sk.Line w-20
```

### 8. Scoring (`/scoring`)

Replica: header, PeriodSelector, ScoreTrendChart grande, ScoreCardModule × módulos.

```
Header: Sk.Circle size=20 + Sk.Line w-20

flex gap-2:
  × 3 Sk.Block h-8 w-24 rounded-full  ← period selector pills

Sk.Card                ← ScoreTrendChart
  Sk.Block h-48

Grid grid-cols-2 gap-3:
  × 5 Sk.Card          ← ScoreCardModule por módulo
      Sk.Line h-2 w-16
      Sk.Line h-8 w-12
      Sk.Block h-2 w-full rounded-full  ← progress bar
```

### 9. Tasks (`/tasks`)

Replica: header, stats row (3 cols), ThisWeekSection (task rows), CompletedSection.

```
Header: Sk.Circle size=20 + Sk.Line w-16

Grid grid-cols-3:
  × 3 Sk.Card text-center
      Sk.Line h-5 w-8 mx-auto
      Sk.Line h-3 w-20 mx-auto

Sk.Line h-2 w-24       ← "Esta semana" label
× 5 Sk.Card            ← TaskRow
  flex gap-3:
    Sk.Circle size=18  ← checkbox
    div:
      Sk.Line w-48
      Sk.Line h-3 w-32

Sk.Line h-2 w-28 mt-2  ← "Completadas" label
× 3 Sk.Card opacity-60 ← CompletedTask rows
  flex gap-3: Sk.Circle size=18 + Sk.Line w-40
```

### 10. Settings (`/settings`)

Replica: header, secciones con rows de form (labels + inputs + toggles).

```
Header: Sk.Circle size=20 + Sk.Line w-28

× 4 Sk.Card space-y-4  ← secciones (Sueño / Gym / General / Integraciones)
  Sk.Line h-2 w-24     ← section label
  × 3 flex justify-between items-center:
      div:
        Sk.Line w-32
        Sk.Line h-3 w-48
      Sk.Block h-7 w-12 rounded-full  ← toggle / input / badge
```

---

## Transición skeleton → contenido

- Next.js App Router reemplaza el `loading.tsx` automáticamente cuando el Server Component termina de renderizar
- El `animate-fade-in` ya presente en cada `page.tsx` (`<div className="space-y-6 animate-fade-in">`) garantiza que el contenido real aparezca con un fade suave de 0.3s
- No hay saltos bruscos porque el skeleton replica el mismo layout y alturas aproximadas

---

## Performance

- Los componentes skeleton son **100% estáticos** — solo CSS, cero JS ejecutado, cero fetch
- La animación shimmer usa `background-position` (composited, no layout/paint)
- `SkeletonBase` es tree-shakeable: cada skeleton importa solo lo que usa

---

## No incluido en este spec

- `/fitness/session` (workout activo) — tiene estado muy dinámico, no tiene `loading.tsx` estático
- `/fitness/[actividad]` — página de actividad específica, mismo motivo
- `/fitness/gym` — derivado de fitness, misma lógica
- `PageSkeleton.tsx` original — se mantiene sin cambios como fallback

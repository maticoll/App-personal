# Skeleton Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el skeleton genérico de todas las páginas por skeleton screens específicos por página con animación shimmer, replicando fielmente el layout real de cada módulo.

**Architecture:** Módulo de primitivos atómicos `SkeletonBase` (Sk.Line, Sk.LineH, Sk.Circle, Sk.Block, Sk.Card, Sk.TabNav) + un componente skeleton por página. La animación shimmer vive en `globals.css` como `.skeleton-shimmer`. Cada `loading.tsx` importa su skeleton específico.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, CSS custom (globals.css). Sin framework de tests — verificación via `npx tsc --noEmit` + `npm run build`.

**Spec:** `docs/superpowers/specs/2026-06-04-skeleton-screens-design.md`

---

## File Map

| Acción | Archivo |
|--------|---------|
| Modify | `app/globals.css` |
| Create | `components/ui/skeletons/SkeletonBase.tsx` |
| Create | `components/ui/skeletons/DashboardSkeleton.tsx` |
| Create | `components/ui/skeletons/SleepSkeleton.tsx` |
| Create | `components/ui/skeletons/FitnessSkeleton.tsx` |
| Create | `components/ui/skeletons/NutritionSkeleton.tsx` |
| Create | `components/ui/skeletons/ProjectsSkeleton.tsx` |
| Create | `components/ui/skeletons/IdeasSkeleton.tsx` |
| Create | `components/ui/skeletons/FinancesSkeleton.tsx` |
| Create | `components/ui/skeletons/ScoringSkeleton.tsx` |
| Create | `components/ui/skeletons/TasksSkeleton.tsx` |
| Create | `components/ui/skeletons/SettingsSkeleton.tsx` |
| Modify | `app/(app)/loading.tsx` |
| Modify | `app/(app)/sleep/loading.tsx` |
| Modify | `app/(app)/fitness/loading.tsx` |
| Modify | `app/(app)/nutrition/loading.tsx` |
| Modify | `app/(app)/projects/loading.tsx` |
| Modify | `app/(app)/ideas/loading.tsx` |
| Modify | `app/(app)/finances/loading.tsx` |
| Modify | `app/(app)/scoring/loading.tsx` |
| **Create** | `app/(app)/tasks/loading.tsx` ← no existe, crear nuevo |
| Modify | `app/(app)/settings/loading.tsx` |

---

## Task 1: Shimmer animation en globals.css

**Files:**
- Modify: `app/globals.css`

- [ ] **Paso 1: Agregar keyframe + clase shimmer al final de globals.css**

Agregar al final del archivo (después de todos los bloques `@layer`):

```css
/* ── Skeleton shimmer animation ─────────────────────────────── */
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

- [ ] **Paso 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: 0 errores.

- [ ] **Paso 3: Commit**

```bash
git add app/globals.css
git commit -m "feat(skeleton): add shimmer animation to globals.css"
```

---

## Task 2: SkeletonBase — primitivos atómicos

**Files:**
- Create: `components/ui/skeletons/SkeletonBase.tsx`

- [ ] **Paso 1: Crear el archivo con todos los primitivos**

```tsx
// components/ui/skeletons/SkeletonBase.tsx
// Primitivos atómicos para skeleton screens.
// Sk.Card es solo shell (sin shimmer). Los primitivos hoja shimmean.

import React from "react";

function Line({
  w = "w-full",
  h = "h-4",
  className = "",
}: {
  w?: string;
  h?: string;
  className?: string;
}) {
  return <div className={`skeleton-shimmer rounded-lg ${h} ${w} ${className}`} />;
}

function LineH({
  w = "w-full",
  h = "h-6",
  className = "",
}: {
  w?: string;
  h?: string;
  className?: string;
}) {
  return <div className={`skeleton-shimmer rounded-lg ${h} ${w} ${className}`} />;
}

function Circle({
  size,
  className = "",
}: {
  size: number;
  className?: string;
}) {
  return (
    <div
      className={`skeleton-shimmer rounded-full flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

function Block({
  h = "h-16",
  w = "w-full",
  className = "",
}: {
  h?: string;
  w?: string;
  className?: string;
}) {
  return <div className={`skeleton-shimmer rounded-xl ${h} ${w} ${className}`} />;
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`card space-y-3 ${className}`}>
      {children}
    </div>
  );
}

function TabNav({ tabs = 2 }: { tabs?: number }) {
  return (
    <div className="flex p-1 bg-surface-container rounded-xl gap-1">
      {Array.from({ length: tabs }).map((_, i) => (
        <div key={i} className="flex-1 h-9 rounded-lg skeleton-shimmer" />
      ))}
    </div>
  );
}

export const Sk = { Line, LineH, Circle, Block, Card, TabNav };
```

- [ ] **Paso 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: 0 errores.

- [ ] **Paso 3: Commit**

```bash
git add components/ui/skeletons/SkeletonBase.tsx
git commit -m "feat(skeleton): add SkeletonBase primitives (Sk.Line/Circle/Block/Card/TabNav)"
```

---

## Task 3: DashboardSkeleton + loading.tsx del Dashboard

**Files:**
- Create: `components/ui/skeletons/DashboardSkeleton.tsx`
- Modify: `app/(app)/loading.tsx`

- [ ] **Paso 1: Crear DashboardSkeleton**

```tsx
// components/ui/skeletons/DashboardSkeleton.tsx
import { Sk } from "./SkeletonBase";

export default function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando...">

      {/* Saludo */}
      <section className="space-y-1">
        <Sk.LineH w="w-44" />
        <Sk.Line w="w-32" h="h-3" />
      </section>

      {/* Score Ring */}
      <section className="flex justify-center">
        <Sk.Circle size={120} />
      </section>

      {/* Bento grid 2×3 */}
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Sk.Card key={i} className="aspect-square flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <Sk.Line w="w-16" h="h-2" />
              <Sk.Circle size={20} />
            </div>
            <div className="space-y-1.5">
              <Sk.LineH w="w-10" />
              <Sk.Line w="w-24" h="h-2" />
            </div>
          </Sk.Card>
        ))}
      </div>

      {/* TasksBlock */}
      <Sk.Card>
        <Sk.Line w="w-36" />
        <div className="space-y-2 mt-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Sk.Circle size={16} />
              <Sk.Line w="w-48" />
            </div>
          ))}
        </div>
      </Sk.Card>

      {/* Garmin Sync button */}
      <div className="flex justify-center">
        <Sk.Block h="h-11" w="w-44" className="rounded-full" />
      </div>

    </div>
  );
}
```

- [ ] **Paso 2: Actualizar app/(app)/loading.tsx**

```tsx
import DashboardSkeleton from "@/components/ui/skeletons/DashboardSkeleton";
export default function Loading() {
  return <DashboardSkeleton />;
}
```

- [ ] **Paso 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: 0 errores.

- [ ] **Paso 4: Commit**

```bash
git add components/ui/skeletons/DashboardSkeleton.tsx "app/(app)/loading.tsx"
git commit -m "feat(skeleton): dashboard skeleton - score ring + bento grid + tasks"
```

---

## Task 4: SleepSkeleton + loading.tsx de Sleep

**Files:**
- Create: `components/ui/skeletons/SleepSkeleton.tsx`
- Modify: `app/(app)/sleep/loading.tsx`

- [ ] **Paso 1: Crear SleepSkeleton**

```tsx
// components/ui/skeletons/SleepSkeleton.tsx
import { Sk } from "./SkeletonBase";

export default function SleepSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando...">

      {/* Header */}
      <div className="flex items-center gap-2">
        <Sk.Circle size={20} />
        <Sk.LineH w="w-20" />
      </div>

      {/* QuickActions — 2 botones pill */}
      <Sk.Card>
        <div className="flex gap-3">
          <Sk.Block h="h-10" className="rounded-full" />
          <Sk.Block h="h-10" className="rounded-full" />
        </div>
      </Sk.Card>

      {/* TodayCard */}
      <Sk.Card>
        <Sk.LineH w="w-24" />
        <Sk.LineH h="h-8" w="w-20" />
        <div className="flex gap-4 mt-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Sk.Block key={i} h="h-14" />
          ))}
        </div>
      </Sk.Card>

      {/* WeekStats — 4 pills */}
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Sk.Card key={i} className="p-3 text-center space-y-1">
            <Sk.LineH h="h-5" w="w-8" className="mx-auto" />
            <Sk.Line h="h-3" w="w-12" className="mx-auto" />
          </Sk.Card>
        ))}
      </div>

      {/* TabNav */}
      <Sk.TabNav />

      {/* Charts */}
      <Sk.Card><Sk.Block h="h-40" /></Sk.Card>
      <Sk.Card><Sk.Block h="h-32" /></Sk.Card>
      <Sk.Card><Sk.Block h="h-32" /></Sk.Card>

    </div>
  );
}
```

- [ ] **Paso 2: Actualizar app/(app)/sleep/loading.tsx**

```tsx
import SleepSkeleton from "@/components/ui/skeletons/SleepSkeleton";
export default function Loading() {
  return <SleepSkeleton />;
}
```

- [ ] **Paso 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Paso 4: Commit**

```bash
git add components/ui/skeletons/SleepSkeleton.tsx "app/(app)/sleep/loading.tsx"
git commit -m "feat(skeleton): sleep skeleton - quick actions + today card + week stats + charts"
```

---

## Task 5: FitnessSkeleton + loading.tsx de Fitness

**Files:**
- Create: `components/ui/skeletons/FitnessSkeleton.tsx`
- Modify: `app/(app)/fitness/loading.tsx`

- [ ] **Paso 1: Crear FitnessSkeleton**

```tsx
// components/ui/skeletons/FitnessSkeleton.tsx
import { Sk } from "./SkeletonBase";

export default function FitnessSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando...">

      {/* Header */}
      <div className="flex items-center gap-2">
        <Sk.Circle size={20} />
        <Sk.LineH w="w-24" />
      </div>

      {/* TabNav — Today | Stats */}
      <Sk.TabNav />

      {/* StepsCard */}
      <Sk.Card>
        <div className="flex gap-4 items-center">
          <Sk.Circle size={64} />
          <div className="flex-1 space-y-2">
            <Sk.Line w="w-24" />
            <Sk.LineH h="h-6" w="w-32" />
            <Sk.Block h="h-2" className="rounded-full" />
          </div>
        </div>
      </Sk.Card>

      {/* GymRoutineCard */}
      <Sk.Card>
        <Sk.LineH w="w-36" />
        <div className="space-y-3 mt-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Sk.Circle size={16} />
              <Sk.Line w="w-40" />
              <Sk.Line w="w-20" className="ml-auto" />
            </div>
          ))}
        </div>
      </Sk.Card>

      {/* Daily Focus heading — visible en tab "Today" */}
      <div className="flex items-center justify-between">
        <Sk.LineH w="w-28" />
        <Sk.Line h="h-2" w="w-16" />
      </div>

      {/* CTA button */}
      <Sk.Block h="h-12" className="rounded-full" />

      {/* FitnessQuickActions — carrusel de actividades */}
      <Sk.Card>
        <Sk.Line h="h-2" w="w-32" />
        <div className="flex gap-2 overflow-hidden pb-1 mt-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Sk.Block key={i} h="h-16" w="w-14" className="flex-shrink-0 rounded-xl" />
          ))}
        </div>
      </Sk.Card>

    </div>
  );
}
```

- [ ] **Paso 2: Actualizar app/(app)/fitness/loading.tsx**

```tsx
import FitnessSkeleton from "@/components/ui/skeletons/FitnessSkeleton";
export default function Loading() {
  return <FitnessSkeleton />;
}
```

- [ ] **Paso 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Paso 4: Commit**

```bash
git add components/ui/skeletons/FitnessSkeleton.tsx "app/(app)/fitness/loading.tsx"
git commit -m "feat(skeleton): fitness skeleton - tabs + steps + routine + cta + activity carousel"
```

---

## Task 6: NutritionSkeleton + loading.tsx de Nutrition

**Files:**
- Create: `components/ui/skeletons/NutritionSkeleton.tsx`
- Modify: `app/(app)/nutrition/loading.tsx`

- [ ] **Paso 1: Crear NutritionSkeleton**

```tsx
// components/ui/skeletons/NutritionSkeleton.tsx
import { Sk } from "./SkeletonBase";

export default function NutritionSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando...">

      {/* Header */}
      <div className="flex items-center gap-2">
        <Sk.Circle size={20} />
        <Sk.LineH w="w-24" />
      </div>

      {/* WaterTracker */}
      <Sk.Card>
        <div className="flex justify-between">
          <Sk.Line w="w-24" />
          <Sk.Line w="w-16" />
        </div>
        <Sk.Block h="h-3" className="rounded-full mt-2" />
        <div className="flex gap-2 mt-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Sk.Block key={i} h="h-8" className="rounded-full" />
          ))}
        </div>
      </Sk.Card>

      {/* QuickActions NLP */}
      <Sk.Card>
        <Sk.Block h="h-10" className="rounded-lg" />
      </Sk.Card>

      {/* MealLogCards × 3 */}
      {Array.from({ length: 3 }).map((_, i) => (
        <Sk.Card key={i}>
          <div className="flex justify-between">
            <Sk.LineH w="w-20" />
            <Sk.Line w="w-16" />
          </div>
          <Sk.Line h="h-3" w="w-40" />
        </Sk.Card>
      ))}

      {/* MacrosChart */}
      <Sk.Card><Sk.Block h="h-40" /></Sk.Card>

      {/* WeekStats */}
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Sk.Card key={i} className="text-center space-y-1">
            <Sk.LineH h="h-5" w="w-12" className="mx-auto" />
            <Sk.Line h="h-3" w="w-16" className="mx-auto" />
          </Sk.Card>
        ))}
      </div>

    </div>
  );
}
```

- [ ] **Paso 2: Actualizar app/(app)/nutrition/loading.tsx**

```tsx
import NutritionSkeleton from "@/components/ui/skeletons/NutritionSkeleton";
export default function Loading() {
  return <NutritionSkeleton />;
}
```

- [ ] **Paso 3: Verificar + Commit**

```bash
npx tsc --noEmit
git add components/ui/skeletons/NutritionSkeleton.tsx "app/(app)/nutrition/loading.tsx"
git commit -m "feat(skeleton): nutrition skeleton - water + meals + macros + week stats"
```

---

## Task 7: ProjectsSkeleton + loading.tsx de Projects

**Files:**
- Create: `components/ui/skeletons/ProjectsSkeleton.tsx`
- Modify: `app/(app)/projects/loading.tsx`

- [ ] **Paso 1: Crear ProjectsSkeleton**

```tsx
// components/ui/skeletons/ProjectsSkeleton.tsx
import { Sk } from "./SkeletonBase";

export default function ProjectsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando...">

      {/* Header */}
      <div className="flex items-center gap-2">
        <Sk.Circle size={20} />
        <Sk.LineH w="w-24" />
      </div>

      {/* Project cards × 4 */}
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Sk.Card key={i}>
            <div className="flex justify-between items-start">
              <Sk.LineH w="w-40" />
              <Sk.Block h="h-6" w="w-20" className="rounded-full" />
            </div>
            <Sk.Line h="h-3" w="w-full" />
            <Sk.Line h="h-3" w="w-3/4" />
            <div className="flex gap-2 mt-1">
              <Sk.Block h="h-5" w="w-16" className="rounded-full" />
              <Sk.Line h="h-3" w="w-20" className="ml-auto" />
            </div>
          </Sk.Card>
        ))}
      </div>

    </div>
  );
}
```

- [ ] **Paso 2: Actualizar app/(app)/projects/loading.tsx**

```tsx
import ProjectsSkeleton from "@/components/ui/skeletons/ProjectsSkeleton";
export default function Loading() {
  return <ProjectsSkeleton />;
}
```

- [ ] **Paso 3: Verificar + Commit**

```bash
npx tsc --noEmit
git add components/ui/skeletons/ProjectsSkeleton.tsx "app/(app)/projects/loading.tsx"
git commit -m "feat(skeleton): projects skeleton - active project cards list"
```

---

## Task 8: IdeasSkeleton + loading.tsx de Ideas

**Files:**
- Create: `components/ui/skeletons/IdeasSkeleton.tsx`
- Modify: `app/(app)/ideas/loading.tsx`

- [ ] **Paso 1: Crear IdeasSkeleton**

```tsx
// components/ui/skeletons/IdeasSkeleton.tsx
import { Sk } from "./SkeletonBase";

export default function IdeasSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Cargando...">

      {/* Header */}
      <div className="flex items-center gap-2">
        <Sk.Circle size={20} />
        <Sk.LineH w="w-16" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Sk.Card key={i} className="text-center space-y-1">
            <Sk.LineH h="h-6" w="w-8" className="mx-auto" />
            <Sk.Line h="h-3" w="w-14" className="mx-auto" />
          </Sk.Card>
        ))}
      </div>

      {/* Capture form */}
      <Sk.Card>
        <div className="flex gap-2 items-center">
          <Sk.Circle size={16} />
          <Sk.Line w="w-24" />
        </div>
        <Sk.Block h="h-16" className="rounded-lg mt-2" />
        <div className="flex gap-2 mt-3 flex-wrap">
          {Array.from({ length: 4 }).map((_, i) => (
            <Sk.Block key={i} h="h-6" w="w-16" className="rounded-full" />
          ))}
          <Sk.Block h="h-7" w="w-20" className="rounded-lg ml-auto" />
        </div>
      </Sk.Card>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <Sk.Block key={i} h="h-7" w="w-20" className="rounded-full flex-shrink-0" />
        ))}
      </div>

      {/* Search */}
      <Sk.Block h="h-9" className="rounded-lg" />

      {/* Idea cards */}
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Sk.Card key={i} className="space-y-0">
            <div className="flex gap-3 items-start">
              <Sk.Circle size={8} className="mt-1.5" />
              <div className="flex-1 space-y-1">
                <Sk.LineH w="w-48" />
                <div className="flex gap-1">
                  <Sk.Block h="h-4" w="w-12" className="rounded-full" />
                  <Sk.Block h="h-4" w="w-12" className="rounded-full" />
                </div>
              </div>
              <Sk.Block h="h-5" w="w-16" className="rounded-full ml-auto flex-shrink-0" />
            </div>
          </Sk.Card>
        ))}
      </div>

    </div>
  );
}
```

- [ ] **Paso 2: Actualizar app/(app)/ideas/loading.tsx**

```tsx
import IdeasSkeleton from "@/components/ui/skeletons/IdeasSkeleton";
export default function Loading() {
  return <IdeasSkeleton />;
}
```

- [ ] **Paso 3: Verificar + Commit**

```bash
npx tsc --noEmit
git add components/ui/skeletons/IdeasSkeleton.tsx "app/(app)/ideas/loading.tsx"
git commit -m "feat(skeleton): ideas skeleton - stats + capture form + filters + idea cards"
```

---

## Task 9: FinancesSkeleton + loading.tsx de Finances

**Files:**
- Create: `components/ui/skeletons/FinancesSkeleton.tsx`
- Modify: `app/(app)/finances/loading.tsx`

- [ ] **Paso 1: Crear FinancesSkeleton**

```tsx
// components/ui/skeletons/FinancesSkeleton.tsx
import { Sk } from "./SkeletonBase";

export default function FinancesSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando...">

      {/* Header con refresh icon */}
      <div className="flex justify-between items-center">
        <Sk.Line w="w-28" />
        <Sk.Circle size={28} />
      </div>

      {/* Stats — 3 cards */}
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Sk.Card key={i} className="space-y-1">
            <Sk.Line h="h-2" w="w-16" />
            <Sk.LineH h="h-5" w="w-24" />
            <Sk.Block h="h-5" w="w-14" className="rounded-full" />
          </Sk.Card>
        ))}
      </div>

      {/* Top Categorías */}
      <Sk.Card className="space-y-4">
        <Sk.Line h="h-2" w="w-24" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex justify-between">
              <Sk.Line w="w-24" />
              <Sk.Line w="w-16" />
            </div>
            <Sk.Block h="h-2" className="rounded-full" />
          </div>
        ))}
      </Sk.Card>

      {/* Donut */}
      <Sk.Card className="flex flex-col items-center">
        <Sk.Circle size={176} />
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 w-full mt-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Sk.Circle size={10} />
              <Sk.Line w="w-20" />
            </div>
          ))}
        </div>
      </Sk.Card>

      {/* DailyEvolution chart */}
      <Sk.Card><Sk.Block h="h-36" /></Sk.Card>

      {/* Last6Months — alturas fijas para que Tailwind no purgue en producción */}
      <Sk.Card>
        <Sk.Line h="h-2" w="w-24" />
        <div className="flex justify-between items-end h-24 gap-2 mt-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex-1 flex items-end justify-center">
              <Sk.Block h="h-16" w="w-5" className="rounded-t-sm" />
            </div>
          ))}
        </div>
      </Sk.Card>

      {/* Balances por cuenta */}
      <Sk.Card className="space-y-2">
        <Sk.Line h="h-2" w="w-24" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex justify-between items-center">
            <Sk.Line w="w-24" />
            <Sk.Line w="w-20" />
          </div>
        ))}
      </Sk.Card>

      {/* Transacciones */}
      <Sk.Card className="space-y-0 px-0">
        <div className="flex justify-between items-center px-4 pb-2">
          <Sk.Line h="h-2" w="w-32" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex justify-between items-center px-4 py-2.5 border-b border-outline-variant/10 last:border-0"
          >
            <div className="space-y-1">
              <Sk.Line w="w-40" />
              <Sk.Line h="h-3" w="w-28" />
            </div>
            <Sk.Line w="w-20" />
          </div>
        ))}
      </Sk.Card>

    </div>
  );
}
```

- [ ] **Paso 2: Actualizar `app/(app)/finances/loading.tsx`**

```tsx
import FinancesSkeleton from "@/components/ui/skeletons/FinancesSkeleton";
export default function Loading() {
  return <FinancesSkeleton />;
}
```

- [ ] **Paso 3: Verificar + Commit**

```bash
npx tsc --noEmit
git add components/ui/skeletons/FinancesSkeleton.tsx "app/(app)/finances/loading.tsx"
git commit -m "feat(skeleton): finances skeleton - stats + categories + donut + charts + transactions"
```

---

## Task 10: ScoringSkeleton + loading.tsx de Scoring

**Files:**
- Create: `components/ui/skeletons/ScoringSkeleton.tsx`
- Modify: `app/(app)/scoring/loading.tsx`

- [ ] **Paso 1: Crear ScoringSkeleton**

Replica real de `ScoringHistoryClient`: PeriodSelector → stats grid → chart card → "Días recientes" lista de DailyScoreCard.

```tsx
// components/ui/skeletons/ScoringSkeleton.tsx
import { Sk } from "./SkeletonBase";

export default function ScoringSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando...">

      {/* Header */}
      <div className="flex items-center gap-2">
        <Sk.Circle size={20} />
        <Sk.LineH w="w-24" />
      </div>

      {/* PeriodSelector */}
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Sk.Block key={i} h="h-9" w="w-24" className="rounded-full" />
        ))}
      </div>

      {/* Stats Promedio/Máximo/Mínimo */}
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Sk.Card key={i} className="text-center py-3 space-y-1">
            <Sk.LineH h="h-6" w="w-10" className="mx-auto" />
            <Sk.Line h="h-3" w="w-16" className="mx-auto" />
          </Sk.Card>
        ))}
      </div>

      {/* Chart card — h-56 (224px) aproxima los 220px reales sin clases dinámicas */}
      <Sk.Card className="space-y-4">
        <div className="flex justify-between items-center">
          <Sk.Line w="w-32" />
          <Sk.Line w="w-28" />
        </div>
        <Sk.Block h="h-56" className="rounded-xl" />
      </Sk.Card>

      {/* Días recientes */}
      <div>
        <Sk.Line h="h-3" w="w-28" className="mb-3" />
        <div className="space-y-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Sk.Card key={i} className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <Sk.Line w="w-24" />
                  <Sk.Line h="h-3" w="w-16" />
                </div>
                <Sk.LineH h="h-7" w="w-12" />
              </div>
              <Sk.Block h="h-2" className="rounded-full" />
            </Sk.Card>
          ))}
        </div>
      </div>

    </div>
  );
}
```

- [ ] **Paso 2: Actualizar app/(app)/scoring/loading.tsx**

```tsx
import ScoringSkeleton from "@/components/ui/skeletons/ScoringSkeleton";
export default function Loading() {
  return <ScoringSkeleton />;
}
```

- [ ] **Paso 3: Verificar + Commit**

```bash
npx tsc --noEmit
git add components/ui/skeletons/ScoringSkeleton.tsx "app/(app)/scoring/loading.tsx"
git commit -m "feat(skeleton): scoring skeleton - period selector + stats + chart + daily cards"
```

---

## Task 11: TasksSkeleton + CREAR loading.tsx de Tasks

**Files:**
- Create: `components/ui/skeletons/TasksSkeleton.tsx`
- **Create**: `app/(app)/tasks/loading.tsx` ← este archivo NO existe, debe crearse

- [ ] **Paso 1: Crear TasksSkeleton**

Replica real de `TasksPageClient`: 3 secciones (Pendientes + Tablero + Tareas terminadas).

```tsx
// components/ui/skeletons/TasksSkeleton.tsx
import { Sk } from "./SkeletonBase";

export default function TasksSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Cargando...">

      {/* Header */}
      <div className="flex items-center gap-2">
        <Sk.Circle size={20} />
        <Sk.LineH w="w-16" />
      </div>

      {/* Sección A: Pendientes */}
      <section>
        <div className="flex justify-between items-center mb-3">
          <Sk.Line h="h-2" w="w-20" />
          <Sk.Block h="h-5" w="w-8" className="rounded-full" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Sk.Card key={i} className="space-y-0">
              <div className="flex gap-3 items-center">
                <Sk.Circle size={18} />
                <div className="flex-1 space-y-1">
                  <Sk.Line w="w-48" />
                  <Sk.Line h="h-3" w="w-32" />
                </div>
              </div>
            </Sk.Card>
          ))}
        </div>
      </section>

      {/* Sección B: Tablero — CRÍTICO no omitir */}
      <section>
        <div className="flex justify-between items-center mb-3">
          <Sk.Line h="h-2" w="w-16" />
          <div className="flex gap-2">
            <Sk.Block h="h-7" w="w-20" className="rounded-full" />
            <Sk.Block h="h-7" w="w-28" className="rounded-xl" />
          </div>
        </div>
        <Sk.Block h="h-64" className="rounded-2xl" />
      </section>

      {/* Sección C: Tareas terminadas */}
      <section>
        <Sk.Line h="h-2" w="w-32" className="mb-3" />
        <div className="space-y-2 opacity-60">
          {Array.from({ length: 3 }).map((_, i) => (
            <Sk.Card key={i} className="space-y-0">
              <div className="flex gap-3 items-center">
                <Sk.Circle size={18} />
                <Sk.Line w="w-40" />
              </div>
            </Sk.Card>
          ))}
        </div>
      </section>

    </div>
  );
}
```

- [ ] **Paso 2: CREAR app/(app)/tasks/loading.tsx**

Este archivo no existe — crearlo desde cero:

```tsx
import TasksSkeleton from "@/components/ui/skeletons/TasksSkeleton";
export default function Loading() {
  return <TasksSkeleton />;
}
```

- [ ] **Paso 3: Verificar + Commit**

```bash
npx tsc --noEmit
git add components/ui/skeletons/TasksSkeleton.tsx "app/(app)/tasks/loading.tsx"
git commit -m "feat(skeleton): tasks skeleton - pendientes + tablero kanban + completadas"
```

---

## Task 12: SettingsSkeleton + loading.tsx de Settings

**Files:**
- Create: `components/ui/skeletons/SettingsSkeleton.tsx`
- Modify: `app/(app)/settings/loading.tsx`

- [ ] **Paso 1: Crear SettingsSkeleton**

```tsx
// components/ui/skeletons/SettingsSkeleton.tsx
import { Sk } from "./SkeletonBase";

export default function SettingsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando...">

      {/* Header */}
      <div className="flex items-center gap-2">
        <Sk.Circle size={20} />
        <Sk.LineH w="w-28" />
      </div>

      {/* 4 secciones de settings */}
      {Array.from({ length: 4 }).map((_, section) => (
        <Sk.Card key={section} className="space-y-4">
          <Sk.Line h="h-2" w="w-24" />
          {Array.from({ length: 3 }).map((_, row) => (
            <div key={row} className="flex justify-between items-center">
              <div className="space-y-1">
                <Sk.Line w="w-32" />
                <Sk.Line h="h-3" w="w-48" />
              </div>
              <Sk.Block h="h-7" w="w-12" className="rounded-full flex-shrink-0 ml-4" />
            </div>
          ))}
        </Sk.Card>
      ))}

    </div>
  );
}
```

- [ ] **Paso 2: Actualizar app/(app)/settings/loading.tsx**

```tsx
import SettingsSkeleton from "@/components/ui/skeletons/SettingsSkeleton";
export default function Loading() {
  return <SettingsSkeleton />;
}
```

- [ ] **Paso 3: Verificar + Commit**

```bash
npx tsc --noEmit
git add components/ui/skeletons/SettingsSkeleton.tsx "app/(app)/settings/loading.tsx"
git commit -m "feat(skeleton): settings skeleton - 4 sections with form rows and toggles"
```

---

## Task 13: Verificación final TypeScript + Build

**Files:** ninguno — solo verificación

- [ ] **Paso 1: TypeScript check completo**

```bash
npx tsc --noEmit
```

Esperado: **0 errores**.

Si hay errores de tipo: revisar que las props de `Sk.*` usen solo strings Tailwind válidos. El tipo más común de error es pasar `undefined` donde se espera `string`.

- [ ] **Paso 2: Build de producción**

```bash
npm run build
```

Esperado: build exitoso sin errores. Los warnings de `Dynamic server usage` son esperados y no son errores.

- [ ] **Paso 3: Verificación visual manual**

En el servidor de dev (`npm run dev`):
1. Navegar a cada ruta y observar el skeleton mientras carga (puede ser muy rápido en local)
2. Para forzar lentitud y ver el skeleton: en Chrome DevTools → Network → throttle a "Slow 3G"
3. Verificar que cada skeleton replica el layout de la página real

Checklist visual por página:
- [ ] `/` — Score ring centrado + bento grid 2×3 + task rows
- [ ] `/sleep` — 2 botones pill + today card + 4 pills + tab nav + 3 charts
- [ ] `/fitness` — tab nav + steps ring + routine rows + CTA pill + activity carousel
- [ ] `/nutrition` — water tracker + meals × 3 + macros + week stats
- [ ] `/projects` — 4 project cards con status badge
- [ ] `/ideas` — stats × 3 + capture form + filter tabs + search + idea cards × 4
- [ ] `/finances` — stats × 3 + categories + donut + charts + balances + transactions
- [ ] `/scoring` — period selector + stats × 3 + chart + daily cards × 7
- [ ] `/tasks` — pendientes + tablero (h-64) + completadas
- [ ] `/settings` — 4 secciones con rows

- [ ] **Paso 4: Commit final**

```bash
git add -A
git commit -m "feat(skeleton): skeleton screens completos - verificacion final OK"
```

---

## Notas de implementación

**No modificar:**
- `components/ui/PageSkeleton.tsx` — se mantiene como fallback
- `tailwind.config.ts` — el shimmer vive solo en `globals.css`
- `/fitness/session`, `/fitness/[actividad]`, `/fitness/gym` — no tienen `loading.tsx`

**Si Tailwind purga clases dinámicas:**
No usar template literals en clases Tailwind (ej. `h-[${pct}%]`). Usar clases estáticas (ej. `h-16`).

**Shimmer en modo light (si se implementa en el futuro):**
Los colores `#1c1f29` y `#272a34` son dark-only. Si se agrega modo light, actualizar los colores en `.skeleton-shimmer`.

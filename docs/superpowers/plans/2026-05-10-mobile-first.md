# Mobile-First Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir Dashboard, Sueño y Fitness a layouts mobile-first mediante ajustes de clases Tailwind y reordenamiento de JSX, sin tocar lógica de negocio.

**Architecture:** Solo cambios de presentación — clases Tailwind responsive, reordenamiento de elementos JSX, y un nuevo bloque mobile en `ScoringDashboard`. Cero cambios a API routes, hooks o lógica de scoring.

**Tech Stack:** Next.js App Router, Tailwind CSS 3, Recharts, lucide-react

**Spec:** `docs/superpowers/specs/2026-05-10-mobile-first-design.md`

---

## Decisiones pre-implementación (waivers al spec)

El spec fue escrito antes de leer el código actual. Tras inspección, estos archivos están mejor de lo esperado y se documentan las decisiones:

| Archivo | Spec decía | Código actual | Decisión |
|---------|-----------|---------------|----------|
| `SleepQuickActions.tsx` | `py-4 text-base rounded-2xl` | `py-5 text-lg rounded-2xl` — **ya mejor** | ✅ Sin cambio. Verificar solo en Step 3a |
| `SleepWeekStats.tsx` | `grid-cols-2 sm:grid-cols-4` | Ya tiene `grid-cols-2 sm:grid-cols-4` | ✅ Sin cambio |
| `SleepDurationChart.tsx` | `aspect-[4/3] w-full` | `ResponsiveContainer width="100%" height={180}` — el ancho es 100% ya; la altura fija 180px es mejor que aspect-ratio en charts (evita charts demasiado grandes en mobile) | ✅ Sin cambio en altura. El width 100% ya está |
| `SleepQualityChart.tsx` | `aspect-[4/3] w-full` | Mismo que arriba, height={160} | ✅ Sin cambio |
| `SleepTimingChart.tsx` | `aspect-[4/3] w-full` | Mismo que arriba, height={200} | ✅ Sin cambio |
| `WeeklyVolumeChart.tsx` | `aspect-[4/3] w-full` | `h-44` (176px) con `ResponsiveContainer width="100%"` | ✅ Sin cambio |
| `WorkoutHistoryList.tsx` layout | `flex-col` mobile / `md:flex-row` desktop | El `HistoryItem` ya tiene layout horizontal `flex items-center gap-3` que funciona bien en 375px. Apilarlo en `flex-col` daría UX peor (icono solo → contenido → botones separados) | ✅ Solo mejorar touch targets de los botones |
| `WeeklyVolumeChart.tsx` | `aspect-[4/3] w-full` | `h-44` (176px) con `ResponsiveContainer width="100%"` ya correcto. Altura fija es mejor que aspect-ratio para charts en mobile | ✅ Sin cambio |
| `GymRoutineCard.tsx` padding | `p-3 md:p-4` | `.card` global ya tiene `@apply p-4`. Diferencia de 4px no afecta usabilidad | ✅ Sin cambio |
| `SleepTodayCard.tsx` stats grid | `grid-cols-2 sm:grid-cols-4` | El componente no tiene un grid para stats — tiene un `flex` de extra stats (SpO2, Resp, Body Battery). `flex-wrap` del Task 3c es la solución correcta | ✅ Cubierto en Task 3c |
| `FitnessQuickActions.tsx` buttons | `w-full py-4` en botones | Los 5 botones están en `grid-cols-5` — no pueden ser `w-full`. Con `p-3` dan ~64px de altura (suficiente). Solo se agrega `text-base` a los inputs | ✅ Solo `text-base` en inputs |

---

## Task 1: BottomNav — touch targets y active indicator

**Files:**
- Modify: `components/layout/BottomNav.tsx`

- [ ] **Step 1: Agrandar touch targets y agregar dot activo**

En `components/layout/BottomNav.tsx`, dentro del map de `MOBILE_NAV` (línea ~41), reemplazar el `<Link>` completo:

```tsx
<Link
  key={href}
  href={href}
  className={cn(
    "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors min-w-[60px] relative",
    isActive
      ? "text-[var(--accent)]"
      : "text-[var(--text-muted)]"
  )}
>
  {/* Dot indicator cuando está activo */}
  {isActive && (
    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--accent)]" />
  )}
  <Icon className="w-5 h-5" />
  <span className="text-[10px] font-medium">{label}</span>
</Link>
```

- [ ] **Step 2: Verificar en dev server**

```bash
npm run dev
```

Abrir en mobile viewport (375px). Verificar que los ítems tienen suficiente área de toque y el ítem activo muestra el dot.

- [ ] **Step 3: Commit**

```bash
git add components/layout/BottomNav.tsx
git commit -m "ui: improve BottomNav touch targets and active indicator"
```

---

## Task 2: Dashboard — tipografía, grid y ScoringDashboard mobile

**Files:**
- Modify: `app/(app)/page.tsx`
- Modify: `components/scoring/ScoringDashboard.tsx`
- Modify: `components/dashboard/ModuleSummaryCard.tsx`

### 2a — Dashboard page

- [ ] **Step 1: Reducir tipografía de saludo en mobile**

En `app/(app)/page.tsx`, línea 168:
```tsx
// ANTES:
<h2 className="text-2xl font-bold text-[var(--text-primary)]">

// DESPUÉS:
<h2 className="text-xl md:text-2xl font-bold text-[var(--text-primary)]">
```

- [ ] **Step 2: Cambiar grid de módulos a 1 columna en mobile**

Línea 211:
```tsx
// ANTES:
<div className="grid grid-cols-2 md:grid-cols-3 gap-3">

// DESPUÉS:
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
```

### 2b — ModuleSummaryCard (layout horizontal en mobile)

- [ ] **Step 3: Verificar import de ScoreBar y agregar layout horizontal para mobile**

Confirmar que `components/dashboard/ModuleSummaryCard.tsx` ya importa `ScoreBar`:
```tsx
import { ScoreBar } from "@/components/ui/ScoreBar";
```
Si no existe, agregarlo. Luego reemplazar el contenido del return:

```tsx
export function ModuleSummaryCard({
  href,
  label,
  icon,
  bgColor,
  score,
  summary,
  badge,
}: ModuleSummaryCardProps) {
  return (
    <Link
      href={href}
      className="card hover:bg-[var(--surface-hover)] active:scale-[0.98] transition-all duration-150 group block min-h-[56px]"
    >
      {/* Mobile: layout horizontal */}
      <div className="flex items-center gap-3 md:hidden">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", bgColor)}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-[var(--text-primary)] text-sm">{label}</p>
            {badge && (
              <span className="text-xs bg-[var(--surface-hover)] text-[var(--text-secondary)] px-2 py-0.5 rounded-full shrink-0">
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-1">{summary}</p>
          {score !== null && (
            <div className="mt-1.5 h-1 rounded-full bg-[var(--surface-alt)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${score}%`,
                  background: `hsl(${score * 1.2}, 65%, 50%)`,
                }}
              />
            </div>
          )}
        </div>
        {score !== null && (
          <span className="text-sm font-bold text-[var(--text-primary)] shrink-0 w-8 text-right">
            {score}
          </span>
        )}
      </div>

      {/* Desktop: layout vertical (original) */}
      <div className="hidden md:block space-y-3">
        <div className="flex items-start justify-between">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", bgColor)}>
            {icon}
          </div>
          {badge && (
            <span className="text-xs bg-[var(--surface-hover)] text-[var(--text-secondary)] px-2 py-0.5 rounded-full">
              {badge}
            </span>
          )}
        </div>
        <div>
          <p className="font-medium text-[var(--text-primary)] text-sm">{label}</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-1">{summary}</p>
        </div>
        {score !== null && (
          <ScoreBar score={score} size="sm" showValue={false} />
        )}
      </div>
    </Link>
  );
}
```

### 2c — ScoringDashboard mobile layout

- [ ] **Step 4: Agregar layout mobile al ScoringDashboard**

En `components/scoring/ScoringDashboard.tsx`, reemplazar el return completo:

```tsx
export function ScoringDashboard({ todayScore }: ScoringDashboardProps) {
  const global = todayScore?.global ?? null;
  const details = todayScore?.details;

  return (
    <div className="space-y-4">
      {/* ─── Mobile: score inline + lista con barras ─────────── */}
      <div className="block md:hidden space-y-3">
        {/* Score inline */}
        <div className="flex items-center gap-4 p-3 bg-[var(--surface-hover)] rounded-2xl">
          <GlobalScoreRing score={global} size="sm" />
          <div>
            <div className="text-3xl font-bold text-[var(--text-primary)] leading-none">
              {global !== null ? global : "—"}
              <span className="text-sm font-normal text-[var(--text-secondary)] ml-1">/100</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {global === null
                ? "Sin datos aún"
                : global >= 80
                ? "Excelente día 💪"
                : global >= 60
                ? "Buen ritmo"
                : "Podés mejorar"}
            </p>
          </div>
        </div>

        {/* Lista de módulos con barras */}
        <div className="space-y-2">
          {MODULE_CONFIG.map(({ key, label, icon: Icon, color, bgColor }) => {
            const score =
              key === "sleep"
                ? todayScore?.sleep
                : key === "fitness"
                ? todayScore?.fitness
                : key === "nutrition"
                ? todayScore?.nutrition
                : todayScore?.projects;

            const s = score ?? null;

            return (
              <div key={key} className="flex items-center gap-3 py-1">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", bgColor)}>
                  <Icon className={cn("w-4 h-4", color)} />
                </div>
                <span className="text-sm text-[var(--text-secondary)] w-20 shrink-0">{label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-[var(--surface-alt)] overflow-hidden">
                  {s !== null && (
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${s}%`,
                        background: `hsl(${s * 1.2}, 65%, 50%)`,
                      }}
                    />
                  )}
                </div>
                <span className="text-sm font-semibold text-[var(--text-primary)] w-8 text-right shrink-0">
                  {s !== null ? s : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Desktop: anillo grande + cards expandibles ──────── */}
      <div className="hidden md:block space-y-4">
        <div className="flex justify-center py-2">
          <GlobalScoreRing score={global} size="lg" />
        </div>
        <div className="space-y-2">
          {MODULE_CONFIG.map(({ key, label, icon, color, bgColor }) => {
            const score =
              key === "sleep"
                ? todayScore?.sleep
                : key === "fitness"
                ? todayScore?.fitness
                : key === "nutrition"
                ? todayScore?.nutrition
                : todayScore?.projects;

            const moduleDetails = details?.[key];

            return (
              <ScoreCardModule
                key={key}
                label={label}
                icon={icon}
                score={score ?? null}
                color={color}
                bgColor={bgColor}
                met={moduleDetails?.met ?? []}
                missed={moduleDetails?.missed ?? []}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verificar dashboard en mobile y desktop**

```bash
npm run dev
```

- Mobile (375px): saludo `text-xl`, módulos en lista vertical, score inline compacto
- Desktop (1280px): saludo `text-2xl`, anillo grande centrado, grid 2 columnas con cards expandibles

- [ ] **Step 6: Commit**

```bash
git add app/(app)/page.tsx components/scoring/ScoringDashboard.tsx components/dashboard/ModuleSummaryCard.tsx
git commit -m "ui: mobile-first dashboard — compact score + horizontal module list"
```

---

## Task 3: Módulo Sueño — reorden y touch targets

**Files:**
- Modify: `components/sleep/SleepModuleClient.tsx`
- Modify: `components/sleep/SleepTodayCard.tsx`

### 3a — Verificar SleepQuickActions (no requiere cambios)

- [ ] **Step 1: Confirmar que SleepQuickActions ya cumple los requisitos**

Abrir `components/sleep/SleepQuickActions.tsx` y verificar que los botones tienen:
- `w-full` ✓
- `py-5` (mayor que el `py-4` del spec) ✓
- `rounded-2xl` ✓
- `text-lg` (mayor que `text-base` del spec) ✓

Si alguno falta, agregarlo. Si todos están presentes, continuar sin cambios.

### 3b — SleepModuleClient: mover GarminSync al tab de gráficos

- [ ] **Step 2: Reubicar GarminSyncButton dentro del tab "charts"**

En `components/sleep/SleepModuleClient.tsx`:

**Eliminar** el bloque de `<GarminSyncButton>` que está entre `SleepWeekStats` y los tabs (alrededor de línea 160):
```tsx
// ELIMINAR:
<GarminSyncButton
  isConnected={garminConnected}
  lastSync={garminLastSync}
  onSync={handleGarminSync}
/>
```

**Agregar** ese mismo bloque al final del tab "charts", dentro del branch de `history.length > 0`:
```tsx
{activeTab === "charts" ? (
  <div className="space-y-4">
    {history.length === 0 ? (
      <div className="card text-center py-10">
        {/* ... empty state existente ... */}
      </div>
    ) : (
      <>
        <SleepDurationChart history={history} days={7} />
        <SleepQualityChart history={history} />
        <SleepTimingChart history={history} />
        {/* Garmin sync — al final del tab de gráficos */}
        <GarminSyncButton
          isConnected={garminConnected}
          lastSync={garminLastSync}
          onSync={handleGarminSync}
        />
      </>
    )}
  </div>
) : (
  <SleepHistoryList history={history} onDelete={handleDelete} />
)}
```

### 3c — SleepTodayCard: stats extra con flex-wrap

- [ ] **Step 3: Agregar flex-wrap a los stats extra de Garmin**

En `components/sleep/SleepTodayCard.tsx`, el div de stats extra al final (línea ~189):
```tsx
// ANTES:
<div className="flex gap-4 pt-1 border-t border-[var(--border)]">

// DESPUÉS:
<div className="flex flex-wrap gap-x-4 gap-y-2 pt-2 border-t border-[var(--border)]">
```

- [ ] **Step 4: Verificar módulo de sueño en mobile**

```bash
npm run dev
```

En `/sleep` con viewport 375px verificar:
- Orden: QuickActions (botones grandes) → TodayCard → WeekStats → Tabs → Contenido
- GarminSyncButton aparece dentro del tab Gráficos, al final
- Los stats de SpO2/Resp/Body Battery no se cortan (flex-wrap)

- [ ] **Step 5: Commit**

```bash
git add components/sleep/SleepModuleClient.tsx components/sleep/SleepTodayCard.tsx
git commit -m "ui: sleep module — move garmin sync to charts tab, fix stats wrap"
```

---

## Task 4: Módulo Fitness — touch targets y reorden

**Files:**
- Modify: `components/fitness/FitnessModuleClient.tsx`
- Modify: `components/fitness/FitnessQuickActions.tsx`
- Modify: `components/fitness/GymRoutineCard.tsx`
- Modify: `components/fitness/TodayWorkoutCard.tsx`
- Modify: `components/fitness/WorkoutHistoryList.tsx`

### 4a — FitnessModuleClient: mover GarminSync al fondo del tab Hoy

- [ ] **Step 1: Reubicar GarminSyncButton**

En `components/fitness/FitnessModuleClient.tsx`, reemplazar el tab "hoy" completo:

```tsx
{tab === "hoy" && (
  <div className="space-y-4">
    {/* Rutina del día */}
    {initialTodayRoutine && (
      <GymRoutineCard
        routine={initialTodayRoutine}
        onStarted={handleLogged}
      />
    )}

    {/* Registrar actividad */}
    <FitnessQuickActions onLogged={handleLogged} />

    {/* Entrenamientos de hoy */}
    {todayWorkouts.length > 0 && (
      <TodayWorkoutCard
        workouts={todayWorkouts}
        onDeleted={handleWorkoutDeleted}
        isRefreshing={isRefreshing}
      />
    )}

    {/* Garmin sync — al fondo */}
    <GarminSyncButton
      garminStatus={{ connected: garminConnected, sessionValid: garminConnected, lastSync: null }}
      onSynced={handleLogged}
    />
  </div>
)}
```

### 4b — FitnessQuickActions: fix zoom en iOS para inputs

- [ ] **Step 2: Agregar `text-base` a todos los inputs**

En `components/fitness/FitnessQuickActions.tsx`:

Input duración (~línea 201): `className="input"` → `className="input text-base"`

Input distancia (~línea 213, si existe): `className="input"` → `className="input text-base"`

Input NLP (~línea 243): `className="input flex-1"` → `className="input flex-1 text-base"`

> Nota: En iOS, los inputs con font-size < 16px disparan zoom automático. `text-base` = 16px lo previene.

### 4c — GymRoutineCard: sin cambios necesarios

- [ ] **Step 3: Confirmar que GymRoutineCard no requiere cambios**

La clase `.card` global en `app/globals.css` ya tiene `@apply p-4` (16px). Esto es suficiente en mobile.  
El botón "Empezar gym" ya tiene `btn-primary w-full mt-4` — full-width con buen touch target.  
Sin cambios necesarios en este archivo.

### 4d — TodayWorkoutCard: touch targets en botones

- [ ] **Step 4: Aumentar touch targets en WorkoutRow**

En `components/fitness/TodayWorkoutCard.tsx`, dentro de `WorkoutRow`:

Botón expand (línea ~91):
```tsx
// ANTES:
className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-muted)] transition-colors"

// DESPUÉS:
className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-muted)] transition-colors"
```

Botón delete (línea ~101):
```tsx
// ANTES:
className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 transition-colors disabled:opacity-40"

// DESPUÉS:
className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 transition-colors disabled:opacity-40"
```

### 4e — WorkoutHistoryList: touch targets en botones

- [ ] **Step 5: Mismos cambios en HistoryItem**

En `components/fitness/WorkoutHistoryList.tsx`, dentro de `HistoryItem`:

Botón expand (~línea 104):
```tsx
// ANTES:
className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-muted)]"

// DESPUÉS:
className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-muted)]"
```

Botón delete (~línea 110):
```tsx
// ANTES:
className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 transition-colors disabled:opacity-40"

// DESPUÉS:
className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 transition-colors disabled:opacity-40"
```

- [ ] **Step 6: Verificar módulo de fitness en mobile**

```bash
npm run dev
```

En `/fitness` con viewport 375px verificar:
- Tab Hoy: GymRoutineCard → FitnessQuickActions → TodayWorkoutCard → GarminSync
- Inputs de texto: tocar en Safari iOS → sin zoom automático
- Botones de expand/delete: suficientemente grandes para el pulgar (≥44px)

- [ ] **Step 7: Commit**

```bash
git add components/fitness/FitnessModuleClient.tsx components/fitness/FitnessQuickActions.tsx components/fitness/GymRoutineCard.tsx components/fitness/TodayWorkoutCard.tsx components/fitness/WorkoutHistoryList.tsx
git commit -m "ui: fitness module mobile-first — touch targets, input zoom fix, garmin reorder"
```

---

## Task 5: Verificación final y build

- [ ] **Step 1: Build de producción**

```bash
npm run build
```

Verificar que no hay errores de TypeScript ni de compilación.

- [ ] **Step 2: Verificación visual completa**

Con `npm run dev`, revisar en mobile viewport (375px) y desktop (1280px):

| Página | Mobile (375px) | Desktop (1280px) |
|--------|----------------|------------------|
| `/` | Score inline compacto, módulos en lista 1 col, saludo `text-xl` | Anillo grande, grid 2 cols, saludo `text-2xl` |
| `/sleep` | Quick actions → card hoy → week stats → tabs → garmin al final del tab gráficos | Mismo, sin cambios visuales en desktop |
| `/fitness` | Tab Hoy: rutina → acciones → entrenamientos → garmin | Mismo |
| BottomNav | Touch targets ≥60px, dot activo visible | Oculto |
| Inputs (`/fitness`) | Tocar input → sin zoom en Safari iOS | Sin cambios |
| Botones delete/expand | Fácilmente tapeables | Sin cambios |

- [ ] **Step 3: Commit final si quedan ajustes menores**

```bash
git add -p
git commit -m "ui: mobile-first final adjustments"
```

---

## Archivos modificados — resumen

| Archivo | Cambio |
|---------|--------|
| `components/layout/BottomNav.tsx` | Touch targets `min-w-[60px] py-2` + dot activo |
| `app/(app)/page.tsx` | `text-xl md:text-2xl` + `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` |
| `components/scoring/ScoringDashboard.tsx` | Bloque mobile (score inline + lista) + bloque desktop (original) |
| `components/dashboard/ModuleSummaryCard.tsx` | Horizontal mobile / vertical desktop |
| `components/sleep/SleepModuleClient.tsx` | GarminSync movido dentro del tab charts |
| `components/sleep/SleepTodayCard.tsx` | `flex-wrap` en stats extras de Garmin |
| `components/fitness/FitnessModuleClient.tsx` | GarminSync al fondo del tab Hoy |
| `components/fitness/FitnessQuickActions.tsx` | `text-base` en inputs (anti-zoom iOS) |
| `components/fitness/GymRoutineCard.tsx` | Sin cambios — padding ya correcto vía `.card` global (`p-4`) |
| `components/fitness/TodayWorkoutCard.tsx` | Touch targets `min-h-[44px] min-w-[44px]` en botones |
| `components/fitness/WorkoutHistoryList.tsx` | Touch targets `min-h-[44px] min-w-[44px]` en botones |

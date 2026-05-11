# Mobile-First Redesign — Spec

**Fecha:** 2026-05-10  
**Alcance:** Dashboard, Sueño, Fitness  
**Enfoque:** Tailwind classes only (sin componentes nuevos, sin cambios de lógica)

---

## Contexto

La app ya tiene estructura mobile básica (BottomNav, Header, safe-areas iOS, PWA). Falta aplicar mobile-first dentro de los módulos: touch targets grandes, layouts apilados, charts responsivos y jerarquía visual pensada para pulgar.

---

## Decisiones de diseño

| Pregunta | Decisión |
|----------|----------|
| Alcance | Módulos construidos: Dashboard, Sueño, Fitness |
| Método | Solo Tailwind classes — sin componentes nuevos |
| Dashboard | Score inline compacto + lista de módulos con barras de progreso |
| Módulos | Acción primaria grande arriba → card del día → stats → tabs |
| Touch targets | Mínimo `min-h-[44px]` en todo elemento interactivo (Apple HIG) |
| Charts | `aspect-[4/3] w-full` para responsividad en mobile |

---

## Sección 1 — Layout base

### `components/layout/BottomNav.tsx`
- Touch targets: `min-w-[60px] py-2` (antes `min-w-[56px] py-1.5`)
- Ítem activo: agregar indicator visual (dot o underline sobre el icono)

### Sin cambios
- `AppLayout.tsx` — correcto tal cual
- `Header.tsx` — correcto tal cual
- `main` padding — `pb-24 md:pb-6` ya está bien

---

## Sección 2 — Dashboard

### `app/(app)/page.tsx`
- Saludo: `text-xl md:text-2xl` (antes `text-2xl`)
- Grid de módulos: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` (antes `grid-cols-2 md:grid-cols-3`)

### `components/scoring/ScoringDashboard.tsx`
- Mobile: anillo pequeño inline (izquierda) + número grande + estado → lista de módulos con barra de progreso + score numérico
- Desktop (md+): mantiene layout actual (anillo grande centrado + ScoreCardModule expandibles)
- Implementar con bloque `hidden md:block` / `block md:hidden`

### `components/dashboard/ModuleSummaryCard.tsx`
- Mobile: layout horizontal (`flex flex-row`) — icono izquierda, texto + score derecha
- Desktop (md+): layout vertical actual (`flex flex-col`)
- Implementar con clases responsivas Tailwind

---

## Sección 3 — Módulo Sueño

### `components/sleep/SleepModuleClient.tsx`
- Orden de secciones en mobile: Quick Actions → Card hoy → Stats semanales → Garmin sync (dentro de tab gráficos) → Tabs → Contenido
- El `GarminSyncButton` se mueve al interior del tab "Gráficos" (no flotando arriba)

### `components/sleep/SleepQuickActions.tsx`
- Botones: `w-full py-4 text-base rounded-2xl` en mobile (touch target generoso)
- En desktop (md+): tamaño actual, side-by-side

### `components/sleep/SleepTodayCard.tsx`
- Stats internas: `grid-cols-2 sm:grid-cols-4` (antes probablemente fijo)

### `components/sleep/SleepWeekStats.tsx`
- Stats: `grid-cols-2 sm:grid-cols-4`

### `components/sleep/SleepDurationChart.tsx`, `SleepQualityChart.tsx`, `SleepTimingChart.tsx`
- Contenedor: `aspect-[4/3] w-full` para responsividad
- Recharts: `<ResponsiveContainer width="100%" height="100%">`

---

## Sección 4 — Módulo Fitness

### `components/fitness/FitnessModuleClient.tsx`
- Tab "Hoy": mover `GarminSyncButton` al fondo del tab (no `flex justify-end` arriba)

### `components/fitness/FitnessQuickActions.tsx`
- Botones de acción: `w-full py-4 text-base`
- NLP input: `w-full text-base` (evita auto-zoom iOS en inputs `< 16px`)

### `components/fitness/TodayWorkoutCard.tsx`, `GymRoutineCard.tsx`
- Padding: `p-3 md:p-4`
- Tipografía interna: `text-sm`

### `components/fitness/WeeklyVolumeChart.tsx`
- Contenedor: `aspect-[4/3] w-full`

### `components/fitness/WorkoutHistoryList.tsx`
- Cada ítem: layout apilado en mobile (`flex-col`), inline en desktop (`md:flex-row`)

---

## Regla global de touch targets

Todo elemento interactivo (botón, link, item de lista) → `min-h-[44px]`. Esto aplica a:
- Tabs de módulos
- Items del historial (con botón delete)
- Links de navegación
- Botones de acción secundarios

---

## Archivos a modificar

| Archivo | Tipo de cambio |
|---------|----------------|
| `components/layout/BottomNav.tsx` | Touch targets + indicator activo |
| `app/(app)/page.tsx` | Tipografía + grid responsive |
| `components/scoring/ScoringDashboard.tsx` | Layout mobile vs desktop |
| `components/dashboard/ModuleSummaryCard.tsx` | Horizontal mobile / vertical desktop |
| `components/sleep/SleepModuleClient.tsx` | Reorden + mover GarminSync |
| `components/sleep/SleepQuickActions.tsx` | Botones full-width |
| `components/sleep/SleepTodayCard.tsx` | Grid 2→4 cols |
| `components/sleep/SleepWeekStats.tsx` | Grid 2→4 cols |
| `components/sleep/SleepDurationChart.tsx` | Aspect ratio responsivo |
| `components/sleep/SleepQualityChart.tsx` | Aspect ratio responsivo |
| `components/sleep/SleepTimingChart.tsx` | Aspect ratio responsivo |
| `components/fitness/FitnessModuleClient.tsx` | Mover GarminSync |
| `components/fitness/FitnessQuickActions.tsx` | Botones full-width + input 16px |
| `components/fitness/TodayWorkoutCard.tsx` | Padding responsive |
| `components/fitness/GymRoutineCard.tsx` | Padding responsive |
| `components/fitness/WeeklyVolumeChart.tsx` | Aspect ratio responsivo |
| `components/fitness/WorkoutHistoryList.tsx` | Layout responsive por ítem |

**Total: 17 archivos. Solo cambios de clases Tailwind y orden de JSX.**

---

## Lo que NO cambia

- Lógica de negocio, hooks, API calls
- Schema de Prisma
- Variables de entorno
- Componentes de scoring (`GlobalScoreRing`, `ScoreCardModule`, etc.) en desktop
- Agentes

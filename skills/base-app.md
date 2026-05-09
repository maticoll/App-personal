# Skill: Base App
> Sesión 1 — Scaffolding, configuración y estructura del proyecto

---

## Qué se hizo en esta sesión

Se montó toda la infraestructura base de la app personal. No hay lógica de negocio — solo el esqueleto completo y funcional listo para que las sesiones siguientes agreguen contenido.

---

## Stack configurado

| Tecnología | Versión | Notas |
|-----------|---------|-------|
| Next.js | ^15.1.0 | App Router, TypeScript |
| React | ^19.0.0 | — |
| Tailwind CSS | ^3.4.17 | dark + light mode, custom design system |
| Prisma | ^5.22.0 | ORM para Supabase |
| NextAuth | ^5.0.0-beta.25 | v5 con @auth/prisma-adapter |
| next-pwa | ^5.6.0 | PWA para iPhone 14 |
| next-themes | ^0.4.3 | Control de dark/light mode con clase CSS |
| lucide-react | ^0.460.0 | Iconografía |
| date-fns | ^4.1.0 | Manejo de fechas |
| recharts | ^2.13.0 | Gráficos (listo para sesiones siguientes) |

---

## Estructura de carpetas

```
/
├── app/
│   ├── (app)/                  ← Rutas autenticadas
│   │   ├── layout.tsx          ← Layout con AppLayout (sidebar + nav)
│   │   ├── page.tsx            ← Dashboard principal (/)
│   │   ├── sleep/page.tsx      ← /sleep (TODO: Sesión 3)
│   │   ├── fitness/page.tsx    ← /fitness (TODO: Sesión 4)
│   │   ├── nutrition/page.tsx  ← /nutrition (TODO: Sesión 5)
│   │   ├── projects/page.tsx   ← /projects (TODO: Sesión 6)
│   │   ├── ideas/page.tsx      ← /ideas (TODO: Sesión 5)
│   │   ├── finances/page.tsx   ← /finances (TODO: Sesión 7)
│   │   ├── scoring/page.tsx    ← /scoring (TODO: Sesión 2)
│   │   └── settings/page.tsx   ← /settings (TODO: Sesión 2)
│   ├── (auth)/
│   │   └── login/page.tsx      ← Pantalla de login con Google OAuth
│   ├── api/
│   │   └── auth/[...nextauth]/ ← Route handler NextAuth v5
│   ├── globals.css             ← CSS global + variables de diseño
│   └── layout.tsx              ← Root layout con ThemeProvider
│
├── agents/
│   ├── index.ts                ← Exportaciones de todos los agentes
│   ├── orchestrator/           ← Orquestrador central (TODO: Sesión 8)
│   ├── sleep/                  ← Agente de sueño (TODO: Sesión 3)
│   ├── fitness/                ← Agente de fitness (TODO: Sesión 4)
│   ├── nutrition/              ← Agente de nutrición (TODO: Sesión 5)
│   ├── projects/               ← Agente de proyectos (TODO: Sesión 6)
│   ├── ideas/                  ← Agente de ideas (TODO: Sesión 5)
│   ├── finances/               ← Agente de finanzas (TODO: Sesión 7)
│   ├── calendar/               ← Agente de calendario (TODO: Sesión 7)
│   └── scoring/                ← Agente de scoring (TODO: Sesión 2)
│
├── components/
│   ├── layout/
│   │   ├── AppLayout.tsx       ← Wrapper: sidebar (desktop) + header + bottom nav (mobile)
│   │   ├── Sidebar.tsx         ← Navegación lateral (md+)
│   │   ├── Header.tsx          ← Cabecera mobile con título del módulo
│   │   └── BottomNav.tsx       ← Navegación inferior iOS (5 ítems)
│   ├── providers/
│   │   └── ThemeProvider.tsx   ← next-themes wrapper
│   └── ui/
│       ├── ThemeToggle.tsx     ← Botón dark/light
│       └── ScoreBar.tsx        ← Barra de progreso del score
│
├── lib/
│   ├── db.ts                   ← Prisma Client singleton
│   ├── utils.ts                ← cn(), formatDate(), formatTime(), getScoreColor(), etc.
│   └── types.ts                ← Tipos TypeScript compartidos entre módulos y agentes
│
├── prisma/
│   └── schema.prisma           ← Schema completo (ver sección abajo)
│
├── public/
│   ├── manifest.json           ← PWA manifest (iPhone 14 optimizado)
│   └── icons/                  ← Íconos PWA (README con instrucciones de generación)
│
├── skills/
│   └── base-app.md             ← Este archivo
│
├── auth.ts                     ← Configuración NextAuth v5 (Google OAuth)
├── middleware.ts               ← Protección de rutas, redireccion a /login
├── next.config.ts              ← Next.js + next-pwa config
├── tailwind.config.ts          ← Design system completo
├── tsconfig.json               ← TypeScript estricto
├── postcss.config.mjs          ← PostCSS para Tailwind
├── .gitignore                  ← Incluye .env*.local, /public/sw.js
└── .env.local.example          ← Todas las variables necesarias documentadas
```

---

## Schema de Prisma (Supabase)

Modelos creados, agrupados por módulo:

### Auth (NextAuth v5)
- `User` — usuario principal, conecta todos los módulos
- `Account` — cuentas OAuth (Google)
- `Session` — sesiones persistidas en DB
- `VerificationToken` — tokens de verificación

### Sueño
- `SleepLog` — registro diario de sueño con campos Garmin (TODO: Sesión 3)

### Fitness
- `Workout` — entreno del día con tipo (GYM/RUNNING/SWIMMING/WALKING/CYCLING)
- `WorkoutExercise` — ejercicios dentro de un workout
- `WorkoutSet` — series/reps/peso de cada ejercicio
- `GymRoutine` — rutinas predefinidas del usuario
- `GymRoutineExercise` — ejercicios dentro de la rutina

### Nutrición
- `Meal` — comida registrada con macros calculados por IA
- `WaterLog` — registro de hidratación (en unidades de termo de 2L)
- `UserDiet` — texto libre de la dieta del usuario

### Proyectos
- `Project` — proyecto personal con status Kanban y deadline
- `ProjectTask` — tareas dentro de un proyecto

### Ideas
- `Idea` — idea raw + cleaned text + tags

### Scoring
- `DailyScore` — score por módulo + global + JSON de detalle

### Config
- `UserSettings` — horarios esperados, metas, preferencias
- `UserHabit` — hábitos esperados del usuario

### WhatsApp (Sesión 8)
- `WhatsAppMessage` — log de mensajes inbound/outbound para trazabilidad

---

## Diseño del sistema (Design System)

### Modos
- **Dark (default):** bg `#0D0F14`, surface `#1A1D27`, texto `#F1F5F9`
- **Light:** bg `#F8FAFC`, surface `#FFFFFF`, texto `#0F172A`
- Controlado con `next-themes` + clase `dark` en `<html>`

### Colores de score (0–100)
| Rango | Color |
|-------|-------|
| 80–100 | `#22C55E` verde |
| 60–79 | `#84CC16` lima |
| 40–59 | `#EAB308` amarillo |
| 20–39 | `#F97316` naranja |
| 0–19 | `#EF4444` rojo |

### Colores por módulo
| Módulo | Color |
|--------|-------|
| Sueño | `#8B5CF6` violeta |
| Fitness | `#06B6D4` cyan |
| Nutrición | `#10B981` esmeralda |
| Proyectos | `#F59E0B` ámbar |
| Ideas | `#EC4899` rosa |
| Finanzas | `#3B82F6` azul |
| Scoring | `#6366F1` indigo |

---

## Autenticación

- **Proveedor:** Google OAuth (único proveedor por ahora)
- **Estrategia de sesión:** `database` (en Supabase)
- **Protección:** `middleware.ts` intercepta todas las rutas excepto `/login`, `/api/auth/*` y `/api/webhooks/*`
- **Restricción de acceso:** variable `ALLOWED_EMAIL` en `.env.local` para limitar a un solo usuario (uso personal)

### Scopes de Google preparados para futuro
- TODO: Sesión 7 — agregar `calendar` y `gmail.readonly`

---

## PWA — iPhone 14

- `next-pwa` configurado con `disable: process.env.NODE_ENV === 'development'`
- `manifest.json` con `display: standalone`, `orientation: portrait`
- `viewportFit: cover` en el root layout para iOS safe areas
- CSS vars `env(safe-area-inset-top/bottom)` usadas en Header y BottomNav
- `<meta name="apple-mobile-web-app-capable" content="yes">` vía `appleWebApp.capable: true` en metadata

### Íconos pendientes
Ver `public/icons/README.md` — hay que generar los íconos antes del primer deploy. Usar `pwa-asset-generator` o favicon.io.

---

## Layout

### Desktop (md+, 768px+)
```
┌──────────────┬─────────────────────────────────┐
│   Sidebar    │                                 │
│  (w-64, fijo)│     Contenido del módulo        │
│  Logo        │                                 │
│  Nav items   │  p-6                            │
│  ...         │                                 │
│  Settings    │                                 │
│  ThemeToggle │                                 │
└──────────────┴─────────────────────────────────┘
```

### Mobile (iPhone 14, <md)
```
┌─────────────────────────┐
│ Header (Logo + Título + ⚙) ← sticky top
├─────────────────────────┤
│                         │
│  Contenido del módulo   │
│  p-4, pb-24             │
│  (espacio para nav)     │
│                         │
├─────────────────────────┤
│ BottomNav (5 ítems)     │ ← fixed bottom + safe area
│ Inicio Sueño Fit Nut Score│
└─────────────────────────┘
```

---

## Convenciones de código establecidas

- **TypeScript estricto** (`"strict": true` en tsconfig)
- **`cn()`** para combinar clases Tailwind (clsx + tailwind-merge)
- **Naming:** componentes en PascalCase, utils en camelCase
- **Variables CSS** para colores en lugar de clases Tailwind en partes donde el tema cambia
- **Server components por defecto**, `"use client"` solo donde hay interactividad
- **`// TODO: Sesión X`** en todos los placeholders para trazabilidad

---

## Cómo arrancar el proyecto

```bash
# 1. Instalar dependencias
npm install

# 2. Crear .env.local con las variables del .env.local.example
cp .env.local.example .env.local
# → completar DATABASE_URL, DIRECT_URL, AUTH_SECRET, AUTH_GOOGLE_ID/SECRET

# 3. Pushear el schema a Supabase
npm run db:push

# 4. Generar el cliente de Prisma
npm run db:generate

# 5. Correr en desarrollo
npm run dev
```

---

## Decisiones técnicas tomadas

| Decisión | Alternativa descartada | Razón |
|----------|----------------------|-------|
| `class` strategy para dark mode (next-themes) | `media` strategy | Permite que el usuario elija su preferencia independientemente del OS |
| Route groups `(app)` y `(auth)` | Carpetas normales | Separa cleanamente las rutas autenticadas de las públicas sin afectar URLs |
| `database` sessions en NextAuth | `jwt` sessions | Permite invalidar sesiones activas y está alineado con tener ya Supabase |
| `env(safe-area-inset-*)` en CSS | `padding` fijo | Funciona correctamente en iPhone 14 con Dynamic Island |
| `disable: NODE_ENV === 'development'` en next-pwa | Siempre habilitado | Evita problemas de cache en desarrollo |
| Un solo Google OAuth | Magic links | Más simple para uso personal de un solo usuario |

---

*Sesión 1 completada — Mayo 2026*
*Próximo paso: Sesión 2 — Dashboard + Scoring*

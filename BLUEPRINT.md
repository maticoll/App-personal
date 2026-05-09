# App Personal — Blueprint General
> Versión 1.0 — Mayo 2026

---

## 1. Visión General

Una **super-app personal** que centraliza el día a día completo: salud, hábitos, proyectos, finanzas e ideas en un solo lugar. No es un simple tracker — es un sistema inteligente que conoce las rutinas del usuario, detecta desvíos, y actúa proactivamente para mantener todo en orden. La entrada principal es WhatsApp, la visualización es una web app tipo dashboard.

**Principios:**
- Todo centralizado, nada disperso
- Cero fricción para registrar — se habla en lenguaje natural
- Visual y dinámico — el scoring hace que sea entretenido
- Proactivo — avisa antes de que el usuario lo pida
- Conversacional — se puede aclarar contexto y la app lo entiende

---

## 2. Tech Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js (App Router) + TypeScript |
| Estilos | Tailwind CSS |
| Base de datos | Supabase (PostgreSQL + Prisma ORM) |
| Autenticación | NextAuth v5 |
| Deploy | Vercel |
| PWA | next-pwa (mobile-first, iPhone 14 home screen) |
| IA principal | Claude API (Anthropic) |
| Transcripción audio | Whisper API (OpenAI) |
| Gráficos | Recharts |
| Versículo diario | bible-api.com (gratis, sin auth, Reina Valera 1960) |

**Diseño:** Dark mode + Light mode. Mobile-first. Responsive.

**App de Finanzas existente:** Next.js + Neon + Prisma + NextAuth v5 — se integra directamente al mismo ecosistema.

---

## 3. Arquitectura General

```
┌─────────────────────────────────────────────────────────────────┐
│                        WHATSAPP (entrada/salida)                 │
│              texto · audio (Whisper) · foto (futuro)            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     ORQUESTRADOR CENTRAL                        │
│         Detecta intención → deriva al sub-agente correcto       │
│         Único canal que habla con WhatsApp (in + out)           │
└──┬────┬────┬────┬────┬────┬────┬────┬───────────────────────────┘
   │    │    │    │    │    │    │    │
   ▼    ▼    ▼    ▼    ▼    ▼    ▼    ▼
  [1]  [2]  [3]  [4]  [5]  [6]  [7]  [8]
Sueño Fit  Nut  Proj Ideas Fin  Cal  Score
                            
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SUPABASE (PostgreSQL)                       │
│                    Datos de todos los módulos                   │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      WEB APP (Dashboard)                        │
│         Dashboard · Módulos · Scoring · Visualizaciones         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. El Orquestador y sus Sub-Agentes

### 4.1 Flujo Inbound (usuario → app)

```
Usuario manda mensaje por WhatsApp
        │
        ▼
¿Es audio?
  SÍ → Whisper API transcribe a texto
  NO → continúa como texto
        │
        ▼
Orquestrador (Claude API)
  · Lee el mensaje
  · Detecta intención
  · Identifica módulo destino
  · Extrae parámetros relevantes
        │
        ▼
Deriva al Sub-Agente correspondiente
        │
        ▼
Sub-Agente procesa y guarda en Supabase
        │
        ▼
Genera respuesta / confirmación
        │
        ▼
Orquestrador formatea y envía respuesta por WhatsApp
```

### 4.2 Flujo Outbound (app → usuario)

```
Trigger interno (cron job, evento, detección de desvío)
        │
        ▼
Sub-Agente genera intención de notificar
  Ej: "usuario no registró gym a las 6am"
        │
        ▼
Orquestrador recibe la intención
  · Decide si enviar ahora o agrupar
  · Formatea el mensaje
        │
        ▼
Envía por WhatsApp al usuario
        │
        ▼
Si requiere confirmación:
  Usuario responde "sí" / "no"
  → Orquestrador procesa la respuesta
  → Sub-Agente ejecuta la acción
```

### 4.3 Sub-Agentes

#### [1] Agente de Sueño
**Responsabilidades:**
- Registrar hora de dormir y despertar
- Recibir y procesar datos de Garmin (calidad, duración, interrupciones, puntaje)
- Manejar variabilidad ("hoy salgo, te aviso después")
- Calcular score de sueño

**Triggers de entrada:**
- "me voy a dormir" / "me desperté"
- "sync" (fuerza pull de Garmin)
- Cron job matutino (auto-sync Garmin)

**Triggers de salida (notificaciones):**
- Recordatorio de dormir a hora habitual
- Alerta si no registró despertar pasada cierta hora

**Integración externa:** Garmin Connect API

---

#### [2] Agente de Fitness
**Responsabilidades:**
- Gestionar rutinas de gym (crear/editar/consultar)
- Registrar ejercicios en lenguaje natural (sets/reps/peso)
- Registrar actividades: correr, caminar, nadar
- Smart habits: detectar si no se cumplió el horario habitual y proponer reagendado
- Calcular score de fitness del día

**Triggers de entrada:**
- "press plano 100kg 4 reps 2 series"
- "hoy fui a correr 5km"
- "hoy nadé"
- "sync" (fuerza pull de Garmin)

**Triggers de salida (notificaciones):**
- "Veo que no registraste el gym a las 6am. Tenés libre a las 6pm — ¿te lo agendo?"
- Confirmación de agendado + recordatorio 1h antes

**Integración externa:** Garmin Connect API, Google Calendar

**Smart habits logic:**
```
Cron a hora esperada de gym (ej: 6:10am L/M/J/V)
  → ¿Hay registro de hoy? 
      NO → consultar Google Calendar por huecos libres
           → proponer alternativa al usuario
           → si confirma → crear evento en Google Calendar
                         → agendar recordatorio 1h antes
      SÍ → no hacer nada
```

---

#### [3] Agente de Nutrición
**Responsabilidades:**
- Registrar comidas en lenguaje natural
- Calcular macros con IA (Claude API)
- Evaluar alineación con la dieta del usuario
- Registrar ingesta de agua (en unidades de termo de 2L)
- Calcular score de nutrición del día

**Triggers de entrada:**
- "almorcé pollo con arroz"
- "tomé un termo de agua"
- "desayuné tostadas con huevo"

**Triggers de salida (notificaciones):**
- Recordatorios de hidratación a intervalos configurados
- "Llevas X termos hoy, te falta Y para llegar a tu meta"

**Dato importante:** El usuario tiene una dieta definida (se cargará en la sesión de nutrición). La IA la usa como referencia para evaluar cada comida.

---

#### [4] Agente de Proyectos
**Responsabilidades:**
- Crear y actualizar proyectos personales (Kanban: To Do / In Progress / Done)
- Gestionar fechas límite (vista timeline)
- Sincronizar tareas IT del trabajo desde Notion
- Calcular score de proyectos del día (¿avancé en algo?)

**Triggers de entrada:**
- "moví el proyecto X a In Progress"
- "nuevo proyecto: rediseño de Lumina, deadline 30 de mayo"
- "sync notion" (trae tareas actualizadas del trabajo)

**Integración externa:** Notion API (planilla de tareas IT del trabajo)

---

#### [5] Agente de Ideas
**Responsabilidades:**
- Capturar ideas en lenguaje natural / criollo
- Limpiar y estructurar el texto con IA
- Sincronizar con Lumina (app externa de notas)
- Permitir desarrollar ideas conversacionalmente

**Triggers de entrada:**
- "tengo una idea: [descripción informal]"
- Cualquier intención que el orquestrador clasifique como idea nueva

**Integración externa:** Lumina (Vercel app)

---

#### [6] Agente de Finanzas
**Responsabilidades:**
- Interfaz con la app de finanzas existente (Next.js + Neon)
- Consultar transacciones, saldos, categorías
- Generar alertas proactivas de gasto
- Responder consultas en lenguaje natural

**Triggers de entrada:**
- "gasté $500 en ropa"
- "cuánto gasté esta semana"
- Webhooks desde la app de finanzas al registrar transacciones

**Triggers de salida (notificaciones):**
- "Che, ya venís gastando bastante esta semana en X categoría"

**Nota:** La app de finanzas completa también vive como sección dentro del dashboard global.

---

#### [7] Agente de Calendario
**Responsabilidades:**
- Consultar Google Calendar para detectar huecos libres
- Crear eventos (con confirmación del usuario)
- Proveer contexto de agenda al orquestrador y otros agentes
- Responder consultas de disponibilidad

**Triggers de entrada:**
- Solicitudes de otros agentes (especialmente Fitness para reagendar)
- "qué tengo mañana"
- "agendame X para el viernes"

**Integración externa:** Google Calendar API, Gmail

---

#### [8] Agente de Scoring
**Responsabilidades:**
- Calcular score diario por categoría (/100 cada una)
- Calcular score global (promedio)
- Proveer histórico: diario, semanal, mensual
- Alimentar el dashboard con datos de scoring

**Cuándo corre:** Al final del día (cron job configurable) y bajo demanda.

**Categorías del score:**
| Categoría | Indicadores ejemplo |
|-----------|-------------------|
| Sueño | Horas dormidas, hora de acostarse, calidad Garmin |
| Fitness | ¿Fue al gym?, ¿hizo actividad extra? |
| Nutrición | ¿Registró comidas?, ¿alineación con dieta?, ¿hidratación? |
| Proyectos | ¿Avanzó en algún proyecto? |

**Nota:** Ideas NO forma parte del scoring. Es un módulo creativo y espontáneo — no tiene sentido penalizar por no tener ideas un día. El score global = promedio de los 4 módulos anteriores.

**Distribución de puntos:** A definir en la sesión de Dashboard + Scoring.

---

### 4.4 Resumen Matutino (Morning Summary)

Enviado automáticamente cada mañana por WhatsApp.

**Contenido:**
1. Versículo del día — Reina Valera 1960 (bible-api.com, gratis)
2. Score del día anterior (global + por categoría)
3. Qué tengo que hacer hoy (Google Calendar + tareas Notion)
4. Tareas importantes de la semana
5. Recordatorio de hidratación ("acordate de tomar agua")

**Implementación:** Cron job matutino → Summary Agent compila → Orquestrador formatea → WhatsApp.

---

### 4.5 Sync con Servicios Externos

```
"sync" por WhatsApp → Orquestrador → lanza sync en todos los agentes
                                    → Garmin (sueño + actividad)
                                    → Notion (tareas trabajo)
                                    → Google Calendar (agenda)
```

También hay auto-sync por cron jobs configurados por módulo (ej: Garmin cada mañana).

---

## 5. Módulos del Dashboard (Web App)

### 5.1 Estructura de navegación
```
/ Dashboard principal
  /sleep     → Módulo de Sueño
  /fitness   → Módulo de Fitness
  /nutrition → Módulo de Nutrición
  /projects  → Módulo de Proyectos (Kanban + Timeline)
  /ideas     → Módulo de Ideas
  /finances  → App de Finanzas completa
  /scoring   → Historial de scores
  /settings  → Configuración (rutinas esperadas, dieta, metas)
```

### 5.2 Dashboard Principal
- Score global del día (barra de progreso grande arriba)
- Score por categoría (cada una con barra + desplegable de lo no cumplido)
- Resumen rápido de cada módulo
- Acceso directo a cualquier módulo

### 5.3 Visualizaciones
- Pie charts por categoría
- Líneas temporales (progreso semana/mes)
- Heatmap de streaks (hábitos consecutivos)
- Vista semanal y mensual de scoring

---

## 6. Integraciones Externas

| Integración | Uso | Estado |
|-------------|-----|--------|
| WhatsApp Business API | Orquestador (in + out) | Sesión 8 |
| Whisper API | Transcripción de audios | Sesión 8 |
| Claude API | IA central (NLP, macros, ideas) | Transversal |
| Google Calendar | Agenda, huecos libres, crear eventos | Sesión 7 |
| Gmail | Contexto de mails | Sesión 7 |
| Notion API | Tareas IT del trabajo | Sesión 6 |
| Garmin Connect API | Sueño, natación, actividad física | Sesiones 3/4 |
| App Finanzas (propia) | Vive dentro del dashboard global | Sesión 7 |
| Lumina (propia, Vercel) | Notas e ideas con IA | Sesión 5 |
| bible-api.com | Versículo diario (Reina Valera 1960) | Sesión 8 |
| App de Ventas (futura) | Marketplace + dashboard negocio + agente Meta | Sesión futura |

---

## 7. Plan de Sesiones

Cada sesión termina produciendo:
- `skill.md` específico del módulo
- Su bloque agregado al `claude.md` general

Al tener todos los bloques, Claude Code construye la app completa con contexto total.

| # | Sesión | Qué cubre |
|---|--------|-----------|
| 1 | **Base App** | Scaffolding, DB schema, auth, design system (dark/light), estructura de carpetas |
| 2 | **Dashboard + Scoring** | Layout principal, score UI global + por categoría, vistas diaria/semanal/mensual |
| 3 | **Sueño** | Registro manual, Garmin API, notificaciones de dormir/despertar |
| 4 | **Fitness** | Rutinas gym, logging actividad, smart habits (detección + reagendado con Google Calendar) |
| 5 | **Nutrición + Ideas** | Dieta, registro comidas + macros IA, agua por termos, módulo de ideas con IA, Lumina |
| 6 | **Proyectos** | Kanban, timeline, integración Notion (IT tasks del trabajo) |
| 7 | **Integraciones** | Google Calendar, Gmail, app de finanzas dentro del dashboard, Lumina |
| 8 | **WhatsApp Orquestador** | Core (recibir + clasificar + derivar), morning summary, flujos proactivos, Whisper |

---

## 8. Notas Técnicas Importantes

**Apple Health:** No es accesible desde web apps. Opciones para los datos de salud:
- Garmin Connect API (preferida — tiene todos los datos relevantes)
- iPhone Shortcut que exporta datos de Health y los envía vía webhook a la app

**PWA en iPhone:** Requiere iOS 16.4+ para Web Push notifications. El usuario tiene iPhone 14 — compatible.

**App de Finanzas existente:** Tiene integración con Telegram bot y OpenAI. Al integrarla en la app global, los webhooks de nuevas transacciones pueden disparar alertas proactivas vía el Agente de Finanzas.

**Garmin Connect API:** Requiere solicitud de acceso. Datos disponibles: sueño (duración, calidad, fases), actividades (natación, running, gym por calorias), steps. A gestionar en sesiones 3 y 4.

**Versículo del día:** `GET https://bible-api.com/{book}+{chapter}:{verse}?translation=rvr1960`. Decidir en sesión 8 si es aleatorio o sigue calendario litúrgico.

---

*Blueprint generado en sesión de ideación — Mayo 2026*
*Próximo paso: Sesión 1 — Base App*

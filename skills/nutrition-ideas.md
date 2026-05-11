# skills/nutrition-ideas.md
> Sesión 5 — Módulo de Nutrición + Módulo de Ideas
> Generado: Mayo 2026

---

## Cambios al Schema de Prisma

**Sin cambios** — todos los modelos (`Meal`, `WaterLog`, `UserDiet`, `Idea`) ya existían desde la Sesión 1. No es necesario correr migraciones.

---

## lib/nutrition.ts

**Tipos exportados:**
- `MealWithMeta` — comida con todos los campos incluyendo macros calculados
- `NutritionSummary` — resumen del día: comidas, agua, macros totales, hasAllMainMeals
- `ParsedMacros` — resultado del cálculo de macros por Claude
- `WeeklyNutritionStats` — avg calorías, avg agua, días con 3 comidas, total registros
- `DayNutrition` — historial de un día (meals + water + totalCalories)
- `DietInfo` — dieta del usuario con id, content, updatedAt

**Funciones:**
- `getTodayNutritionSummary(userId, date?)` → `NutritionSummary` — carga paralela de meals + waterLogs + settings
- `getMealHistory(userId, days=14)` → `DayNutrition[]` — agrupado por fecha, ordenado desc
- `getUserDiet(userId)` → `DietInfo | null`
- `updateUserDiet(userId, content)` → `DietInfo` — upsert
- `logMealNLP(userId, description, mealType, date?)` → `MealWithMeta` — llama a Claude Haiku para calcular macros + dietAlignmentScore
- `logWater(userId, thermos=1.0, date?)` → `{ totalThermos, goal }` — crea WaterLog y retorna total del día
- `deleteMeal(userId, mealId)` → `void` — verifica ownership
- `getWeeklyNutritionStats(userId)` → `WeeklyNutritionStats`
- `getNutritionSummaryText(userId, date?)` → `string` — texto compacto para Morning Summary (Sesión 8)
- `getWaterReminderText(userId)` → `string | null` — null si ya cumplió la meta, texto de recordatorio si no

**Cálculo de macros con Claude:**
- Modelo: `claude-haiku-4-5-20251001` (rápido y barato)
- Prompt con contexto de la dieta del usuario si existe
- Devuelve JSON con calories, proteinG, carbsG, fatG, dietAlignmentScore (0-100)
- Si Claude falla, la comida se guarda sin macros (no bloquea)

---

## lib/ideas.ts

**Tipos exportados:**
- `IdeaWithMeta` — idea con wordCount calculado del texto actual
- `IdeasStats` — total, thisWeek, thisMonth, topTags[]
- `CapturedIdea` — estructura de salida del NLP: title, content, tags

**Funciones:**
- `getAllIdeas(userId, options?)` → `IdeaWithMeta[]` — con filtro por tag o búsqueda de texto
- `getRecentIdeas(userId, limit=5)` → `IdeaWithMeta[]`
- `getIdea(userId, ideaId)` → `IdeaWithMeta | null`
- `captureIdeaNLP(userId, rawText)` → `IdeaWithMeta` — llama a Claude Haiku, estructura la idea, guarda en DB. TODO Sesión 7: sync con Lumina
- `updateIdea(userId, ideaId, data)` → `IdeaWithMeta` — edición manual de title/content/tags
- `deleteIdea(userId, ideaId)` → `void` — con verificación de ownership
- `getIdeasStats(userId)` → `IdeasStats`
- `getIdeasActivityForDate(userId, date)` → `number` — cuántas ideas se capturaron ese día (para dashboard)

**captureIdeaNLP — prompt Claude:**
- Recibe texto informal/criollo
- Genera: title (máx 8 palabras), content (expandido, máx 3 párrafos), tags (1-4, lowercase)
- El `rawText` original siempre se guarda en el modelo
- `cleanedText` = texto expandido por IA (null si Claude falla)
- Si Claude falla, guarda la idea con rawText sin procesar

---

## Scoring (lib/scoring.ts)

**Funciones nuevas exportadas:**
- `calcNutritionScoreForDate(userId, date)` → `ModuleScoreResult` — wrapper de la función interna calcNutritionScore
- `getIdeasActivityForDate(userId, date)` → `number` — no forma parte del score global, solo informativo

**Ideas NO entra al score global** — el score global sigue siendo promedio de sleep + fitness + nutrition + projects.

---

## API Routes

### Nutrición (`/api/nutrition/`)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/nutrition/today` | Resumen nutricional del día |
| POST | `/api/nutrition/meal` | Registrar comida (NLP + macros IA) — body: `{ description, mealType, date? }` |
| DELETE | `/api/nutrition/meal/[id]` | Eliminar comida |
| POST | `/api/nutrition/water` | Registrar agua — body: `{ thermos? }` (default 1) |
| GET | `/api/nutrition/diet` | Obtener dieta actual |
| POST | `/api/nutrition/diet` | Actualizar dieta — body: `{ content }` |
| GET | `/api/nutrition/history?days=14` | Historial agrupado por día |
| GET | `/api/nutrition/weekly-stats` | Stats de la semana |

### Ideas (`/api/ideas/`)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/ideas?tag=&search=` | Lista con filtros opcionales |
| POST | `/api/ideas` | Capturar idea NLP — body: `{ text }` |
| GET | `/api/ideas/[id]` | Obtener idea por ID |
| PATCH | `/api/ideas/[id]` | Editar — body: `{ title?, content?, tags? }` |
| DELETE | `/api/ideas/[id]` | Eliminar |
| GET | `/api/ideas/stats` | Stats generales |

### Cron nuevo
| Cron | Schedule | Función |
|------|----------|---------|
| `/api/cron/water-reminder` | `0 12,17 * * *` | Recordatorio de hidratación a las 12 PM y 5 PM |

---

## Componentes UI

### `/components/nutrition/`
- `NutritionModuleClient` — wrapper con 3 tabs: Hoy / Stats / Dieta
- `MealLogCard` — lista comidas del día con expand/delete; usa AlignmentBadge
- `MacrosChart` — PieChart (Recharts) con proteínas/carbs/grasas; solo renderiza si hay datos
- `WaterTracker` — iconos de termos + barra de progreso + botón +1 Termo
- `NutritionQuickActions` — selector de tipo de comida + textarea NLP + botón +1 Termo
- `MealHistoryList` — historial 14d agrupado por fecha, expandible
- `NutritionWeekStats` — grid de 4 stats: calorías avg, agua avg, días con 3 comidas, total registros
- `DietCard` — muestra dieta actual + botón editar (textarea inline)
- `AlignmentBadge` — badge verde/amarillo/rojo según dietAlignmentScore

### `/components/ideas/`
- `IdeasModuleClient` — wrapper con 2 tabs: Capturar / Explorar
- `IdeaCaptureForm` — textarea + submit → preview estructurado por IA → confirmar/editar
- `IdeaCard` — card con título, preview truncado, tags, botones editar/eliminar; edición inline
- `IdeasGrid` — grid responsive 1-2 columnas de IdeaCards
- `TagFilter` — chips de tags con conteo para filtrar
- `IdeaDetail` — modal con texto completo + texto original (collapsible)
- `IdeasStats` — 3 stat cards + top tags

---

## Páginas

### `/app/(app)/nutrition/page.tsx`
Server Component. Carga en paralelo:
1. `getTodayNutritionSummary(userId)` — con catch → valores vacíos
2. `getMealHistory(userId, 14)` — con catch → []
3. `getUserDiet(userId)` — con catch → null
4. `getWeeklyNutritionStats(userId)` — con catch → zeros

Pasa todo como props a `NutritionModuleClient`.

### `/app/(app)/ideas/page.tsx`
Server Component. Carga en paralelo:
1. `getAllIdeas(userId)` — con catch → []
2. `getIdeasStats(userId)` — con catch → zeros

Pasa todo como props a `IdeasModuleClient`.

---

## Agentes

### `/agents/nutrition/index.ts`
**Exporta:** `processNutritionMessage(userId, text)`, `getNutritionSummaryText`, `getWaterReminderText`, `nutritionAgent`

**Intenciones detectadas** (vía normalización NFD sin acentos):
- `water_log` — detecta "termo/s", "agua", "bebi"
- `diet_update` — "mi dieta es/tiene/incluye", "cambia mi dieta", "nueva dieta"
- `query` — "que comi", "cuanta agua", "cuantos termos", "resumen nutri"
- `meal_log` — "desayune", "almorce", "cene", "comi", "merende", + nombres directos
- `unknown` — fallback

**Normalización:** `text.toLowerCase().normalize("NFD").split("").filter(c => charCode < 0x0300 || > 0x036f).join("")` — evita problemas con acentos en regex.

**Detección de tipo de comida:** por palabra clave primero, luego por hora del día.
**Detección de termos:** soporta "medio termo", "N termos", "N,N termos", default 1.

### `/agents/ideas/index.ts`
**Exporta:** `processIdeasMessage(userId, text)`, `ideasAgent`

**Intenciones:** `capture` | `query` | `expand` | `unknown`

---

## Variables de entorno

Sin variables nuevas. El módulo usa `ANTHROPIC_API_KEY` (ya existía).

---

## Comandos para correr

```bash
# No hay cambios de schema Prisma — NO es necesario correr migraciones

# Verificar que ANTHROPIC_API_KEY está en .env.local
grep ANTHROPIC_API_KEY .env.local

# Levantar dev
npm run dev
```

---

## Próxima sesión: Proyectos (Sesión 6)

Leer `skills/fitness.md` como referencia del patrón usado (rutinas CRUD, Kanban similar).
Implementar:
- Kanban board con columnas TODO / IN_PROGRESS / DONE / ARCHIVED
- CRUD de proyectos y tareas
- Integración Notion API (lectura de tareas IT del trabajo)
- Agente de proyectos completo

# Desglose de Ideas con IA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cuando entra una idea (WhatsApp o web), la IA la desglosa automáticamente (pasos, qué investigar y dónde, evaluación, primer paso de hoy); las ideas existentes se desglosan bajo demanda desde la web o por WhatsApp.

**Architecture:** Campo `breakdown Json?` en el modelo `Idea`. Una sola llamada a Haiku 4.5 en `captureIdeaNLP` devuelve estructura + desglose juntos. Función `generateIdeaBreakdown` para regenerar bajo demanda, expuesta vía `POST /api/ideas/[id]/breakdown` y vía el intent `expand` del agente de WhatsApp. El agente devuelve `data: { verbatim: true }` y el orquestador pasa a respetarlo (hoy lo hardcodea en `false`).

**Tech Stack:** Next.js App Router + TypeScript estricto, Prisma/Supabase, Claude API vía `callClaude` (`lib/claude.ts`), Tailwind.

**Spec:** `docs/superpowers/specs/2026-06-11-idea-breakdown-design.md`

> ⚠️ **Sin framework de tests** (regla del proyecto en CLAUDE.md — esto reemplaza el TDD de la skill). Verificación por task = `npx tsc --noEmit` con 0 errores. Verificación final = `npm run build`.

> ⚠️ **Gotcha de schema:** `npm run db:push` suele fallar contra Supabase. El fallback es SQL directo en el Supabase SQL Editor (Task 1, Step 3). El usuario debe correr ese SQL antes de deployar — el código local compila igual sin eso.

---

### Task 1: Schema — campos `breakdown` y `breakdownAt` en `Idea`

**Files:**
- Modify: `prisma/schema.prisma` (modelo `Idea`, ~línea 401)

- [ ] **Step 1: Agregar campos al modelo `Idea`**

En `prisma/schema.prisma`, dentro de `model Idea`, después del bloque de `status`:

```prisma
  // Estado: "idea" | "progreso" | "hecha"
  status      String   @default("idea")

  // Desglose IA: pasos, investigación, evaluación, primer paso (IdeaBreakdown)
  breakdown   Json?
  breakdownAt DateTime?
```

- [ ] **Step 2: Intentar push y regenerar el client**

Run: `npm run db:push`
Expected: probablemente falla por conectividad con Supabase (gotcha conocido). Si pasa, perfecto — saltar el Step 3.

Run: `npm run db:generate`
Expected: `Generated Prisma Client` sin errores. (No necesita conectividad — el código local ya compila con los campos nuevos.)

- [ ] **Step 3: Si `db:push` falló — informar el SQL manual**

Mostrar al usuario este SQL para correr en el **Supabase SQL Editor** (no bloquea el resto del plan, pero es requisito antes de deployar):

```sql
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS breakdown jsonb;
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS "breakdownAt" timestamp(3);
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(ideas): campos breakdown + breakdownAt en schema"
```

---

### Task 2: `lib/ideas.ts` — tipo `IdeaBreakdown`, parser defensivo y captura con desglose

**Files:**
- Modify: `lib/ideas.ts`

- [ ] **Step 1: Agregar el tipo `IdeaBreakdown` y extender `IdeaWithMeta` y `CapturedIdea`**

En la sección de Tipos (`lib/ideas.ts:12`), agregar después de `IdeaStatus`:

```ts
export type IdeaBreakdown = {
  steps: string[];                                   // pasos ordenados, concretos
  research: { question: string; where: string }[];   // qué investigar y dónde
  evaluation: { effort: string; risks: string[]; verdict: string };
  firstStep: string;                                 // una acción chica para hoy
};
```

En `IdeaWithMeta` (`lib/ideas.ts:15`), agregar después de `luminaId`:

```ts
  breakdown: IdeaBreakdown | null;
  breakdownAt: Date | null;
```

Reemplazar `CapturedIdea` (`lib/ideas.ts:38`) por:

```ts
export type CapturedIdea = {
  title: string;
  content: string;
  tags: string[];
  breakdown: IdeaBreakdown | null;
};
```

- [ ] **Step 2: Agregar `parseBreakdown` (parser defensivo) en la sección Helpers**

Después de la sección "Status cycling", antes de `toIdeaWithMeta`:

```ts
// -------------------------------------------------------
// parseBreakdown — valida campo por campo el JSON de Claude
// (o el Json crudo de la DB). Devuelve null si no hay nada usable.
// -------------------------------------------------------

export function parseBreakdown(raw: unknown): IdeaBreakdown | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  const steps = Array.isArray(obj.steps)
    ? obj.steps.map((s) => String(s).trim()).filter(Boolean)
    : [];

  const research = Array.isArray(obj.research)
    ? obj.research
        .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
        .map((r) => ({
          question: String(r.question ?? "").trim(),
          where: String(r.where ?? "").trim(),
        }))
        .filter((r) => r.question)
    : [];

  const evalRaw =
    obj.evaluation && typeof obj.evaluation === "object" && !Array.isArray(obj.evaluation)
      ? (obj.evaluation as Record<string, unknown>)
      : {};
  const evaluation = {
    effort: String(evalRaw.effort ?? "").trim(),
    risks: Array.isArray(evalRaw.risks)
      ? evalRaw.risks.map((r) => String(r).trim()).filter(Boolean)
      : [],
    verdict: String(evalRaw.verdict ?? "").trim(),
  };

  const firstStep = String(obj.firstStep ?? "").trim();

  // Sin pasos, sin investigación y sin primer paso → no hay desglose usable
  if (steps.length === 0 && research.length === 0 && !firstStep) return null;

  return { steps, research, evaluation, firstStep };
}
```

- [ ] **Step 3: Actualizar `toIdeaWithMeta` para exponer el desglose**

En el tipo del parámetro de `toIdeaWithMeta` (`lib/ideas.ts:62`), agregar después de `luminaId: string | null;`:

```ts
  breakdown: unknown;
  breakdownAt: Date | null;
```

Y en el objeto retornado, agregar después de `status`:

```ts
    breakdown: parseBreakdown(idea.breakdown),
    breakdownAt: idea.breakdownAt,
```

- [ ] **Step 4: Reemplazar `callClaudeForIdea` — una sola llamada con desglose incluido**

Reemplazar la función `callClaudeForIdea` completa (`lib/ideas.ts:149-179`) por:

```ts
// Especificación del bloque "breakdown" — compartida entre captura y regeneración
const BREAKDOWN_SPEC = `"breakdown": {
    "steps": ["paso 1", "paso 2"] (3 a 6 pasos concretos y ordenados, una línea cada uno),
    "research": [{ "question": "qué averiguar", "where": "fuente concreta: sitio, comunidad, herramienta o persona" }] (2 a 4 ítems),
    "evaluation": { "effort": "estimación breve del esfuerzo", "risks": ["riesgo u obstáculo"] (1 a 3), "verdict": "una línea: por qué vale (o no) la pena" },
    "firstStep": "una sola acción chiquita y concreta que se puede hacer hoy mismo"
  }`;

async function callClaudeForIdea(rawText: string): Promise<CapturedIdea> {
  const prompt = `El usuario capturó la siguiente idea en texto informal/criollo:
"${rawText}"

Estructurá y desglosá esta idea. Devolvé ÚNICAMENTE un objeto JSON con exactamente estas claves, sin texto adicional:
{
  "title": "título conciso de máximo 8 palabras",
  "content": "idea expandida y estructurada en máximo 3 párrafos, manteniendo la esencia del input original. No la transformes radicalmente, solo clarificá y expandí levemente.",
  "tags": ["tag1", "tag2"] (array de 1 a 4 tags relevantes en minúsculas, en español, sin símbolos),
  ${BREAKDOWN_SPEC}
}
Sé breve y accionable, en español rioplatense.`;

  const text = await callClaude({
    model: "claude-haiku-4-5-20251001",
    maxTokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  if (!text) throw new Error("Claude API: sin respuesta");

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in Claude response");

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    title: String(parsed.title ?? "Idea sin título").slice(0, 100),
    content: String(parsed.content ?? rawText),
    tags: Array.isArray(parsed.tags)
      ? parsed.tags.map((t: unknown) => String(t).toLowerCase()).slice(0, 4)
      : [],
    breakdown: parseBreakdown(parsed.breakdown),
  };
}
```

- [ ] **Step 5: Persistir el desglose en `captureIdeaNLP`**

En `captureIdeaNLP` (`lib/ideas.ts:181`), el default de `structured` gana `breakdown: null`:

```ts
  let structured: CapturedIdea = {
    title: rawText.slice(0, 80),
    content: rawText,
    tags: [],
    breakdown: null,
  };
```

Y en el `db.idea.create`, agregar al final del `data` (después de `status: "idea",`):

```ts
      ...(structured.breakdown
        ? { breakdown: structured.breakdown, breakdownAt: new Date() }
        : {}),
```

- [ ] **Step 6: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: 0 errores. (Si falla porque Prisma Client no conoce `breakdown`, correr `npm run db:generate` primero — depende de Task 1.)

- [ ] **Step 7: Commit**

```bash
git add lib/ideas.ts
git commit -m "feat(ideas): captura con desglose IA en una sola llamada a Haiku"
```

---

### Task 3: `lib/ideas.ts` — `generateIdeaBreakdown` (regeneración bajo demanda)

**Files:**
- Modify: `lib/ideas.ts`

- [ ] **Step 1: Agregar la llamada a Claude solo-desglose y la función pública**

Después de `captureIdeaNLP`, antes de `updateIdea`:

```ts
// -------------------------------------------------------
// Desglose bajo demanda — para ideas viejas o regeneración
// -------------------------------------------------------

async function callClaudeForBreakdown(text: string): Promise<IdeaBreakdown | null> {
  const prompt = `El usuario quiere desglosar esta idea para llevarla a la acción:
"${text}"

Devolvé ÚNICAMENTE un objeto JSON con exactamente esta clave, sin texto adicional:
{
  ${BREAKDOWN_SPEC}
}
Sé breve y accionable, en español rioplatense.`;

  const response = await callClaude({
    model: "claude-haiku-4-5-20251001",
    maxTokens: 1200,
    messages: [{ role: "user", content: prompt }],
  });
  if (!response) return null;

  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    // Claude puede devolver { breakdown: {...} } o el objeto desglose directo
    return parseBreakdown(parsed.breakdown ?? parsed);
  } catch {
    return null;
  }
}

export async function generateIdeaBreakdown(
  userId: string,
  ideaId: string
): Promise<IdeaWithMeta> {
  const idea = await db.idea.findUnique({ where: { id: ideaId } });
  if (!idea || idea.userId !== userId) {
    throw new Error("Idea no encontrada o sin permiso");
  }

  const breakdown = await callClaudeForBreakdown(idea.cleanedText ?? idea.rawText);
  if (!breakdown) {
    // No tocar el desglose anterior si la generación falló
    throw new Error("No se pudo generar el desglose. Intentá de nuevo.");
  }

  const updated = await db.idea.update({
    where: { id: ideaId },
    data: { breakdown, breakdownAt: new Date() },
  });

  return toIdeaWithMeta(updated);
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add lib/ideas.ts
git commit -m "feat(ideas): generateIdeaBreakdown para desglose bajo demanda"
```

---

### Task 4: Agente de WhatsApp — capture con desglose verbatim + intent expand real

**Files:**
- Modify: `agents/ideas/index.ts`

- [ ] **Step 1: Actualizar imports y agregar `formatBreakdownPlain`**

Reemplazar el import de `@/lib/ideas` (`agents/ideas/index.ts:7`) por:

```ts
import {
  captureIdeaNLP,
  getRecentIdeas,
  getIdeasStats,
  getAllIdeas,
  generateIdeaBreakdown,
} from "@/lib/ideas";
import type { IdeaBreakdown } from "@/lib/ideas";
```

Agregar después de la función `normalize` (texto plano, sin markdown — regla de WhatsApp):

```ts
export function formatBreakdownPlain(b: IdeaBreakdown): string {
  const lines: string[] = [];
  if (b.steps.length > 0) {
    lines.push("Pasos a seguir:");
    b.steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  }
  if (b.research.length > 0) {
    lines.push("", "Para investigar:");
    b.research.forEach((r) =>
      lines.push(`- ${r.question}${r.where ? ` (donde: ${r.where})` : ""}`)
    );
  }
  const ev = b.evaluation;
  if (ev.effort || ev.risks.length > 0 || ev.verdict) {
    lines.push("", "Evaluacion rapida:");
    if (ev.effort) lines.push(`Esfuerzo: ${ev.effort}`);
    if (ev.risks.length > 0) lines.push(`Riesgos: ${ev.risks.join("; ")}`);
    if (ev.verdict) lines.push(`Veredicto: ${ev.verdict}`);
  }
  if (b.firstStep) lines.push("", `Primer paso de hoy: ${b.firstStep}`);
  return lines.join("\n");
}
```

- [ ] **Step 2: Cambiar la firma de `processIdeasMessage` a `{ message, verbatim }` e implementar capture + expand**

Agregar el helper de extracción para expand (después de `extractIdeaText`):

```ts
function extractExpandQuery(text: string): string {
  return text
    .replace(/^(desglos[aá](me)?|desarroll[aá](me)?|expand[ií](me)?|profundiz[aá]r?)\s*/i, "")
    .replace(/^(la|una)?\s*idea\s*(de|del|sobre)?\s*/i, "")
    .replace(/["“”]/g, "")
    .trim();
}
```

Reemplazar `processIdeasMessage` completa por:

```ts
export async function processIdeasMessage(
  userId: string,
  text: string
): Promise<{ message: string; verbatim: boolean }> {
  const intent = await detectIntent(text);
  try {
    if (intent === "capture") {
      const rawText = extractIdeaText(text);
      if (rawText.length < 3) return { message: "Cual es la idea? Contame mas.", verbatim: false };
      const idea = await captureIdeaNLP(userId, rawText);
      const lines = [`Idea capturada: "${idea.title}"`];
      if (idea.tags.length > 0) lines.push(`Tags: ${idea.tags.map((t: string) => "#" + t).join(" ")}`);
      if (idea.breakdown) {
        lines.push("", formatBreakdownPlain(idea.breakdown));
        return { message: lines.join("\n"), verbatim: true };
      }
      lines.push("", "La podes ver y editar en la seccion de Ideas de la app.");
      return { message: lines.join("\n"), verbatim: false };
    }
    if (intent === "query") {
      const [recent, stats] = await Promise.all([getRecentIdeas(userId, 5), getIdeasStats(userId)]);
      if (stats.total === 0) {
        return { message: "Todavia no tenes ideas guardadas. Cuando se te ocurra algo, escribi idea: y lo capturo.", verbatim: false };
      }
      const lines = [
        `Tenes ${stats.total} ideas: ${stats.active ?? stats.total} activas, ${stats.done ?? 0} hechas`,
        "",
        "Las 5 mas recientes:",
      ];
      recent.forEach(idea => lines.push(`- ${idea.title ?? "Sin titulo"} (${idea.status})`));
      if (stats.topTags.length > 0) lines.push(`\nTop tags: ${stats.topTags.map((t: string) => "#" + t).join(" ")}`);
      return { message: lines.join("\n"), verbatim: false };
    }
    if (intent === "expand") {
      const query = extractExpandQuery(text);
      const matches = query ? await getAllIdeas(userId, { search: query }) : [];

      if (matches.length === 1) {
        const updated = await generateIdeaBreakdown(userId, matches[0].id);
        const body = updated.breakdown
          ? formatBreakdownPlain(updated.breakdown)
          : "No se pudo generar el desglose.";
        return { message: `Desglose de "${updated.title ?? "tu idea"}":\n\n${body}`, verbatim: true };
      }
      if (matches.length > 1) {
        const lines = ["Encontre varias ideas que coinciden. Cual de estas?"];
        matches.slice(0, 5).forEach(i => lines.push(`- ${i.title ?? i.rawText.slice(0, 50)}`));
        return { message: lines.join("\n"), verbatim: false };
      }
      const recent = await getRecentIdeas(userId, 5);
      if (recent.length === 0) {
        return { message: "Todavia no tenes ideas guardadas para desglosar.", verbatim: false };
      }
      const lines = ["No encontre esa idea. Las mas recientes son:"];
      recent.forEach(i => lines.push(`- ${i.title ?? i.rawText.slice(0, 50)}`));
      lines.push("Decime cual queres desglosar.");
      return { message: lines.join("\n"), verbatim: false };
    }
    return { message: "No entendi. Podes decirme idea: [texto] para capturar una nueva, que ideas tengo para verlas, o desglosa la idea de [tema] para que la desarme en pasos.", verbatim: false };
  } catch (err) {
    console.error("[ideasAgent] Error:", err);
    return { message: "Hubo un error procesando tu mensaje de ideas. Intenta de nuevo.", verbatim: false };
  }
}
```

Actualizar también la descripción del intent `expand` en `detectIntent` para que matchee pedidos de desglose:

```ts
      expand: "El usuario quiere desglosar, desarrollar, profundizar o expandir una idea existente en pasos a seguir",
```

- [ ] **Step 3: Actualizar `ideasAgent.process` para propagar verbatim**

Reemplazar el método `process` del objeto `ideasAgent` por:

```ts
  async process(input: AgentInput): Promise<AgentOutput> {
    if (!input.userId || !input.message) return { success: false, message: "userId y text son requeridos" };
    const { message, verbatim } = await processIdeasMessage(input.userId, input.message);
    return { success: true, message, ...(verbatim ? { data: { verbatim: true } } : {}) };
  },
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: **falla** en `lib/orchestrator.ts:146` — `processIdeasMessage` ya no devuelve `string`. Eso se arregla en Task 5. Cualquier otro error sí hay que corregirlo acá.

- [ ] **Step 5: Commit (junto con Task 5)**

No commitear todavía — el orquestador queda roto hasta el próximo task. Continuar directo a Task 5 y commitear ambos juntos.

---

### Task 5: Orquestador — respetar verbatim del agente de ideas

**Files:**
- Modify: `lib/orchestrator.ts:26` (import) y `lib/orchestrator.ts:145-147` (case "ideas")

- [ ] **Step 1: Cambiar el import**

Reemplazar:

```ts
import { processIdeasMessage } from "@/agents/ideas";
```

por:

```ts
import { ideasAgent } from "@/agents/ideas";
```

- [ ] **Step 2: Reemplazar el case "ideas" (mismo patrón que fitness)**

Reemplazar:

```ts
      case "ideas": {
        return { text: await processIdeasMessage(userId, text), verbatim: false };
      }
```

por:

```ts
      case "ideas": {
        const result = await ideasAgent.process(input);
        const verbatim = !!(result.data as { verbatim?: boolean } | undefined)?.verbatim;
        return { text: result.message, verbatim };
      }
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 4: Commit (Tasks 4 + 5 juntos)**

```bash
git add agents/ideas/index.ts lib/orchestrator.ts
git commit -m "feat(ideas): desglose verbatim por WhatsApp - capture + expand reales"
```

---

### Task 6: API — `POST /api/ideas/[id]/breakdown`

**Files:**
- Create: `app/api/ideas/[id]/breakdown/route.ts`

- [ ] **Step 1: Crear la ruta**

```ts
// ============================================================
// POST /api/ideas/[id]/breakdown — genera/regenera el desglose IA
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateIdeaBreakdown } from "@/lib/ideas";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const updated = await generateIdeaBreakdown(session.user.id, id);
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    const status = message.includes("no encontrada") ? 404 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add "app/api/ideas/[id]/breakdown/route.ts"
git commit -m "feat(ideas): endpoint POST /api/ideas/[id]/breakdown"
```

---

### Task 7: UI — sección Desglose en la tarjeta de idea

**Files:**
- Modify: `components/ideas/IdeasModuleClient.tsx`

- [ ] **Step 1: Imports y estado nuevo en `IdeasModuleClient`**

En el import de lucide-react (`IdeasModuleClient.tsx:10`), agregar `ListChecks` y `Sparkles`:

```ts
import { Lightbulb, Plus, Search, Tag, Trash2, RotateCcw, Loader2, X, ListChecks, Sparkles } from "lucide-react";
```

En el import de tipos (`:11`), agregar `IdeaBreakdown`:

```ts
import type { IdeaWithMeta, IdeasStats, IdeaPriority, IdeaStatus, IdeaBreakdown } from "@/lib/ideas";
```

En el componente, junto a los estados de "In-flight actions" (`:74`):

```ts
  const [breakdownLoadingId, setBreakdownLoadingId] = useState<string | null>(null);
  const [breakdownError, setBreakdownError] = useState<{ id: string; message: string } | null>(null);
```

- [ ] **Step 2: Handler `handleGenerateBreakdown`**

Agregar después de `handleSaveEdit`:

```ts
  // ── Desglose IA ───────────────────────────────────────────────────────────────
  async function handleGenerateBreakdown(ideaId: string) {
    setBreakdownLoadingId(ideaId);
    setBreakdownError(null);
    try {
      const res = await fetch(`/api/ideas/${ideaId}/breakdown`, { method: "POST" });
      if (res.ok) {
        const updated: IdeaWithMeta = await res.json();
        setIdeas((prev) => prev.map((i) => (i.id === ideaId ? updated : i)));
      } else {
        const err = await res.json().catch(() => ({}));
        setBreakdownError({
          id: ideaId,
          message: (err as { error?: string }).error ?? "Error generando el desglose",
        });
      }
    } catch {
      setBreakdownError({ id: ideaId, message: "Error de conexión" });
    } finally {
      setBreakdownLoadingId(null);
    }
  }
```

- [ ] **Step 3: Pasar props nuevas a `IdeaCard`**

En el render de `<IdeaCard ...>` (`:383`), agregar:

```tsx
              isGeneratingBreakdown={breakdownLoadingId === idea.id}
              breakdownError={breakdownError?.id === idea.id ? breakdownError.message : null}
              onGenerateBreakdown={() => handleGenerateBreakdown(idea.id)}
```

Y en `IdeaCardProps` (`:434`):

```ts
  isGeneratingBreakdown: boolean;
  breakdownError: string | null;
  onGenerateBreakdown: () => void;
```

(Recordar destructurarlas en la firma de `IdeaCard`.)

- [ ] **Step 4: Bloque Desglose dentro del contenido expandido**

En `IdeaCard`, dentro del bloque `{isExpanded && (...)}`, **después** del `<div className="border-t ... pt-3">` del texto y **antes** del Action bar, agregar:

```tsx
          {/* ── Desglose IA ──────────────────────────────────────────────── */}
          {!isEditing && (
            <div className="border-t border-outline-variant/20 pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                  <ListChecks className="w-3.5 h-3.5 text-module-ideas" />
                  Desglose
                </span>
                <button
                  onClick={onGenerateBreakdown}
                  disabled={isGeneratingBreakdown}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-module-ideas/30 text-module-ideas bg-module-ideas/10 hover:opacity-80 disabled:opacity-50 transition-all"
                >
                  {isGeneratingBreakdown ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  {isGeneratingBreakdown
                    ? "Generando…"
                    : idea.breakdown
                      ? "Regenerar"
                      : "Desglosar"}
                </button>
              </div>

              {breakdownError && (
                <p className="text-xs text-red-400">{breakdownError}</p>
              )}

              {idea.breakdown ? (
                <BreakdownView breakdown={idea.breakdown} />
              ) : (
                !isGeneratingBreakdown && (
                  <p className="text-xs text-outline">
                    Todavía no hay desglose. Tocá &quot;Desglosar&quot; para generar pasos,
                    investigación y evaluación con IA.
                  </p>
                )
              )}
            </div>
          )}
```

- [ ] **Step 5: Componente `BreakdownView`**

Agregar al final del archivo:

```tsx
// ─── Breakdown View ───────────────────────────────────────────────────────────

function BreakdownView({ breakdown }: { breakdown: IdeaBreakdown }) {
  const ev = breakdown.evaluation;
  return (
    <div className="space-y-3">
      {breakdown.steps.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-on-surface mb-1">Pasos a seguir</p>
          <ol className="space-y-1">
            {breakdown.steps.map((step, i) => (
              <li key={i} className="flex gap-2 text-xs text-on-surface-variant leading-relaxed">
                <span className="text-module-ideas font-semibold flex-shrink-0">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {breakdown.research.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-on-surface mb-1">Qué investigar</p>
          <ul className="space-y-1">
            {breakdown.research.map((r, i) => (
              <li key={i} className="text-xs leading-relaxed">
                <span className="text-on-surface-variant">{r.question}</span>
                {r.where && <span className="text-outline"> — {r.where}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(ev.effort || ev.risks.length > 0 || ev.verdict) && (
        <div>
          <p className="text-xs font-semibold text-on-surface mb-1">Evaluación rápida</p>
          <div className="space-y-0.5 text-xs text-on-surface-variant">
            {ev.effort && <p>Esfuerzo: {ev.effort}</p>}
            {ev.risks.length > 0 && <p>Riesgos: {ev.risks.join("; ")}</p>}
            {ev.verdict && <p>Veredicto: {ev.verdict}</p>}
          </div>
        </div>
      )}

      {breakdown.firstStep && (
        <div className="bg-module-ideas/10 border border-module-ideas/20 rounded-lg px-3 py-2">
          <p className="text-xs font-semibold text-module-ideas mb-0.5">Primer paso de hoy</p>
          <p className="text-xs text-on-surface-variant">{breakdown.firstStep}</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 7: Commit**

```bash
git add components/ideas/IdeasModuleClient.tsx
git commit -m "feat(ideas): seccion Desglose con boton generar/regenerar en la tarjeta"
```

---

### Task 8: Verificación final

- [ ] **Step 1: Type-check completo**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 2: Build de producción**

Run: `npm run build`
Expected: build exitoso (`prisma generate` + `next build` sin errores).

- [ ] **Step 3: Recordatorio para el usuario (manual, antes de deployar)**

1. Correr el SQL de Task 1 Step 3 en el Supabase SQL Editor (si `db:push` falló).
2. Prueba manual: capturar una idea por la web (debe llegar con desglose), tocar "Desglosar" en una idea vieja, mandar "idea: ..." y "desglosá la idea de ..." por WhatsApp.

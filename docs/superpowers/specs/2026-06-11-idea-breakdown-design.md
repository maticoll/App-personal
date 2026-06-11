# Desglose de ideas con IA — Diseño

**Fecha:** 2026-06-11
**Estado:** Aprobado

## Objetivo

Cuando entra una idea (por WhatsApp o por la web), la IA la desglosa automáticamente: pasos a seguir, qué investigar y dónde, evaluación rápida y un primer paso accionable para hoy. Las ideas existentes también se pueden desglosar (o regenerar) bajo demanda desde la web o por WhatsApp.

## Decisiones tomadas

- **Disparador:** automático en cada captura nueva + bajo demanda (botón en web, intent por WhatsApp) para ideas viejas o regeneración.
- **Respuesta de WhatsApp al capturar:** confirmación + desglose completo en el mismo mensaje.
- **Secciones del desglose:** pasos a seguir, qué investigar y dónde, evaluación rápida, primer paso de hoy.
- **Arquitectura (Opción A):** campo JSON en el modelo `Idea`, sin modelo separado ni historial de versiones (YAGNI).
- **Modelo de IA:** una sola llamada a `claude-sonnet-4-6` que reemplaza la llamada actual a Haiku en `captureIdeaNLP` y devuelve estructura + desglose juntos. Más simple y barato que Haiku + Sonnet por separado; la latencia no importa porque el webhook procesa en `after()`.

## 1. Datos

Al modelo `Idea` en `prisma/schema.prisma` se agregan:

```prisma
breakdown   Json?     // Desglose generado por IA (IdeaBreakdown)
breakdownAt DateTime? // Cuándo se generó/regeneró
```

Por el gotcha de `prisma db push` contra Supabase, el cambio se aplica con SQL directo en el Supabase SQL Editor:

```sql
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS breakdown jsonb;
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS "breakdownAt" timestamp(3);
```

Luego `npm run db:generate` local.

Tipo TypeScript en `lib/ideas.ts`:

```ts
export type IdeaBreakdown = {
  steps: string[];                                   // pasos ordenados, concretos
  research: { question: string; where: string }[];   // qué investigar y dónde (fuente concreta)
  evaluation: { effort: string; risks: string[]; verdict: string };
  firstStep: string;                                 // una acción chica para hoy
};
```

`IdeaWithMeta` incorpora `breakdown: IdeaBreakdown | null` y `breakdownAt: Date | null`.

## 2. Generación (`lib/ideas.ts`)

- `callClaudeForIdea(rawText)` pasa a usar `claude-sonnet-4-6` (maxTokens ~2000) y devuelve `{ title, content, tags, breakdown }` en un único JSON. El prompt pide las 4 secciones en español rioplatense, con pasos accionables y fuentes concretas (sitios, comunidades, herramientas, personas).
- `captureIdeaNLP` guarda `breakdown` y `breakdownAt` junto con el resto. **Fallback sin cambios de espíritu:** si la llamada a Claude falla o el JSON es inválido, la idea se guarda igual con texto crudo y `breakdown: null` — nunca se pierde una idea.
- Nueva función `generateIdeaBreakdown(userId, ideaId): Promise<IdeaWithMeta>`: carga la idea, valida ownership, llama al mismo prompt (solo la parte de desglose, usando `cleanedText ?? rawText`), persiste `breakdown` + `breakdownAt` y devuelve la idea actualizada. Si falla, lanza error claro sin tocar el desglose anterior.
- Parseo del JSON con validación defensiva por campo (igual estilo que el parseo actual): arrays coaccionados, strings con `String(...)`, secciones faltantes → valores vacíos razonables.

## 3. WhatsApp (`agents/ideas/index.ts`)

- **Intent `capture`:** tras `captureIdeaNLP`, la respuesta incluye confirmación (título + tags) seguida del desglose completo formateado en texto plano (sin markdown: guiones y numeración simple). El agente devuelve `data: { verbatim: true }` para que el Sonnet del orquestador no reescriba el formato.
- **Intent `expand`** (hoy stub): "desglosá la idea de X" → busca la idea por coincidencia en título/texto (`getAllIdeas` con `search`), si hay match único o claro genera/regenera con `generateIdeaBreakdown` y devuelve el desglose verbatim. Si no encuentra o hay ambigüedad, lista candidatos y pide precisión. Si la idea ya tenía desglose, se regenera (pisa el anterior).
- Helper compartido `formatBreakdownPlain(idea)` para el texto plano del desglose (lo usan capture y expand).

## 4. Web

- **API:** nueva ruta `POST /api/ideas/[id]/breakdown` → llama `generateIdeaBreakdown`, devuelve la idea actualizada. Auth igual que el resto de rutas de ideas. `GET /api/ideas` ya incluye el desglose porque viene en el modelo.
- **UI (`components/ideas/`):** en la tarjeta de idea, sección expandible "Desglose" que renderiza las 4 partes (pasos numerados, investigación como pregunta + dónde, evaluación, primer paso destacado). Botón "Desglosar" (si no tiene) o "Regenerar" (si tiene), con estado de carga y manejo de error. Mobile-first, estilos consistentes con el módulo.

## 5. Manejo de errores

| Situación | Comportamiento |
|---|---|
| Claude falla durante captura | Idea guardada sin desglose (como hoy), log en consola |
| Claude falla durante regeneración | Error claro al usuario; desglose anterior intacto |
| JSON parcial/inválido | Validación defensiva por campo; si el desglose entero es inservible → `breakdown: null` en captura, error en regeneración |
| Idea no encontrada por WhatsApp | Mensaje pidiendo más precisión, con candidatos si los hay |

## 6. Verificación

- `npx tsc --noEmit` en 0 errores + `npm run build` (no hay framework de tests).
- Prueba manual: capturar idea por WhatsApp (ver desglose en la respuesta), capturar por web, desglosar una idea vieja desde el botón, regenerar, y "desglosá la idea de X" por WhatsApp.

## Fuera de alcance

- Historial de versiones del desglose.
- Convertir pasos del desglose en tareas/proyectos.
- Desglose batch de todas las ideas viejas.

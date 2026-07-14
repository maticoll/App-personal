// ============================================================
// lib/ideas.ts — Módulo de Ideas (con priority + status)
// ============================================================

import { db } from "@/lib/db";
import { callClaude } from "@/lib/claude";
import {
  startOfDayUY,
  endOfDayUY,
  uyDateKey,
  addDays,
  UY_OFFSET,
} from "@/lib/dates";

// -------------------------------------------------------
// Tipos
// -------------------------------------------------------

export type IdeaPriority = "baja" | "media" | "alta" | "urgente";
export type IdeaStatus = "idea" | "progreso" | "hecha";

export type IdeaBreakdown = {
  steps: string[]; // pasos ordenados, concretos
  research: { question: string; where: string }[]; // qué investigar y dónde
  evaluation: { effort: string; risks: string[]; verdict: string };
  firstStep: string; // una acción chica para hoy
};

export type IdeaWithMeta = {
  id: string;
  rawText: string;
  cleanedText: string | null;
  title: string | null;
  tags: string[];
  priority: IdeaPriority;
  status: IdeaStatus;
  luminaId: string | null;
  breakdown: IdeaBreakdown | null;
  breakdownAt: Date | null;
  wordCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type IdeasStats = {
  total: number;
  active: number; // idea + progreso
  done: number; // hecha
  thisWeek: number;
  thisMonth: number;
  topTags: string[];
};

export type CapturedIdea = {
  title: string;
  content: string;
  tags: string[];
  breakdown: IdeaBreakdown | null;
};

// -------------------------------------------------------
// Status cycling
// -------------------------------------------------------

const STATUS_CYCLE: Record<IdeaStatus, IdeaStatus> = {
  idea: "progreso",
  progreso: "hecha",
  hecha: "idea",
};

export function nextStatus(current: IdeaStatus): IdeaStatus {
  return STATUS_CYCLE[current] ?? "idea";
}

// -------------------------------------------------------
// Helpers — parseBreakdown (valida campo por campo el JSON de Claude
// o el Json crudo de la DB). Devuelve null si no hay nada usable.
// -------------------------------------------------------

export function parseBreakdown(raw: unknown): IdeaBreakdown | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  const steps = Array.isArray(obj.steps)
    ? obj.steps.map((s) => String(s).trim()).filter(Boolean)
    : [];

  const research = Array.isArray(obj.research)
    ? obj.research
        .filter(
          (r): r is Record<string, unknown> => !!r && typeof r === "object",
        )
        .map((r) => ({
          question: String(r.question ?? "").trim(),
          where: String(r.where ?? "").trim(),
        }))
        .filter((r) => r.question)
    : [];

  const evalRaw =
    obj.evaluation &&
    typeof obj.evaluation === "object" &&
    !Array.isArray(obj.evaluation)
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

function toIdeaWithMeta(idea: {
  id: string;
  rawText: string;
  cleanedText: string | null;
  title: string | null;
  tags: string[];
  priority: string;
  status: string;
  luminaId: string | null;
  breakdown: unknown;
  breakdownAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): IdeaWithMeta {
  const text = idea.cleanedText ?? idea.rawText;
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  return {
    ...idea,
    priority: (idea.priority as IdeaPriority) ?? "media",
    status: (idea.status as IdeaStatus) ?? "idea",
    breakdown: parseBreakdown(idea.breakdown),
    breakdownAt: idea.breakdownAt,
    wordCount,
  };
}

// -------------------------------------------------------
// Obtener todas las ideas (con filtros opcionales)
// -------------------------------------------------------

export async function getAllIdeas(
  userId: string,
  options?: { tag?: string; search?: string; status?: IdeaStatus },
): Promise<IdeaWithMeta[]> {
  const ideas = await db.idea.findMany({
    where: {
      userId,
      ...(options?.tag ? { tags: { has: options.tag } } : {}),
      ...(options?.status ? { status: options.status } : {}),
      ...(options?.search
        ? {
            OR: [
              { title: { contains: options.search, mode: "insensitive" } },
              {
                cleanedText: { contains: options.search, mode: "insensitive" },
              },
              { rawText: { contains: options.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [
      // urgente primero, luego por createdAt
      { createdAt: "desc" },
    ],
  });

  return ideas.map(toIdeaWithMeta);
}

// -------------------------------------------------------
// Ideas recientes
// -------------------------------------------------------

export async function getRecentIdeas(
  userId: string,
  limit: number = 5,
): Promise<IdeaWithMeta[]> {
  const ideas = await db.idea.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return ideas.map(toIdeaWithMeta);
}

// -------------------------------------------------------
// Obtener idea por ID
// -------------------------------------------------------

export async function getIdea(
  userId: string,
  ideaId: string,
): Promise<IdeaWithMeta | null> {
  const idea = await db.idea.findUnique({ where: { id: ideaId } });
  if (!idea || idea.userId !== userId) return null;
  return toIdeaWithMeta(idea);
}

// -------------------------------------------------------
// Capturar idea con NLP — Claude estructura el texto
// -------------------------------------------------------

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

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error("Claude returned invalid JSON");
  }
  return {
    title: String(parsed.title ?? "Idea sin título").slice(0, 100),
    content: String(parsed.content ?? rawText),
    tags: Array.isArray(parsed.tags)
      ? parsed.tags.map((t: unknown) => String(t).toLowerCase()).slice(0, 4)
      : [],
    breakdown: parseBreakdown(parsed.breakdown),
  };
}

export async function captureIdeaNLP(
  userId: string,
  rawText: string,
  options?: { priority?: IdeaPriority },
): Promise<IdeaWithMeta> {
  let structured: CapturedIdea = {
    title: rawText.slice(0, 80),
    content: rawText,
    tags: [],
    breakdown: null,
  };

  try {
    structured = await callClaudeForIdea(rawText);
  } catch (err) {
    console.error("[ideas] Error estructurando idea con Claude:", err);
  }

  const idea = await db.idea.create({
    data: {
      userId,
      rawText,
      cleanedText: structured.content,
      title: structured.title,
      tags: structured.tags,
      priority: options?.priority ?? "media",
      status: "idea",
      ...(structured.breakdown
        ? { breakdown: structured.breakdown, breakdownAt: new Date() }
        : {}),
    },
  });

  return toIdeaWithMeta(idea);
}

// -------------------------------------------------------
// Desglose bajo demanda — para ideas viejas o regeneración
// -------------------------------------------------------

async function callClaudeForBreakdown(
  text: string,
): Promise<IdeaBreakdown | null> {
  const prompt = `El usuario quiere desglosar esta idea para llevarla a la acción:
"${text}"

Devolvé ÚNICAMENTE un objeto JSON con exactamente estas claves, sin texto adicional:
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
    const parsed: Record<string, unknown> = JSON.parse(jsonMatch[0]);
    // Claude puede devolver { breakdown: {...} } o el objeto desglose directo
    return parseBreakdown(parsed.breakdown ?? parsed);
  } catch {
    return null;
  }
}

export async function generateIdeaBreakdown(
  userId: string,
  ideaId: string,
): Promise<IdeaWithMeta> {
  const idea = await db.idea.findUnique({ where: { id: ideaId } });
  if (!idea || idea.userId !== userId) {
    throw new Error("Idea no encontrada o sin permiso");
  }

  const breakdown = await callClaudeForBreakdown(
    idea.cleanedText ?? idea.rawText,
  );
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

// -------------------------------------------------------
// Actualizar idea (edición manual)
// -------------------------------------------------------

export async function updateIdea(
  userId: string,
  ideaId: string,
  data: {
    title?: string;
    content?: string;
    tags?: string[];
    priority?: IdeaPriority;
    status?: IdeaStatus;
  },
): Promise<IdeaWithMeta> {
  const idea = await db.idea.findUnique({ where: { id: ideaId } });
  if (!idea || idea.userId !== userId) {
    throw new Error("Idea no encontrada o sin permiso");
  }

  const updated = await db.idea.update({
    where: { id: ideaId },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.content !== undefined ? { cleanedText: data.content } : {}),
      ...(data.tags !== undefined ? { tags: data.tags } : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    },
  });

  return toIdeaWithMeta(updated);
}

// -------------------------------------------------------
// Ciclar estado (idea → progreso → hecha → idea)
// -------------------------------------------------------

export async function cycleIdeaStatus(
  userId: string,
  ideaId: string,
): Promise<IdeaWithMeta> {
  const idea = await db.idea.findUnique({ where: { id: ideaId } });
  if (!idea || idea.userId !== userId) {
    throw new Error("Idea no encontrada o sin permiso");
  }

  const currentStatus = (idea.status as IdeaStatus) ?? "idea";
  const newStatus = nextStatus(currentStatus);

  const updated = await db.idea.update({
    where: { id: ideaId },
    data: { status: newStatus },
  });

  return toIdeaWithMeta(updated);
}

// -------------------------------------------------------
// Eliminar idea
// -------------------------------------------------------

export async function deleteIdea(
  userId: string,
  ideaId: string,
): Promise<void> {
  const idea = await db.idea.findUnique({ where: { id: ideaId } });
  if (!idea || idea.userId !== userId) {
    throw new Error("Idea no encontrada o sin permiso");
  }
  await db.idea.delete({ where: { id: ideaId } });
}

// -------------------------------------------------------
// Stats generales
// -------------------------------------------------------

export async function getIdeasStats(userId: string): Promise<IdeasStats> {
  const now = new Date();
  // Semana/mes en calendario UY (getDay()/getMonth() usaban el del server)
  const dayIdx = new Date(`${uyDateKey(now)}T12:00:00Z`).getUTCDay();
  const startOfWeek = addDays(startOfDayUY(now), -dayIdx);
  const [uyY, uyM] = uyDateKey(now).split("-");
  const startOfMonth = new Date(`${uyY}-${uyM}-01T00:00:00${UY_OFFSET}`);

  const [total, done, thisWeek, thisMonth, allIdeas] = await Promise.all([
    db.idea.count({ where: { userId } }),
    db.idea.count({ where: { userId, status: "hecha" } }),
    db.idea.count({ where: { userId, createdAt: { gte: startOfWeek } } }),
    db.idea.count({ where: { userId, createdAt: { gte: startOfMonth } } }),
    db.idea.findMany({ where: { userId }, select: { tags: true } }),
  ]);

  const tagCount = new Map<string, number>();
  for (const idea of allIdeas) {
    for (const tag of idea.tags) {
      tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);
    }
  }
  const topTags = Array.from(tagCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag);

  return {
    total,
    active: total - done,
    done,
    thisWeek,
    thisMonth,
    topTags,
  };
}

// -------------------------------------------------------
// Actividad de ideas para dashboard informativo (no score)
// -------------------------------------------------------

export async function getIdeasActivityForDate(
  userId: string,
  date: Date,
): Promise<number> {
  return db.idea.count({
    where: {
      userId,
      createdAt: { gte: startOfDayUY(date), lte: endOfDayUY(date) },
    },
  });
}

// ============================================================
// lib/ideas.ts — Módulo de Ideas
// Sesión 5 — Nutrición + Ideas
// ============================================================

import { db } from "@/lib/db";

// -------------------------------------------------------
// Tipos
// -------------------------------------------------------

export type IdeaWithMeta = {
  id: string;
  rawText: string;
  cleanedText: string | null; // texto estructurado por IA
  title: string | null;
  tags: string[];
  luminaId: string | null;
  wordCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type IdeasStats = {
  total: number;
  thisWeek: number;
  thisMonth: number;
  topTags: string[];
};

export type CapturedIdea = {
  title: string;
  content: string; // texto expandido por IA (mapea a cleanedText en DB)
  tags: string[];
};

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

function toIdeaWithMeta(idea: {
  id: string;
  rawText: string;
  cleanedText: string | null;
  title: string | null;
  tags: string[];
  luminaId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): IdeaWithMeta {
  const text = idea.cleanedText ?? idea.rawText;
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  return { ...idea, wordCount };
}

// -------------------------------------------------------
// Obtener todas las ideas (con filtros opcionales)
// -------------------------------------------------------

export async function getAllIdeas(
  userId: string,
  options?: { tag?: string; search?: string }
): Promise<IdeaWithMeta[]> {
  const ideas = await db.idea.findMany({
    where: {
      userId,
      ...(options?.tag
        ? { tags: { has: options.tag } }
        : {}),
      ...(options?.search
        ? {
            OR: [
              { title: { contains: options.search, mode: "insensitive" } },
              { cleanedText: { contains: options.search, mode: "insensitive" } },
              { rawText: { contains: options.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return ideas.map(toIdeaWithMeta);
}

// -------------------------------------------------------
// Ideas recientes
// -------------------------------------------------------

export async function getRecentIdeas(
  userId: string,
  limit: number = 5
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
  ideaId: string
): Promise<IdeaWithMeta | null> {
  const idea = await db.idea.findUnique({ where: { id: ideaId } });
  if (!idea || idea.userId !== userId) return null;
  return toIdeaWithMeta(idea);
}

// -------------------------------------------------------
// Capturar idea con NLP — Claude estructura el texto
// -------------------------------------------------------

async function callClaudeForIdea(rawText: string): Promise<CapturedIdea> {
  const prompt = `El usuario capturó la siguiente idea en texto informal/criollo:
"${rawText}"

Estructurá esta idea. Devolvé ÚNICAMENTE un objeto JSON con exactamente estas claves, sin texto adicional:
{
  "title": "título conciso de máximo 8 palabras",
  "content": "idea expandida y estructurada en máximo 3 párrafos, manteniendo la esencia del input original. No la transformes radicalmente, solo clarificá y expandí levemente.",
  "tags": ["tag1", "tag2"] (array de 1 a 4 tags relevantes en minúsculas, en español, sin símbolos)
}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.content[0].text.trim();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in Claude response");

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    title: String(parsed.title ?? "Idea sin título").slice(0, 100),
    content: String(parsed.content ?? rawText),
    tags: Array.isArray(parsed.tags)
      ? parsed.tags.map((t: unknown) => String(t).toLowerCase()).slice(0, 4)
      : [],
  };
}

export async function captureIdeaNLP(
  userId: string,
  rawText: string
): Promise<IdeaWithMeta> {
  let structured: CapturedIdea = {
    title: rawText.slice(0, 80),
    content: rawText,
    tags: [],
  };

  try {
    structured = await callClaudeForIdea(rawText);
  } catch (err) {
    console.error("[ideas] Error estructurando idea con Claude:", err);
    // Guardar igual con el texto original si falla Claude
  }

  const idea = await db.idea.create({
    data: {
      userId,
      rawText,
      cleanedText: structured.content,
      title: structured.title,
      tags: structured.tags,
      // TODO: Sesión 7 — sync con Lumina API
      // luminaId: await syncToLumina(structured)
    },
  });

  return toIdeaWithMeta(idea);
}

// -------------------------------------------------------
// Actualizar idea (edición manual)
// -------------------------------------------------------

export async function updateIdea(
  userId: string,
  ideaId: string,
  data: { title?: string; content?: string; tags?: string[] }
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
    },
  });

  return toIdeaWithMeta(updated);
}

// -------------------------------------------------------
// Eliminar idea
// -------------------------------------------------------

export async function deleteIdea(userId: string, ideaId: string): Promise<void> {
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
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [total, thisWeek, thisMonth, allIdeas] = await Promise.all([
    db.idea.count({ where: { userId } }),
    db.idea.count({ where: { userId, createdAt: { gte: startOfWeek } } }),
    db.idea.count({ where: { userId, createdAt: { gte: startOfMonth } } }),
    db.idea.findMany({ where: { userId }, select: { tags: true } }),
  ]);

  // Top tags: contar frecuencia
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

  return { total, thisWeek, thisMonth, topTags };
}

// -------------------------------------------------------
// Actividad de ideas para dashboard informativo (no score)
// -------------------------------------------------------

export async function getIdeasActivityForDate(
  userId: string,
  date: Date
): Promise<number> {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);

  return db.idea.count({
    where: {
      userId,
      createdAt: { gte: d, lte: end },
    },
  });
}

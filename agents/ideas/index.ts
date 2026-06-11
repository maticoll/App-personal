// ============================================================
// Agente de Ideas
// Sesion 5 - implementacion completa
// ============================================================

import type { AgentInput, AgentOutput } from "@/lib/types";
import {
  captureIdeaNLP,
  getRecentIdeas,
  getIdeasStats,
  getAllIdeas,
  generateIdeaBreakdown,
} from "@/lib/ideas";
import type { IdeaBreakdown } from "@/lib/ideas";
import { detectIntentAI } from "@/lib/nlp";

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .split("")
    .filter((c) => {
      const code = c.charCodeAt(0);
      return code < 0x0300 || code > 0x036f;
    })
    .join("");
}

export function formatBreakdownPlain(b: IdeaBreakdown): string {
  const lines: string[] = [];
  if (b.steps.length > 0) {
    lines.push("Pasos a seguir:");
    b.steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  }
  if (b.research.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("Para investigar:");
    b.research.forEach((r) =>
      lines.push(`- ${r.question}${r.where ? ` (donde: ${r.where})` : ""}`)
    );
  }
  const ev = b.evaluation;
  if (ev.effort || ev.risks.length > 0 || ev.verdict) {
    if (lines.length > 0) lines.push("");
    lines.push("Evaluacion rapida:");
    if (ev.effort) lines.push(`Esfuerzo: ${ev.effort}`);
    if (ev.risks.length > 0) lines.push(`Riesgos: ${ev.risks.join("; ")}`);
    if (ev.verdict) lines.push(`Veredicto: ${ev.verdict}`);
  }
  if (b.firstStep) {
    if (lines.length > 0) lines.push("");
    lines.push(`Primer paso de hoy: ${b.firstStep}`);
  }
  return lines.join("\n");
}

type IdeasIntent = "capture" | "query" | "expand" | "unknown";

async function detectIntent(text: string): Promise<IdeasIntent> {
  const intent = await detectIntentAI(
    "Eres el agente de ideas de una app personal.",
    {
      capture: "El usuario quiere guardar, anotar o registrar una idea, pensamiento u ocurrencia",
      query: "El usuario pregunta por sus ideas guardadas, quiere verlas o listarlas",
      expand: "El usuario quiere desglosar, desarrollar, profundizar o expandir una idea existente en pasos a seguir",
      unknown: "Otro mensaje no relacionado a ideas",
    },
    text
  );
  return intent as IdeasIntent;
}

function extractIdeaText(text: string): string {
  return text.replace(/^(idea:|tengo una idea:?|se me ocurrio:?|anotar:?|capturar:?)\s*/i, "").trim() || text.trim();
}

function extractExpandQuery(text: string): string {
  return text
    .replace(/^(desglos[aá](me)?|desarroll[aá](me)?|expand[ií](me)?|profundiz[aá]r?)\s*/i, "")
    .replace(/^(la|una|mi|tu|su)?\s*idea\s*(del|de la|de|sobre)?\s*/i, "")
    .replace(/["""]/g, "")
    .trim();
}

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

export const ideasAgent = {
  name: "ideas",
  description: "Captura y estructura ideas con IA",
  async process(input: AgentInput): Promise<AgentOutput> {
    if (!input.userId || !input.message) return { success: false, message: "userId y text son requeridos" };
    const { message, verbatim } = await processIdeasMessage(input.userId, input.message);
    return { success: true, message, ...(verbatim ? { data: { verbatim: true } } : {}) };
  },
  async cleanAndStructure(rawText: string): Promise<{ title: string; cleanedText: string; tags: string[] }> {
    return { title: rawText.slice(0, 60), cleanedText: rawText, tags: [] };
  },
  async syncLumina(_userId: string): Promise<void> {
    // TODO: Session 7 - sync con Lumina API
  },
  async calculateScore(_userId: string, _date: Date): Promise<number> { return 0; },
};

// suppress unused warning for normalize (kept for future use)
void normalize;

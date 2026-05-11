// ============================================================
// Agente de Ideas
// Sesion 5 - implementacion completa
// ============================================================

import type { AgentInput, AgentOutput } from "@/lib/types";
import { captureIdeaNLP, getRecentIdeas, getIdeasStats } from "@/lib/ideas";

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

type IdeasIntent = "capture" | "query" | "expand" | "unknown";

function detectIntent(text: string): IdeasIntent {
  const n = normalize(text);
  if (/\bidea:\s*|tengo una idea|se me ocurrio|idea nueva|anotar idea/.test(n)) return "capture";
  if (/que ideas (tengo|guarde)|mostra mis ideas|lista mis ideas|cuantas ideas/.test(n)) return "query";
  if (/desarrolla (la idea|eso de)|segui con|expandir la idea|profundiza/.test(n)) return "expand";
  return "unknown";
}

function extractIdeaText(text: string): string {
  return text.replace(/^(idea:|tengo una idea:?|se me ocurrio:?|anotar:?|capturar:?)\s*/i, "").trim() || text.trim();
}

export async function processIdeasMessage(userId: string, text: string): Promise<string> {
  const intent = detectIntent(text);
  try {
    if (intent === "capture") {
      const rawText = extractIdeaText(text);
      if (rawText.length < 3) return "Cual es la idea? Contame mas.";
      const idea = await captureIdeaNLP(userId, rawText);
      let response = `Idea capturada: "${idea.title}"`;
      if (idea.tags.length > 0) response += `\nTags: ${idea.tags.map((t: string) => "#" + t).join(" ")}`;
      response += "\n\nLa podes ver y editar en la seccion de Ideas de la app.";
      return response;
    }
    if (intent === "query") {
      const [recent, stats] = await Promise.all([getRecentIdeas(userId, 5), getIdeasStats(userId)]);
      if (stats.total === 0) return "Todavia no tenes ideas guardadas. Cuando se te ocurra algo, escribi idea: y lo capturo.";
      const lines = [`Tenes ${stats.total} ideas (${stats.thisWeek} esta semana)`, "", "Las 5 mas recientes:"];
      recent.forEach(idea => lines.push(`- ${idea.title ?? "Sin titulo"}`));
      if (stats.topTags.length > 0) lines.push(`\nTop tags: ${stats.topTags.map((t: string) => "#" + t).join(" ")}`);
      return lines.join("\n");
    }
    if (intent === "expand") {
      return "Para desarrollar una idea en profundidad, abri la app y usa el modo conversacion. (Disponible en Session 7)";
    }
    return "No entendi. Podes decirme idea: [texto] para capturar una nueva, o que ideas tengo para ver las guardadas.";
  } catch (err) {
    console.error("[ideasAgent] Error:", err);
    return "Hubo un error procesando tu mensaje de ideas. Intenta de nuevo.";
  }
}

export const ideasAgent = {
  name: "ideas",
  description: "Captura y estructura ideas con IA",
  async process(input: AgentInput): Promise<AgentOutput> {
    if (!input.userId || !input.message) return { success: false, message: "userId y text son requeridos" };
    const message = await processIdeasMessage(input.userId, input.message);
    return { success: true, message };
  },
  async cleanAndStructure(rawText: string): Promise<{ title: string; cleanedText: string; tags: string[] }> {
    return { title: rawText.slice(0, 60), cleanedText: rawText, tags: [] };
  },
  async syncLumina(_userId: string): Promise<void> {
    // TODO: Session 7 - sync con Lumina API
  },
  async calculateScore(_userId: string, _date: Date): Promise<number> { return 0; },
};

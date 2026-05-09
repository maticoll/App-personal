// ============================================================
// Agente de Ideas
// Responsabilidades:
//   - Capturar ideas en texto informal / criollo
//   - Limpiar y estructurar con Claude API
//   - Sync con Lumina (app externa)
//   - Calcular score de ideas del día
//
// TODO: Sesión 5 — implementar lógica completa
// ============================================================

import type { AgentInput, AgentOutput } from "@/lib/types";

export const ideasAgent = {
  name: "ideas",
  description: "Captura y estructura ideas con IA",

  async process(_input: AgentInput): Promise<AgentOutput> {
    // TODO: Sesión 5
    return {
      success: false,
      message: "Módulo de ideas en construcción — Sesión 5",
    };
  },

  async cleanAndStructure(_rawText: string): Promise<{ title: string; cleanedText: string; tags: string[] }> {
    // TODO: Sesión 5 — usar Claude API para estructurar la idea
    return { title: "", cleanedText: "", tags: [] };
  },

  async syncLumina(_userId: string): Promise<void> {
    // TODO: Sesión 5 — sync con Lumina
  },

  async calculateScore(_userId: string, _date: Date): Promise<number> {
    // TODO: Sesión 5 — 1 idea = score > 0
    return 0;
  },
};

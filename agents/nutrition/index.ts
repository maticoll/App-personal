// ============================================================
// Agente de Nutrición
// Responsabilidades:
//   - Registrar comidas en lenguaje natural
//   - Calcular macros con Claude API
//   - Evaluar alineación con dieta del usuario
//   - Tracking de agua por termos
//   - Calcular score de nutrición
//
// TODO: Sesión 5 — implementar lógica completa
// ============================================================

import type { AgentInput, AgentOutput } from "@/lib/types";

export const nutritionAgent = {
  name: "nutrition",
  description: "Registra y analiza nutrición e hidratación",

  async process(_input: AgentInput): Promise<AgentOutput> {
    // TODO: Sesión 5
    return {
      success: false,
      message: "Módulo de nutrición en construcción — Sesión 5",
    };
  },

  async calculateMacros(_description: string, _userId: string): Promise<Record<string, number>> {
    // TODO: Sesión 5 — usar Claude API para calcular macros
    return {};
  },

  async calculateScore(_userId: string, _date: Date): Promise<number> {
    // TODO: Sesión 5 — lógica de scoring de nutrición
    return 0;
  },
};

// ============================================================
// Agente de Finanzas
// Responsabilidades:
//   - Interfaz con la app de finanzas existente (Next.js/Neon)
//   - Consultar transacciones, saldos, categorías
//   - Generar alertas proactivas de gasto
//   - Responder consultas en lenguaje natural
//
// TODO: Sesión 7 — integrar app de finanzas existente
// ============================================================

import type { AgentInput, AgentOutput } from "@/lib/types";

export const financesAgent = {
  name: "finances",
  description: "Interfaz con la app de finanzas",

  async process(_input: AgentInput): Promise<AgentOutput> {
    // TODO: Sesión 7
    return {
      success: false,
      message: "Módulo de finanzas en construcción — Sesión 7",
    };
  },

  async checkSpendingAlerts(_userId: string): Promise<AgentOutput | null> {
    // TODO: Sesión 7 — detectar gastos altos y generar alertas
    return null;
  },
};

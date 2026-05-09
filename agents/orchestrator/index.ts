// ============================================================
// Orquestrador Central
// - Único canal que recibe/envía mensajes de WhatsApp
// - Detecta intención y deriva al sub-agente correcto
// - Los sub-agentes NUNCA hablan directamente con WhatsApp
//
// TODO: Sesión 8 — implementar lógica completa
// ============================================================

import type { OrchestratorInput, AgentOutput, IntentClassification } from "@/lib/types";
import {
  sleepAgent,
  fitnessAgent,
  nutritionAgent,
  projectsAgent,
  ideasAgent,
  financesAgent,
  calendarAgent,
  scoringAgent,
} from "@/agents";

export const orchestrator = {
  name: "orchestrator",

  async handle(input: OrchestratorInput): Promise<AgentOutput> {
    // TODO: Sesión 8 — pipeline completo:
    // 1. Si es audio → Whisper transcribe
    // 2. Clasificar intención con Claude API
    // 3. Derivar al sub-agente correcto
    // 4. Formatear respuesta y enviar por WhatsApp

    const intent = await this.classifyIntent(input.message);
    const agent = this.routeToAgent(intent.module);

    if (!agent) {
      return {
        success: false,
        message: "No entendí bien eso. ¿Podés ser más específico?",
      };
    }

    return agent.process(input);
  },

  async classifyIntent(_message: string): Promise<IntentClassification> {
    // TODO: Sesión 8 — usar Claude API para clasificar la intención
    return {
      module: "unknown",
      confidence: 0,
    };
  },

  routeToAgent(module: IntentClassification["module"]) {
    const agents = {
      sleep: sleepAgent,
      fitness: fitnessAgent,
      nutrition: nutritionAgent,
      projects: projectsAgent,
      ideas: ideasAgent,
      finances: financesAgent,
      calendar: calendarAgent,
      scoring: scoringAgent,
      sync: null,    // TODO: Sesión 8 — sync global
      unknown: null,
    };
    return agents[module];
  },

  async sendWhatsApp(_userId: string, _message: string): Promise<void> {
    // TODO: Sesión 8 — enviar mensaje por WhatsApp Business API
  },

  async sendMorningSummary(_userId: string): Promise<void> {
    // TODO: Sesión 8 — compilar y enviar resumen matutino
  },
};

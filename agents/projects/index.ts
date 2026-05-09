// ============================================================
// Agente de Proyectos
// Responsabilidades:
//   - CRUD de proyectos personales
//   - Gestión Kanban (Todo / In Progress / Done)
//   - Sync con Notion (tareas IT del trabajo)
//   - Calcular score de proyectos
//
// TODO: Sesión 6 — implementar lógica completa
// ============================================================

import type { AgentInput, AgentOutput } from "@/lib/types";

export const projectsAgent = {
  name: "projects",
  description: "Gestiona proyectos personales y tareas de trabajo",

  async process(_input: AgentInput): Promise<AgentOutput> {
    // TODO: Sesión 6
    return {
      success: false,
      message: "Módulo de proyectos en construcción — Sesión 6",
    };
  },

  async syncNotion(_userId: string): Promise<void> {
    // TODO: Sesión 6 — pull de tareas IT desde Notion
  },

  async calculateScore(_userId: string, _date: Date): Promise<number> {
    // TODO: Sesión 6 — lógica de scoring de proyectos
    return 0;
  },
};

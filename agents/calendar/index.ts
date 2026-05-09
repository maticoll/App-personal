// ============================================================
// Agente de Calendario
// Responsabilidades:
//   - Consultar Google Calendar
//   - Detectar huecos libres
//   - Crear eventos (con confirmación del usuario)
//   - Proveer contexto de agenda a otros agentes
//
// TODO: Sesión 7 — integrar Google Calendar API
// ============================================================

import type { AgentInput, AgentOutput } from "@/lib/types";

export const calendarAgent = {
  name: "calendar",
  description: "Gestiona el calendario de Google",

  async process(_input: AgentInput): Promise<AgentOutput> {
    // TODO: Sesión 7
    return {
      success: false,
      message: "Módulo de calendario en construcción — Sesión 7",
    };
  },

  async findFreeSlots(_userId: string, _date: Date, _durationMinutes: number): Promise<Date[]> {
    // TODO: Sesión 7 — consultar Google Calendar y encontrar huecos
    return [];
  },

  async createEvent(_userId: string, _title: string, _start: Date, _end: Date): Promise<string | null> {
    // TODO: Sesión 7 — crear evento en Google Calendar
    return null;
  },

  async getTodayEvents(_userId: string): Promise<Array<{ title: string; start: Date; end: Date }>> {
    // TODO: Sesión 7 — obtener eventos del día
    return [];
  },
};

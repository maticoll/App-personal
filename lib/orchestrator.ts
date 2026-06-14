// lib/orchestrator.ts
// Orquestrador central de WhatsApp — HERMES
//
// Flujo v2 (con memoria + voz natural):
//   1. Cargar contexto de conversación (rolling window + summary)
//   2. Claude Haiku clasifica el módulo (rápido, barato)
//   3. El agente especialista ejecuta la acción y retorna datos crudos
//   4. Claude Sonnet genera la respuesta final con voz natural y contexto
//   5. Guardar turno user + turno assistant en memoria
//
// Módulos disponibles:
//   sleep      — registro de sueño, Garmin, estadísticas
//   fitness    — gym, cardio, rutinas, Garmin
//   nutrition  — comidas, agua, dieta
//   projects   — proyectos personales, tareas, Notion
//   ideas      — captura y exploración de ideas
//   scoring    — score diario por módulo
//   calendar   — agenda, eventos, Google Calendar
//   finances   — gastos, ingresos, balance, transacciones
//   general    — ayuda, saludos, preguntas generales

import { sleepAgent } from "@/agents/sleep";
import { fitnessAgent } from "@/agents/fitness";
import { processNutritionMessage } from "@/agents/nutrition";
import { processProjectsMessage } from "@/agents/projects";
import { ideasAgent } from "@/agents/ideas";
import { scoringAgent } from "@/agents/scoring";
import { calendarAgent } from "@/agents/calendar";
import { financesAgent } from "@/agents/finances";
import { synthesisAgent } from "@/agents/synthesis";
import { vapesAgent, looksLikeVapeMessage } from "@/agents/vapes";
import { getGoals } from "@/lib/goals";
import { buildOrchestratorPrompt } from "@/agents/prompts";
import { db } from "@/lib/db";
import {
  getConversationContext,
  addTurn,
  formatContextForPrompt,
} from "@/lib/conversation";
import { getPending } from "@/lib/pending-transaction";
import { callClaude } from "@/lib/claude";

type Module =
  | "sleep"
  | "fitness"
  | "nutrition"
  | "projects"
  | "ideas"
  | "scoring"
  | "calendar"
  | "finances"
  | "synthesis"
  | "general";

const MODULE_DESCRIPTIONS: Record<Module, string> = {
  sleep:     "El usuario habla de dormir, despertar, horas de sueño, cansancio, Garmin o descanso",
  fitness:   "El usuario habla de gym, ejercicio, cardio, correr, nadar, entrenar, pasos, o rutinas (incluye pedir/traer una rutina por nombre como 'tráeme push A', o mandar la rutina que hizo con pesos y repeticiones para registrarla)",
  nutrition: "El usuario habla de comida, comer, agua, hidratacion, dieta, calorías o macros",
  projects:  "El usuario habla de proyectos, tareas, trabajo, Notion, pendientes o deadlines",
  ideas:     "El usuario quiere capturar, anotar o explorar una idea, pensamiento u ocurrencia",
  scoring:   "El usuario pregunta por su score, puntaje, rendimiento o estadísticas del día",
  calendar:  "El usuario habla de agenda, calendario, eventos, reuniones, quiere agendar algo, o pide un recordatorio (recordame, avisame, acordame)",
  finances:  "El usuario habla de dinero, gastos, ingresos, balance, plata, compras, pagos o finanzas",
  synthesis: "El usuario pide un análisis global, patrones entre módulos, recomendaciones generales o un resumen de su semana",
  general:   "Saludos, preguntas generales, ayuda, o mensajes que no encajan en otro módulo",
};

// -------------------------------------------------------
// classifyModule — Claude Haiku para clasificación rápida
// -------------------------------------------------------
async function classifyModule(text: string): Promise<Module> {
  const moduleList = (Object.entries(MODULE_DESCRIPTIONS) as [Module, string][])
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  const validModules = (Object.keys(MODULE_DESCRIPTIONS) as Module[]).join(", ");

  const result = await callClaude({
    model: "claude-haiku-4-5-20251001",
    maxTokens: 20,
    system:
      "Eres el clasificador de intenciones de HERMES, una app personal. " +
      "Tu tarea es leer un mensaje del usuario y responder SOLO con el nombre del módulo correcto. " +
      "Nunca expliques. Nunca respondas con más de una palabra.",
    messages: [
      {
        role: "user",
        content:
          "Módulos disponibles:\n" +
          moduleList +
          "\n\nMensaje del usuario: \"" + text + "\"\n\n" +
          "Responde SOLO con uno de estos: " + validModules,
      },
    ],
  });

  if (!result) return "general";

  const raw = result.toLowerCase();
  const valid = Object.keys(MODULE_DESCRIPTIONS) as Module[];
  const matched = valid.find((m) => raw === m || raw.startsWith(m));
  return matched ?? "general";
}

// -------------------------------------------------------
// callSpecialistAgent — ejecuta el agente correspondiente
// Retorna datos crudos (sin styling final) para que Claude los procese
// -------------------------------------------------------
type AgentResult = {
  text: string;
  /** Si es true, la respuesta se envía tal cual, sin pasar por Sonnet
   *  (para outputs con formato exacto, ej: "tráeme push A"). */
  verbatim: boolean;
};

async function callSpecialistAgent(
  module: Module,
  userId: string,
  text: string,
  conversationContext?: string
): Promise<AgentResult> {
  const input = { userId, message: text, timestamp: new Date(), context: conversationContext };

  const GENERAL_HELP =
    "HERMES puede ayudar con: sueño (registrar, Garmin), fitness (gym, cardio), " +
    "nutrición (comidas, agua), proyectos (tareas, Notion), ideas (captura), " +
    "finanzas (gastos, balance), agenda (Google Calendar) y score diario.";

  try {
    switch (module) {
      case "sleep": {
        const result = await sleepAgent.process(input);
        return { text: result.message, verbatim: false };
      }
      case "fitness": {
        const result = await fitnessAgent.process(input);
        const verbatim = !!(result.data as { verbatim?: boolean } | undefined)?.verbatim;
        return { text: result.message, verbatim };
      }
      case "nutrition": {
        return { text: await processNutritionMessage(userId, text), verbatim: false };
      }
      case "projects": {
        return { text: await processProjectsMessage(userId, text), verbatim: false };
      }
      case "ideas": {
        const result = await ideasAgent.process(input);
        const verbatim = !!(result.data as { verbatim?: boolean } | undefined)?.verbatim;
        return { text: result.message, verbatim };
      }
      case "scoring": {
        const result = await scoringAgent.process(input);
        return { text: result.message, verbatim: false };
      }
      case "calendar": {
        const result = await calendarAgent.process(input);
        return { text: result.message, verbatim: false };
      }
      case "finances": {
        const result = await financesAgent.process(input);
        return { text: result.message, verbatim: false };
      }
      case "synthesis": {
        return { text: await synthesisAgent.getSynthesisText(userId, 7), verbatim: false };
      }
      case "general":
      default:
        return { text: GENERAL_HELP, verbatim: false };
    }
  } catch (err) {
    console.error(`[orchestrator] Error en módulo ${module}:`, err);
    return { text: "Error obteniendo datos del módulo.", verbatim: false };
  }
}

// -------------------------------------------------------
// generateFinalResponse — Claude Sonnet con voz natural
// Toma los datos del agente + contexto y genera la respuesta final
// -------------------------------------------------------
async function generateFinalResponse(
  systemPrompt: string,
  conversationContext: string,
  userMessage: string,
  agentData: string
): Promise<string> {
  const contextSection = conversationContext
    ? `\n\n${conversationContext}\n\n---`
    : "";

  const nowUY = new Date().toLocaleString("es-UY", {
    timeZone: "America/Montevideo",
    hour: "2-digit",
    minute: "2-digit",
  });

  const userContent =
    `[Hora actual en Uruguay: ${nowUY}]\n\n` +
    `El usuario te envió: "${userMessage}"\n\n` +
    `El sistema procesó la solicitud y obtuvo estos datos:\n${agentData}\n\n` +
    `Generá una respuesta natural en español rioplatense. ` +
    `No repitas textualmente lo que dice el sistema — usá los datos para dar una respuesta que suene humana. ` +
    `Máximo 3-4 oraciones para respuestas simples. Para análisis pedidos explícitamente, podés extenderte. ` +
    `No uses asteriscos para negrita. No hagas listas a menos que sean imprescindibles.`;

  const result = await callClaude({
    model: "claude-sonnet-4-6",
    maxTokens: 350,
    system: systemPrompt + contextSection,
    messages: [{ role: "user", content: userContent }],
  });

  return result ?? agentData; // Fallback al dato crudo del agente
}

// -------------------------------------------------------
// orchestrate — Función principal
// -------------------------------------------------------
export async function orchestrate(userId: string, text: string): Promise<string> {
  console.log(`[orchestrator] userId=${userId} texto="${text}"`);

  // 0. Chequear transacción pendiente ANTES de clasificar módulo.
  //    Si hay un pending activo, el mensaje es una respuesta al flujo de
  //    confirmación de finanzas (selección de tarjeta o sí/no).
  //    Se bypasea Haiku + Sonnet y se responde directo.
  const pending = await getPending(userId).catch(() => null);
  if (pending) {
    console.log(`[orchestrator] Pending transaction encontrada (step: ${pending.step}) — desviando a financesAgent.handleConfirmation`);
    const response = await financesAgent.handleConfirmation(userId, text, pending);
    await Promise.all([
      addTurn(userId, "user", text).catch((err) =>
        console.error("[orchestrator] Error guardando turno user (pending):", err)
      ),
      addTurn(userId, "assistant", response).catch((err) =>
        console.error("[orchestrator] Error guardando turno assistant (pending):", err)
      ),
    ]);
    return response;
  }

  // 0.5. Fast-path de vapes (registro de ventas/compras de stock).
  //    Se ejecuta ANTES de clasificar con Haiku para no colisionar con el módulo
  //    de finanzas (que captura "compré" como gasto). El parseo es regex puro,
  //    sin IA. Si el agente determina que NO es un movimiento de vapes (notVapes),
  //    se cae al flujo normal de clasificación.
  if (looksLikeVapeMessage(text)) {
    const result = await vapesAgent.process({ userId, message: text, timestamp: new Date() });
    const notVapes = !!(result.data as { notVapes?: boolean } | undefined)?.notVapes;
    if (!notVapes) {
      const finalResponse = result.message;
      await Promise.all([
        addTurn(userId, "user", text).catch((err) =>
          console.error("[orchestrator] Error guardando turno user (vapes):", err)
        ),
        addTurn(userId, "assistant", finalResponse).catch((err) =>
          console.error("[orchestrator] Error guardando turno assistant (vapes):", err)
        ),
      ]);
      return finalResponse;
    }
  }

  // 1. Cargar contexto de conversación + objetivos + nombre del usuario en paralelo
  const [ctx, goals, userRecord] = await Promise.all([
    getConversationContext(userId),
    getGoals(userId).catch(() => null),
    db.user.findUnique({ where: { id: userId }, select: { name: true } }).catch(() => null),
  ]);

  // Primer nombre del usuario para los prompts (fallback a "vos")
  const userName = userRecord?.name?.split(" ")[0] ?? "vos";

  // 2. Guardar el turno del usuario en memoria (no bloqueante en paralelo con el resto)
  const saveUserTurn = addTurn(userId, "user", text).catch((err) =>
    console.error("[orchestrator] Error guardando turno user:", err)
  );

  // 3. Clasificar módulo (Haiku, rápido)
  const module = await classifyModule(text);
  console.log(`[orchestrator] Módulo detectado: ${module}`);

  // Formatear contexto una vez — se usa tanto en el agente como en Sonnet
  const conversationContext = formatContextForPrompt(ctx);

  // 4. Ejecutar agente especialista (pasa contexto para módulos que lo necesitan)
  const agent = await callSpecialistAgent(module, userId, text, conversationContext);

  // 5. Generar respuesta natural con Claude Sonnet (si hay goals cargados).
  //    Si el agente marcó la respuesta como verbatim (ej: "tráeme push A" con
  //    formato exacto de pesos), se envía tal cual sin reescribir.
  let finalResponse: string;

  if (agent.verbatim) {
    finalResponse = agent.text;
  } else if (goals) {
    const systemPrompt = buildOrchestratorPrompt(goals, ctx.summary ?? undefined, userName);

    finalResponse = await generateFinalResponse(
      systemPrompt,
      conversationContext,
      text,
      agent.text
    );
  } else {
    finalResponse = agent.text;
  }

  // 6. Guardar respuesta del asistente en memoria
  await Promise.all([
    saveUserTurn,
    addTurn(userId, "assistant", finalResponse).catch((err) =>
      console.error("[orchestrator] Error guardando turno assistant:", err)
    ),
  ]);

  return finalResponse;
}

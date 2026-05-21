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
import { processIdeasMessage } from "@/agents/ideas";
import { scoringAgent } from "@/agents/scoring";
import { calendarAgent } from "@/agents/calendar";
import { financesAgent } from "@/agents/finances";
import { synthesisAgent } from "@/agents/synthesis";
import { getGoals } from "@/lib/goals";
import { buildOrchestratorPrompt } from "@/agents/prompts";
import {
  getConversationContext,
  addTurn,
  formatContextForPrompt,
} from "@/lib/conversation";
import { getPending } from "@/lib/pending-transaction";

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
  fitness:   "El usuario habla de gym, ejercicio, cardio, correr, nadar, entrenar, rutinas o Garmin",
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
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[orchestrator] ANTHROPIC_API_KEY no configurada — usando fallback 'general'");
    return "general";
  }

  const moduleList = (Object.entries(MODULE_DESCRIPTIONS) as [Module, string][])
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  const validModules = (Object.keys(MODULE_DESCRIPTIONS) as Module[]).join(", ");

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 20,
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
      }),
    });

    if (!res.ok) {
      console.error("[orchestrator] Error llamando a Claude:", res.status, await res.text());
      return "general";
    }

    const data = (await res.json()) as {
      content: Array<{ type: string; text: string }>;
    };
    const raw = data.content?.[0]?.text?.trim().toLowerCase() ?? "";
    const valid = Object.keys(MODULE_DESCRIPTIONS) as Module[];
    const matched = valid.find((m) => raw === m || raw.startsWith(m));
    return matched ?? "general";
  } catch (err) {
    console.error("[orchestrator] Error en classifyModule:", err);
    return "general";
  }
}

// -------------------------------------------------------
// callSpecialistAgent — ejecuta el agente correspondiente
// Retorna datos crudos (sin styling final) para que Claude los procese
// -------------------------------------------------------
async function callSpecialistAgent(
  module: Module,
  userId: string,
  text: string,
  conversationContext?: string
): Promise<string> {
  const input = { userId, message: text, timestamp: new Date(), context: conversationContext };

  const GENERAL_HELP =
    "HERMES puede ayudar con: sueño (registrar, Garmin), fitness (gym, cardio), " +
    "nutrición (comidas, agua), proyectos (tareas, Notion), ideas (captura), " +
    "finanzas (gastos, balance), agenda (Google Calendar) y score diario.";

  try {
    switch (module) {
      case "sleep": {
        const result = await sleepAgent.process(input);
        return result.message;
      }
      case "fitness": {
        const result = await fitnessAgent.process(input);
        return result.message;
      }
      case "nutrition": {
        return await processNutritionMessage(userId, text);
      }
      case "projects": {
        return await processProjectsMessage(userId, text);
      }
      case "ideas": {
        return await processIdeasMessage(userId, text);
      }
      case "scoring": {
        const result = await scoringAgent.process(input);
        return result.message;
      }
      case "calendar": {
        const result = await calendarAgent.process(input);
        return result.message;
      }
      case "finances": {
        const result = await financesAgent.process(input);
        return result.message;
      }
      case "synthesis": {
        return await synthesisAgent.getSynthesisText(userId, 7);
      }
      case "general":
      default:
        return GENERAL_HELP;
    }
  } catch (err) {
    console.error(`[orchestrator] Error en módulo ${module}:`, err);
    return "Error obteniendo datos del módulo.";
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
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return agentData; // Fallback: devolver datos crudos del agente

  // Si el módulo es 'general' y el mensaje es un saludo simple, responder directo
  const simpleGreeting = /^(hola|buenas|hey|hi|buen[ao]s (días|tardes|noches))$/i.test(
    userMessage.trim()
  );
  if (simpleGreeting) {
    // Para saludos, generar respuesta breve personalizada
  }

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

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 350,
        system: systemPrompt + contextSection,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!res.ok) {
      console.error("[orchestrator] Error en generateFinalResponse:", res.status);
      return agentData; // Fallback
    }

    const data = (await res.json()) as {
      content: Array<{ type: string; text: string }>;
    };
    return data.content?.[0]?.text?.trim() ?? agentData;
  } catch (err) {
    console.error("[orchestrator] Error en generateFinalResponse:", err);
    return agentData; // Fallback al dato crudo
  }
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

  // 1. Cargar contexto de conversación + objetivos del usuario en paralelo
  const [ctx, goals] = await Promise.all([
    getConversationContext(userId),
    getGoals(userId).catch(() => null),
  ]);

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
  const agentData = await callSpecialistAgent(module, userId, text, conversationContext);

  // 5. Generar respuesta natural con Claude Sonnet (si hay goals cargados)
  let finalResponse: string;

  if (goals) {
    const systemPrompt = buildOrchestratorPrompt(goals, ctx.summary ?? undefined);

    finalResponse = await generateFinalResponse(
      systemPrompt,
      conversationContext,
      text,
      agentData
    );
  } else {
    finalResponse = agentData;
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

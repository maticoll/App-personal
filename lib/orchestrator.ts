// lib/orchestrator.ts
// Orquestrador central de WhatsApp — HERMES
//
// Flujo:
//   1. Claude Haiku clasifica el mensaje en un módulo
//   2. El módulo correspondiente procesa el mensaje y devuelve respuesta
//   3. La respuesta se envía de vuelta al usuario vía WhatsApp
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

type Module =
  | "sleep"
  | "fitness"
  | "nutrition"
  | "projects"
  | "ideas"
  | "scoring"
  | "calendar"
  | "finances"
  | "general";

const MODULE_DESCRIPTIONS: Record<Module, string> = {
  sleep:     "El usuario habla de dormir, despertar, horas de sueño, cansancio, Garmin o descanso",
  fitness:   "El usuario habla de gym, ejercicio, cardio, correr, nadar, entrenar, rutinas o Garmin",
  nutrition: "El usuario habla de comida, comer, agua, hidratacion, dieta, calorías o macros",
  projects:  "El usuario habla de proyectos, tareas, trabajo, Notion, pendientes o deadlines",
  ideas:     "El usuario quiere capturar, anotar o explorar una idea, pensamiento u ocurrencia",
  scoring:   "El usuario pregunta por su score, puntaje, rendimiento o estadísticas del día",
  calendar:  "El usuario habla de agenda, calendario, eventos, reuniones, o quiere agendar algo",
  finances:  "El usuario habla de dinero, gastos, ingresos, balance, plata, compras, pagos o finanzas",
  general:   "Saludos, preguntas generales, ayuda, o mensajes que no encajan en otro módulo",
};

const GENERAL_HELP =
  "Hola! Soy HERMES, tu asistente personal. Puedo ayudarte con:\n\n" +
  "😴 *Sueño* — registrar que te fuiste a dormir o que te despertaste\n" +
  "💪 *Fitness* — anotar gym, cardio, rutinas\n" +
  "🥗 *Nutrición* — registrar comidas, agua y dieta\n" +
  "📋 *Proyectos* — gestionar tus proyectos y tareas\n" +
  "💡 *Ideas* — capturar una idea al vuelo\n" +
  "📊 *Score* — ver tu puntaje del día\n\n" +
  "Escribime lo que necesitás!";

// -------------------------------------------------------
// classifyModule
// Llama a Claude Haiku con contexto rico para clasificar el módulo
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
// orchestrate
// Función principal — recibe userId + texto y devuelve respuesta
// -------------------------------------------------------
export async function orchestrate(userId: string, text: string): Promise<string> {
  console.log(`[orchestrator] userId=${userId} texto="${text}"`);

  const module = await classifyModule(text);
  console.log(`[orchestrator] Módulo detectado: ${module}`);

  const input = { userId, message: text, timestamp: new Date() };

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
      case "general":
      default:
        return GENERAL_HELP;
    }
  } catch (err) {
    console.error(`[orchestrator] Error en módulo ${module}:`, err);
    return "Ocurrio un error procesando tu mensaje. Intenta de nuevo en un momento.";
  }
}

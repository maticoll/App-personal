// lib/orchestrator.ts
// Orquestrador central de WhatsApp
// Paso 1: Claude Haiku detecta el modulo
// Paso 2: deriva al agente correcto y devuelve string de respuesta

import { sleepAgent } from "@/agents/sleep";
import { fitnessAgent } from "@/agents/fitness";
import { processNutritionMessage } from "@/agents/nutrition";
import { processProjectsMessage } from "@/agents/projects";
import { processIdeasMessage } from "@/agents/ideas";
import { scoringAgent } from "@/agents/scoring";

// Modulos validos que Claude puede devolver
type Module = "sleep" | "fitness" | "nutrition" | "projects" | "ideas" | "scoring" | "general";

const GENERAL_HELP =
  "Hola! Puedo ayudarte con: " +
  "sueno 😴, fitness 💪, nutricion 🥗, proyectos 📋, ideas 💡 o tu score 📊. " +
  "Que necesitas?";

// -------------------------------------------------------
// classifyModule
// Llama a Claude Haiku para detectar el modulo del mensaje
// -------------------------------------------------------
async function classifyModule(text: string): Promise<Module> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[orchestrator] ANTHROPIC_API_KEY no configurada — usando fallback 'general'");
    return "general";
  }

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
        messages: [
          {
            role: "user",
            content:
              "Clasifica este mensaje en uno de estos modulos: " +
              "sleep, fitness, nutrition, projects, ideas, scoring, general. " +
              "Mensaje: '" + text + "' " +
              "Responde SOLO con el nombre del modulo.",
          },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[orchestrator] Error llamando a Claude: " + res.status + " " + err);
      return "general";
    }

    const data = await res.json() as { content: Array<{ type: string; text: string }> };
    const raw = data.content?.[0]?.text?.trim().toLowerCase() ?? "";
    const valid: Module[] = ["sleep", "fitness", "nutrition", "projects", "ideas", "scoring", "general"];
    const matched = valid.find((m) => raw.startsWith(m));
    return matched ?? "general";
  } catch (err) {
    console.error("[orchestrator] Error en classifyModule:", err);
    return "general";
  }
}

// -------------------------------------------------------
// orchestrate
// Funcion principal — recibe userId + texto y devuelve respuesta
// -------------------------------------------------------
export async function orchestrate(
  userId: string,
  text: string,
): Promise<string> {
  console.log("[orchestrator] Procesando para userId=" + userId + " texto='" + text + "'");

  const module = await classifyModule(text);
  console.log("[orchestrator] Modulo detectado: " + module);

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
      case "general":
      default:
        return GENERAL_HELP;
    }
  } catch (err) {
    console.error("[orchestrator] Error derivando a modulo " + module + ":", err);
    return "Ocurrio un error procesando tu mensaje. Intenta de nuevo en un momento.";
  }
}

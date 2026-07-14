// ============================================================
// Agente de Nutricion
// Sesion 5 — implementacion completa
//
// Responsabilidades:
//   - Registrar comidas en lenguaje natural (NLP via Claude)
//   - Registrar hidratacion (termos de agua)
//   - Consultar resumen nutricional del dia
//   - Actualizar dieta del usuario
//
// Flujo:
//   Input → detectIntentAI → accion → respuesta en texto plano
//
// Intenciones soportadas:
//   meal_log    — "almorce pollo con arroz", "comi una naranja"
//   water_log   — "tome un termo de agua", "bebi agua"
//   query       — "que comi hoy", "cuanta agua tome"
//   diet_update — "mi dieta es cetogenica", "cambia mi dieta"
// ============================================================

import type { AgentInput, AgentOutput } from "@/lib/types";
import { detectIntentAI } from "@/lib/nlp";
import { getGoals } from "@/lib/goals";
import { buildNutritionPrompt } from "@/agents/prompts";
import {
  logMealNLP,
  logWater,
  getTodayNutritionSummary,
  updateUserDiet,
  getNutritionSummaryText,
  getWaterReminderText,
} from "@/lib/nutrition";
import { currentHourUY } from "@/lib/dates";
import type { MealType } from "@prisma/client";

// --- Normalización (sin acentos, minúsculas) ---

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .split("")
    .filter((c) => {
      const code = c.charCodeAt(0);
      return code < 0x0300 || code > 0x036f;
    })
    .join("");
}

// --- Helpers de detección ---

function detectMealType(text: string): MealType {
  const n = normalize(text);
  if (/desayune|desayuno/.test(n)) return "BREAKFAST";
  if (/almorce|almuerzo/.test(n)) return "LUNCH";
  if (/cene|cena/.test(n)) return "DINNER";
  if (/snack|merienda|colacion/.test(n)) return "SNACK";
  // Hora UY, no del server (UTC): con getHours() el desayuno de las 9:00 UY
  // se clasificaba como almuerzo.
  const hour = currentHourUY();
  if (hour < 11) return "BREAKFAST";
  if (hour < 16) return "LUNCH";
  if (hour < 20) return "SNACK";
  return "DINNER";
}

function detectThermoAmount(text: string): number {
  const n = normalize(text);
  if (/medio termo/.test(n)) return 0.5;
  const match = n.match(/(\d+(?:[.,]\d+)?)\s*termos?/);
  if (match) {
    const parsed = parseFloat(match[1].replace(",", "."));
    return isNaN(parsed) ? 1 : Math.min(parsed, 5);
  }
  return 1;
}

function extractMealDescription(text: string): string {
  const n = normalize(text);
  const m = n.match(/^(hoy )?(desayune|almorce|cene|comi|me comi|merende)\s*/);
  return m ? text.slice(m[0].length).trim() || text.trim() : text.trim();
}

function extractDietContent(text: string): string {
  const n = normalize(text);
  const m = n.match(
    /^.*(mi dieta (es|tiene|incluye)|cambia mi dieta|nueva dieta)\s*/,
  );
  return m ? text.slice(m[0].length).trim() : text.trim();
}

// --- Función principal ---

export async function processNutritionMessage(
  userId: string,
  text: string,
): Promise<string> {
  const goals = await getGoals(userId).catch(() => null);
  const systemPrompt = goals ? buildNutritionPrompt(goals) : undefined;
  const intent = await detectIntentAI(
    "Eres el agente de nutricion de una app personal. El usuario registra lo que come y toma, consulta su resumen nutricional, o actualiza su dieta.",
    {
      meal_log:
        "El usuario registro o menciono que comio algo: desayuno, almuerzo, cena, snack, una fruta, etc.",
      water_log:
        "El usuario bebio agua, un termo de agua, o menciona hidratacion",
      query:
        "El usuario pregunta por lo que comio, cuanta agua tomo, o quiere ver su resumen nutricional",
      diet_update:
        "El usuario quiere cambiar o indicar cual es su dieta (cetogenica, vegana, sin gluten, etc.)",
      unknown: "Otro mensaje no relacionado a nutricion",
    },
    text,
    systemPrompt,
  );

  try {
    if (intent === "meal_log") {
      const mealType = detectMealType(text);
      const description = extractMealDescription(text);
      if (description.length < 3)
        return "Que comiste exactamente? Contame con mas detalle.";
      const meal = await logMealNLP(userId, description, mealType);
      const labels: Record<MealType, string> = {
        BREAKFAST: "Desayuno",
        LUNCH: "Almuerzo",
        DINNER: "Cena",
        SNACK: "Snack",
        OTHER: "Comida",
      };
      let response = `Registrado: ${labels[mealType]} - ${meal.description}`;
      if (meal.calories !== null) {
        response += `\n~${Math.round(meal.calories)} kcal | P: ${meal.proteinG}g | C: ${meal.carbsG}g | G: ${meal.fatG}g`;
      }
      if (meal.dietAlignmentScore !== null) {
        const align =
          meal.dietAlignmentScore >= 70
            ? "Alineado con tu dieta"
            : meal.dietAlignmentScore >= 40
              ? "Parcialmente alineado"
              : "Fuera de tu dieta";
        response += `\n${align} (${meal.dietAlignmentScore}%)`;
      }
      return response;
    }

    if (intent === "water_log") {
      const thermos = detectThermoAmount(text);
      const result = await logWater(userId, thermos);
      const ok = result.totalThermos >= result.goal;
      return (
        `+${thermos} termo${thermos !== 1 ? "s" : ""} registrado. ` +
        `Llevas ${result.totalThermos.toFixed(1)}/${result.goal.toFixed(1)} termos hoy.` +
        (ok ? " Meta cumplida!" : "")
      );
    }

    if (intent === "query") {
      const s = await getTodayNutritionSummary(userId);
      const labels: Record<MealType, string> = {
        BREAKFAST: "Desayuno",
        LUNCH: "Almuerzo",
        DINNER: "Cena",
        SNACK: "Snack",
        OTHER: "Otra",
      };
      const lines = ["Resumen nutricional de hoy:"];
      if (s.meals.length === 0) lines.push("Sin comidas registradas.");
      else
        s.meals.forEach((m) =>
          lines.push(`${labels[m.mealType]}: ${m.description}`),
        );
      if (s.totalCalories !== null)
        lines.push(`Total: ~${Math.round(s.totalCalories)} kcal`);
      lines.push(
        `Agua: ${s.totalWaterThermos.toFixed(1)}/${s.waterGoalThermos.toFixed(1)} termos`,
      );
      return lines.join("\n");
    }

    if (intent === "diet_update") {
      const dietContent = extractDietContent(text);
      if (dietContent.length < 10)
        return "Contame mas sobre tu dieta para poder guardarla.";
      await updateUserDiet(userId, dietContent);
      return "Dieta actualizada. La voy a usar como referencia para evaluar tus comidas.";
    }

    return "No entendi. Podes registrar una comida, agua, o preguntarme como vas con la nutricion.";
  } catch (err) {
    console.error("[nutritionAgent] Error:", err);
    return "Hubo un error procesando tu mensaje. Intenta de nuevo.";
  }
}

export { getNutritionSummaryText, getWaterReminderText };

export const nutritionAgent = {
  name: "nutrition",
  description: "Registra y analiza nutricion e hidratacion",

  async onGoalsUpdate(
    _userId: string,
    _goals: import("@prisma/client").UserGoals,
  ): Promise<{ ok: boolean }> {
    return { ok: true };
  },

  async process(input: AgentInput): Promise<AgentOutput> {
    if (!input.userId || !input.message) {
      return { success: false, message: "userId y message son requeridos" };
    }
    const message = await processNutritionMessage(input.userId, input.message);
    return { success: true, message };
  },
  async calculateMacros(
    _d: string,
    _u: string,
  ): Promise<Record<string, number>> {
    return {};
  },
  async calculateScore(_u: string, _date: Date): Promise<number> {
    return 0;
  },
};

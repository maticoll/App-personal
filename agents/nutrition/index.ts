// ============================================================
// Agente de Nutricion
// Sesion 5 - implementacion completa
// ============================================================

import type { AgentInput, AgentOutput } from "@/lib/types";
import { detectIntentAI } from "@/lib/nlp";
import {
  logMealNLP,
  logWater,
  getTodayNutritionSummary,
  updateUserDiet,
  getNutritionSummaryText,
  getWaterReminderText,
} from "@/lib/nutrition";
import type { MealType } from "@prisma/client";

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

function detectMealType(text: string): MealType {
  const n = normalize(text);
  if (/desayune|desayuno/.test(n)) return "BREAKFAST";
  if (/almorce|almuerzo/.test(n)) return "LUNCH";
  if (/cene|cena/.test(n)) return "DINNER";
  if (/snack|merienda|colacion/.test(n)) return "SNACK";
  const hour = new Date().getHours();
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

type NutritionIntent = "meal_log" | "water_log" | "query" | "diet_update" | "unknown";

function detectIntent(text: string): NutritionIntent {
  const n = normalize(text);
  if (/\btermos?\b/.test(n) || /\bagua\b/.test(n) || /\bbebi\b/.test(n)) return "water_log";
  if (/mi dieta (es|tiene|incluye)|cambia mi dieta|nueva dieta/.test(n)) return "diet_update";
  if (/que comi|cuanta agua|cuantos termos|resumen nutri/.test(n)) return "query";
  if (/desayune|almorce|cene|comi|me comi|merende|desayuno|almuerzo|cena|snack/.test(n)) return "meal_log";
  return "unknown";
}

function extractMealDescription(text: string): string {
  const n = normalize(text);
  const m = n.match(/^(hoy )?(desayune|almorce|cene|comi|me comi|merende)\s*/);
  return m ? text.slice(m[0].length).trim() || text.trim() : text.trim();
}

export async function processNutritionMessage(userId: string, text: string): Promise<string> {
  const intent = await detectNutritionIntent(text);
  try {
    if (intent === "meal_log") {
      const mealType = detectMealType(text);
      const description = extractMealDescription(text);
      if (description.length < 3) return "Que comiste exactamente? Contame con mas detalle.";
      const meal = await logMealNLP(userId, description, mealType);
      const labels: Record<MealType, string> = { BREAKFAST: "Desayuno", LUNCH: "Almuerzo", DINNER: "Cena", SNACK: "Snack", OTHER: "Comida" };
      let response = `Registrado: ${labels[mealType]} - ${meal.description}`;
      if (meal.calories !== null) response += `\n~${Math.round(meal.calories)} kcal | P: ${meal.proteinG}g | C: ${meal.carbsG}g | G: ${meal.fatG}g`;
      if (meal.dietAlignmentScore !== null) {
        const align = meal.dietAlignmentScore >= 70 ? "Alineado" : meal.dietAlignmentScore >= 40 ? "Parcial" : "Fuera de dieta";
        response += `\n${align} (${meal.dietAlignmentScore}%)`;
      }
      return response;
    }
    if (intent === "water_log") {
      const thermos = detectThermoAmount(text);
      const result = await logWater(userId, thermos);
      const ok = result.totalThermos >= result.goal;
      return `+${thermos} termo${thermos !== 1 ? "s" : ""} registrado. Llevas ${result.totalThermos.toFixed(1)}/${result.goal.toFixed(1)} termos hoy.${ok ? " Meta cumplida!" : ""}`;
    }
    if (intent === "query") {
      const s = await getTodayNutritionSummary(userId);
      const labels: Record<MealType, string> = { BREAKFAST: "Desayuno", LUNCH: "Almuerzo", DINNER: "Cena", SNACK: "Snack", OTHER: "Otra" };
      const lines = ["Resumen nutricional de hoy:"];
      if (s.meals.length === 0) lines.push("Sin comidas registradas.");
      else s.meals.forEach(m => lines.push(`${labels[m.mealType]}: ${m.description}`));
      if (s.totalCalories !== null) lines.push(`Total: ~${Math.round(s.totalCalories)} kcal`);
      lines.push(`Agua: ${s.totalWaterThermos.toFixed(1)}/${s.waterGoalThermos.toFixed(1)} termos`);
      return lines.join("\n");
    }
    if (intent === "diet_update") {
      const n = normalize(text);
      const m = n.match(/^.*(mi dieta (es|tiene|incluye)|cambia mi dieta|nueva dieta)\s*/);
      const dietContent = m ? text.slice(m[0].length).trim() : text.trim();
      if (dietContent.length < 10) return "Contame mas sobre tu dieta para poder guardarla.";
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
  async process(input: AgentInput): Promise<AgentOutput> {
    if (!input.userId || !input.message) return { success: false, message: "userId y text son requeridos" };
    const message = await processNutritionMessage(input.userId, input.message);
    return { success: true, message };
  },
  async calculateMacros(_d: string, _u: string): Promise<Record<string, number>> { return {}; },
  async calculateScore(_u: string, _date: Date): Promise<number> { return 0; },
};

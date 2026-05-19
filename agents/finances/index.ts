// ============================================================
// agents/finances/index.ts — Agente de Finanzas (HERMES)
//
// Integra con finanzas-lemon.vercel.app vía API REST + Bearer token.
//
// Flujo de creación de transacciones:
//   1. NLP con Claude Haiku → ExtractedTransaction
//   2. Fetch tarjetas + categorías en paralelo
//   3. Fuzzy match de tarjeta y categoría
//   4. Si tarjeta encontrada  → step "confirm"   → guardar pending → pedir confirmación
//      Si tarjeta NO encontrada → step "select_card" → listar tarjetas → el usuario elige
//   5. handleConfirmation() resuelve la respuesta del usuario:
//      - En "select_card": asigna la tarjeta elegida → pasa a "confirm"
//      - En "confirm": si dice sí → crea transacción → limpia pending
//                      si dice no → limpia pending → cancela
//
// El orquestrador (HERMES) llama a getPending() ANTES de clasificar
// el módulo, y si hay un pendiente lo desvía acá directamente.
// ============================================================

import type { AgentInput, AgentOutput } from "@/lib/types";
import { getGoals } from "@/lib/goals";
import { buildFinancesPrompt } from "@/agents/prompts";
import {
  getMonthlyReport,
  getRecentTransactions,
  getFinancesSummaryText,
  getCards,
  getCategories,
  createTransaction,
  formatCurrency,
  type FinancesTransaction,
  type FinancesCard,
  type FinancesCategory,
} from "@/lib/finances";
import {
  savePending,
  clearPending,
  type PendingRecord,
  type PendingTransactionData,
} from "@/lib/pending-transaction";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type FinancesIntent =
  | "query_spending"   // ¿cuánto gasté? / ¿en qué gasté?
  | "query_balance"    // ¿cuál es mi balance? / ¿cómo voy?
  | "query_report"     // resumen general / reporte del mes
  | "create_expense"   // gasté / pagué / compré
  | "create_income"    // cobré / recibí / ingresé
  | "unknown";

type ExtractedTransaction = {
  type: "gasto" | "ingreso";
  amount: number;
  currency: "UYU" | "USD";
  categoryHint: string;
  cardHint: string;
  description: string;
  date: string | null;
  confidence: "high" | "low";
};

// ─── Detección de intención ───────────────────────────────────────────────────

function detectIntent(text: string): FinancesIntent {
  const t = text.toLowerCase();

  if (/cuánto gasté|cuanto gaste|cuanto llevo gastado|en qué gasté|en que gaste|gastos del mes/i.test(t))
    return "query_spending";

  if (/balance|saldo|cuánto tengo|cuanto tengo|cómo voy|como voy financieramente/i.test(t))
    return "query_balance";

  if (/resumen|reporte|informe|finanzas del mes|últimas transacciones|ultimas transacciones/i.test(t))
    return "query_report";

  if (/gasté|gaste|pagué|pague|compré|compre|salió|salio|desembolsé|desembolse/i.test(t))
    return "create_expense";

  if (/cobré|cobre|recibí|recibi|ingresé|ingrese|deposité|deposite|me pagaron/i.test(t))
    return "create_income";

  return "unknown";
}

// ─── NLP: Extracción de transacción con Claude Haiku ─────────────────────────

async function extractTransaction(
  text: string,
  type: "gasto" | "ingreso",
  categoryNames: { gasto: string[]; ingreso: string[] }
): Promise<ExtractedTransaction | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const today = new Date().toISOString().split("T")[0];
  const catList = type === "gasto"
    ? categoryNames.gasto.join(", ")
    : categoryNames.ingreso.join(", ");

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
        max_tokens: 150,
        messages: [
          {
            role: "user",
            content:
              `Hoy es ${today}. Extraé la información de esta transacción financiera en Uruguay.\n` +
              `Categorías disponibles para ${type}: ${catList || "sin categorías"}\n\n` +
              `Respondé SOLO con JSON (sin texto extra):\n` +
              `{"type":"${type}","amount":NUMBER,"currency":"UYU"|"USD","categoryHint":"STRING","cardHint":"STRING","description":"STRING","date":"YYYY-MM-DD"|null,"confidence":"high"|"low"}\n\n` +
              `Reglas:\n` +
              `- Moneda por defecto: UYU\n` +
              `- cardHint vacío ("") si no se menciona tarjeta\n` +
              `- categoryHint: usá EXACTAMENTE un nombre de la lista si coincide\n` +
              `- description: descripción breve (máx 40 chars)\n` +
              `- date: null si no se menciona fecha\n\n` +
              `Texto: "${text}"`,
          },
        ],
      }),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      content: Array<{ type: string; text: string }>;
    };
    const raw = data.content?.[0]?.text?.trim() ?? "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as ExtractedTransaction;
    if (!parsed.amount || !parsed.description) return null;

    return {
      ...parsed,
      amount: Math.abs(parsed.amount),
      currency: parsed.currency ?? "UYU",
      date: parsed.date ?? null,
    };
  } catch {
    return null;
  }
}

// ─── Fuzzy matching ───────────────────────────────────────────────────────────

function fuzzyMatchCard(hint: string, cards: FinancesCard[]): FinancesCard | null {
  if (!hint || cards.length === 0) return null;
  const lower = hint.toLowerCase();
  return (
    cards.find((c) => c.name.toLowerCase().includes(lower)) ??
    cards.find((c) => lower.includes(c.name.toLowerCase().split(" ")[0])) ??
    null
  );
}

function fuzzyMatchCategory(
  hint: string,
  categories: FinancesCategory[]
): FinancesCategory | null {
  if (categories.length === 0) return null;
  if (!hint) return categories.find((c) => c.name === "Otros") ?? categories[0];

  const lower = hint.toLowerCase();
  return (
    categories.find((c) => c.name.toLowerCase() === lower) ??
    categories.find((c) => c.name.toLowerCase().includes(lower)) ??
    categories.find((c) => lower.includes(c.name.toLowerCase())) ??
    categories.find((c) => c.name === "Otros") ??
    categories[0]
  );
}

// ─── Formateo ─────────────────────────────────────────────────────────────────

function formatTransactionList(transactions: FinancesTransaction[]): string {
  if (transactions.length === 0) return "No hay transacciones recientes.";
  return transactions
    .slice(0, 5)
    .map((t) => {
      const sign = t.type === "gasto" ? "-" : "+";
      const amount = formatCurrency(t.amount);
      const desc = t.description.substring(0, 30);
      const dateShort = t.date?.substring(5) ?? "";
      return `${sign}${amount} ${desc} (${dateShort})`;
    })
    .join("\n");
}

function formatDateReadable(dateStr: string): string {
  try {
    return new Date(dateStr + "T12:00:00").toLocaleDateString("es-UY", {
      day: "numeric",
      month: "long",
    });
  } catch {
    return dateStr;
  }
}

function buildConfirmMessage(data: PendingTransactionData): string {
  const emoji = data.type === "gasto" ? "📤" : "📥";
  const label = data.type === "gasto" ? "Gasto" : "Ingreso";
  const currencyLabel = data.currency !== "UYU" ? ` ${data.currency}` : "";
  const dateFormatted = formatDateReadable(data.date);

  return (
    `${emoji} ${label}: ${formatCurrency(data.amount)}${currencyLabel}\n` +
    `Fecha: ${dateFormatted}\n` +
    `Categoría: ${data.categoryName ?? "Sin categoría"}\n` +
    `Tarjeta: ${data.cardName ?? data.cardId}\n` +
    `Descripción: ${data.description}\n\n` +
    `¿Confirmo este registro? (sí / no)`
  );
}

// ─── Handler: iniciar creación de transacción ─────────────────────────────────

async function handleCreateTransaction(
  userId: string,
  text: string,
  type: "gasto" | "ingreso"
): Promise<string> {
  // 1. Tarjetas + categorías en paralelo
  const [cards, categories] = await Promise.all([
    getCards(userId),
    getCategories(userId, type),
  ]);

  if (cards.length === 0) {
    return "No encontré tarjetas configuradas en tu app de finanzas. Verificá que tenés al menos una tarjeta activa.";
  }

  // 2. Extraer transacción con NLP
  const categoryNames = {
    gasto:   categories.filter((c) => c.type === "gasto").map((c) => c.name),
    ingreso: categories.filter((c) => c.type === "ingreso").map((c) => c.name),
  };

  const extracted = await extractTransaction(text, type, categoryNames);
  if (!extracted) {
    const example =
      type === "gasto"
        ? "gaste $500 en supermercado con Itau"
        : "recibi $50000 de sueldo";
    return (
      `No pude entender el ${type}. Podes repetirlo con el monto y la descripcion?\n` +
      `Ejemplo: "${example}"`
    );
  }

  // 3. Fuzzy match de categoria
  const matchedCategory = fuzzyMatchCategory(extracted.categoryHint, categories);

  // 4. Fuzzy match de tarjeta
  const matchedCard = fuzzyMatchCard(extracted.cardHint, cards);

  const dateStr = extracted.date ?? new Date().toISOString().split("T")[0];

  if (matchedCard) {
    // Tarjeta encontrada -> step "confirm"
    const pending: PendingTransactionData = {
      amount: extracted.amount,
      type,
      currency: extracted.currency,
      description: extracted.description,
      date: dateStr,
      cardId:       matchedCard.id,
      cardName:     matchedCard.name,
      categoryId:   matchedCategory?.id,
      categoryName: matchedCategory?.name,
    };

    await savePending(userId, pending, "confirm");
    return buildConfirmMessage(pending);
  } else {
    // Tarjeta no encontrada -> step "select_card"
    const pending: PendingTransactionData = {
      amount: extracted.amount,
      type,
      currency: extracted.currency,
      description: extracted.description,
      date: dateStr,
      cardId:       "",
      categoryId:   matchedCategory?.id,
      categoryName: matchedCategory?.name,
    };

    await savePending(userId, pending, "select_card", cards);

    const emoji = type === "gasto" ? "📤" : "📥";
    const cardList = cards.map((c, i) => `${i + 1}. ${c.name}`).join("\n");
    return (
      `${emoji} Entendido: ${formatCurrency(extracted.amount)} en ${extracted.description}.\n` +
      `Con que tarjeta?\n\n${cardList}`
    );
  }
}

// ─── Handler: confirmacion de transaccion pendiente ───────────────────────────

export async function handleConfirmation(
  userId: string,
  text: string,
  pending: PendingRecord
): Promise<string> {
  const lower = text.trim().toLowerCase();

  // Cancelar (en cualquier step)
  if (/^(no|cancelar|nope|cancela|dale no|para|stop)$/i.test(lower)) {
    await clearPending(userId);
    return "Ok, cancelado. No se registro nada.";
  }

  // Step: seleccionar tarjeta
  if (pending.step === "select_card") {
    const cards = pending.cards ?? [];
    let selectedCard: FinancesCard | null = null;

    const num = parseInt(lower, 10);
    if (!isNaN(num) && num >= 1 && num <= cards.length) {
      selectedCard = cards[num - 1];
    } else {
      selectedCard = fuzzyMatchCard(lower, cards);
    }

    if (!selectedCard) {
      const cardList = cards.map((c, i) => `${i + 1}. ${c.name}`).join("\n");
      return `No entendi. Responde con el numero de la tarjeta:\n\n${cardList}`;
    }

    const updated: PendingTransactionData = {
      ...pending.data,
      cardId:   selectedCard.id,
      cardName: selectedCard.name,
    };

    await savePending(userId, updated, "confirm");
    return buildConfirmMessage(updated);
  }

  // Step: confirmar
  if (/^(si|sí|dale|confirmar|confirmo|ok|va|listo|bueno|perfecto|yes|yep|claro|obvio)$/i.test(lower)) {
    const { data } = pending;

    if (!data.cardId) {
      await clearPending(userId);
      return "Hubo un problema con la tarjeta. Intenta registrarlo de nuevo.";
    }

    const result = await createTransaction(userId, {
      cardId:      data.cardId,
      amount:      data.amount,
      type:        data.type,
      description: data.description,
      date:        data.date,
      categoryId:  data.categoryId,
    });

    await clearPending(userId);

    if (!result) {
      return "No pude registrar la transaccion. Verifica tu conexion con la app de finanzas.";
    }

    const sign = data.type === "gasto" ? "-" : "+";
    return `✅ Registrado: ${sign}${formatCurrency(data.amount)} en ${data.description}.`;
  }

  // Respuesta no reconocida en step "confirm"
  return `Confirmo el registro? Responde "si" para confirmar o "no" para cancelar.`;
}

// ─── Agente principal ─────────────────────────────────────────────────────────

export const financesAgent = {
  name: "finances",
  description: "Interfaz con la app de finanzas externa (finanzas-lemon.vercel.app)",

  async process(input: AgentInput): Promise<AgentOutput> {
    const { userId, message } = input;

    const goals = await getGoals(userId).catch(() => null);
    void (goals ? buildFinancesPrompt(goals) : null);

    const intent = detectIntent(message);

    try {
      switch (intent) {
        case "query_spending": {
          const report = await getMonthlyReport(userId);
          if (!report)
            return { success: true, message: "No pude obtener los gastos del mes. Configuraste tu API key de finanzas en Ajustes?" };
          const gastos = report.monthly.totalExpenses ?? 0;
          return { success: true, message: `Este mes llevas ${formatCurrency(gastos)} en gastos.` };
        }

        case "query_balance": {
          const report = await getMonthlyReport(userId);
          if (!report)
            return { success: true, message: "No pude obtener tu balance. Configuraste tu API key de finanzas en Ajustes?" };
          const inc = report.monthly.totalIncome ?? 0;
          const exp = report.monthly.totalExpenses ?? 0;
          const balance = inc - exp;
          const sign = balance >= 0 ? "+" : "";
          return {
            success: true,
            message: `Balance del mes: ${sign}${formatCurrency(balance)}. Ingresos: ${formatCurrency(inc)} / Gastos: ${formatCurrency(exp)}.`,
          };
        }

        case "query_report": {
          const [report, txs] = await Promise.all([
            getMonthlyReport(userId),
            getRecentTransactions(userId, 5),
          ]);
          if (!report)
            return { success: true, message: "No pude obtener el reporte. Configuraste tu API key de finanzas en Ajustes?" };
          const inc = report.monthly.totalIncome ?? 0;
          const exp = report.monthly.totalExpenses ?? 0;
          const balance = inc - exp;
          const txList =
            txs.length > 0
              ? "\n\nUltimas transacciones:\n" + formatTransactionList(txs)
              : "";
          return {
            success: true,
            message:
              `Finanzas del mes:\n` +
              `Ingresos: ${formatCurrency(inc)}\n` +
              `Gastos: ${formatCurrency(exp)}\n` +
              `Balance: ${formatCurrency(balance)}${txList}`,
          };
        }

        case "create_expense": {
          const msg = await handleCreateTransaction(userId, message, "gasto");
          return { success: true, message: msg };
        }

        case "create_income": {
          const msg = await handleCreateTransaction(userId, message, "ingreso");
          return { success: true, message: msg };
        }

        default: {
          const summary = await getFinancesSummaryText(userId);
          return { success: true, message: summary ?? "No hay datos de finanzas disponibles." };
        }
      }
    } catch {
      return { success: false, message: "Error consultando finanzas. Verifica tu conexion." };
    }
  },

  handleConfirmation,

  async onGoalsUpdate(
    _userId: string,
    _goals: import("@prisma/client").UserGoals
  ): Promise<{ ok: boolean }> {
    return { ok: true };
  },
};

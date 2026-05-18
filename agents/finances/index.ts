// ============================================================
// agents/finances/index.ts — Agente de Finanzas
// Integra con la app de finanzas externa (finanzas-lemon.vercel.app)
// via API REST con Bearer token.
//
// Intenciones:
//   query_spending   — "¿cuánto gasté este mes?"
//   query_balance    — "¿cuál es mi balance?"
//   query_report     — "resumen de finanzas"
//   create_expense   — "gasté $500 en ropa"
//   create_income    — "recibí $50000 de sueldo"
//   unknown
// ============================================================

import type { AgentInput, AgentOutput } from "@/lib/types";
import {
  getMonthlyReport,
  getRecentTransactions,
  getFinancesStatus,
  getCards,
  getCategories,
  createTransaction,
  getFinancesSummaryText,
  formatCurrency,
  type FinancesTransaction,
} from "@/lib/finances";

// ─── Tipos de intención ───────────────────────────────────────────────────────

type FinancesIntent =
  | "query_spending"   // ¿cuánto gasté? / ¿en qué gasté?
  | "query_balance"    // ¿cuál es mi balance? / ¿cómo voy?
  | "query_report"     // resumen general / reporte del mes
  | "create_expense"   // gasté / pagué / compré
  | "create_income"    // cobré / recibí / ingresé
  | "unknown";

// ─── Detección de intención ───────────────────────────────────────────────────

function detectIntent(text: string): FinancesIntent {
  const lower = text.toLowerCase();

  if (
    /cuánto gasté|cuanto gaste|cuanto llevo gastado|en qué gasté|en que gaste|gastos del mes/i.test(lower)
  )
    return "query_spending";

  if (
    /balance|saldo|cuánto tengo|cuanto tengo|cómo voy|como voy financieramente/i.test(lower)
  )
    return "query_balance";

  if (
    /resumen|reporte|informe|finanzas del mes|últimas transacciones|ultimas transacciones/i.test(lower)
  )
    return "query_report";

  if (
    /gasté|gaste|pagué|pague|compré|compre|salió|salio|desembolsé|desembolse/i.test(lower)
  )
    return "create_expense";

  if (
    /cobré|cobre|recibí|recibi|ingresé|ingrese|deposité|deposite|me pagaron/i.test(lower)
  )
    return "create_income";

  return "unknown";
}

// ─── Parseo de transacción desde texto (Claude Haiku) ────────────────────────

type ParsedTransaction = {
  amount: number;
  description: string;
  type: "gasto" | "ingreso";
  date: string; // YYYY-MM-DD
};

async function parseTransactionFromText(
  text: string,
  type: "gasto" | "ingreso"
): Promise<ParsedTransaction | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const today = new Date().toISOString().split("T")[0];

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
        max_tokens: 100,
        messages: [
          {
            role: "user",
            content:
              `Hoy es ${today}. Extrae del siguiente texto el monto y descripción de una transacción de tipo "${type}". ` +
              `Responde SOLO con JSON: {"amount": NUMBER, "description": "STRING", "date": "YYYY-MM-DD"} ` +
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

    const parsed = JSON.parse(jsonMatch[0]) as {
      amount: number;
      description: string;
      date: string;
    };

    if (!parsed.amount || !parsed.description) return null;

    return {
      amount: Math.abs(parsed.amount),
      description: parsed.description,
      type,
      date: parsed.date ?? today,
    };
  } catch {
    return null;
  }
}

// ─── Formateo de transacciones ───────────────────────────────────────────────

function formatTransactionList(transactions: FinancesTransaction[]): string {
  if (transactions.length === 0) return "No hay transacciones recientes.";

  return transactions
    .slice(0, 5)
    .map((t) => {
      const sign = t.type === "gasto" ? "-" : "+";
      const amount = formatCurrency(t.amount);
      const desc = t.description.substring(0, 30);
      const dateShort = t.date?.substring(5) ?? ""; // MM-DD
      return `${sign}${amount} ${desc} (${dateShort})`;
    })
    .join("\n");
}

// ─── Agente ───────────────────────────────────────────────────────────────────

export const financesAgent = {
  name: "finances",
  description: "Interfaz con la app de finanzas externa",

  async onGoalsUpdate(_userId: string, _goals: import("@prisma/client").UserGoals): Promise<{ ok: boolean }> {
    return { ok: true };
  },

  async process(input: AgentInput): Promise<AgentOutput> {
    const { userId, message } = input;

    // Verificar conexión
    const status = await getFinancesStatus(userId);
    if (!status.connected) {
      return {
        success: false,
        message:
          "La app de finanzas no está conectada. Configurá tu API key en Ajustes → Finanzas.",
      };
    }

    const intent = detectIntent(message);

    switch (intent) {
      case "query_report": {
        const report = await getMonthlyReport(userId);
        if (!report) {
          return {
            success: false,
            message: "No pude obtener el reporte de finanzas. Intentá de nuevo.",
          };
        }
        const { monthly } = report;
        const monthName = new Date().toLocaleDateString("es-UY", { month: "long" });
        return {
          success: true,
          message:
            `💰 Finanzas — ${monthName}:\n` +
            `Ingresos: ${formatCurrency(monthly.totalIncome)}\n` +
            `Gastos: ${formatCurrency(monthly.totalExpenses)}\n` +
            `Balance: ${monthly.balance >= 0 ? "+" : ""}${formatCurrency(monthly.balance)}`,
        };
      }

      case "query_spending": {
        const [report, transactions] = await Promise.all([
          getMonthlyReport(userId),
          getRecentTransactions(userId, 5),
        ]);

        const expensesText = report
          ? `Gastos totales: ${formatCurrency(report.monthly.totalExpenses)}`
          : "";

        const gastos = transactions.filter((t) => t.type === "gasto");
        const recentText =
          gastos.length > 0
            ? "\n\nÚltimos gastos:\n" + formatTransactionList(gastos)
            : "";

        return {
          success: true,
          message: expensesText + recentText || "No hay datos de gastos disponibles.",
        };
      }

      case "query_balance": {
        const report = await getMonthlyReport(userId);
        if (!report) {
          return {
            success: false,
            message: "No pude obtener el balance. Intentá de nuevo.",
          };
        }
        const { balance, totalIncome, totalExpenses } = report.monthly;
        const emoji = balance >= 0 ? "📈" : "📉";
        return {
          success: true,
          message:
            `${emoji} Balance del mes:\n` +
            `Ingresos: ${formatCurrency(totalIncome)}\n` +
            `Gastos: ${formatCurrency(totalExpenses)}\n` +
            `Resultado: ${balance >= 0 ? "+" : ""}${formatCurrency(balance)}`,
        };
      }

      case "create_expense":
      case "create_income": {
        const txType = intent === "create_expense" ? "gasto" : "ingreso";
        const parsed = await parseTransactionFromText(message, txType);

        if (!parsed) {
          return {
            success: false,
            message:
              `No pude entender el ${txType}. Intentá con algo como: ` +
              (txType === "gasto"
                ? '"Gasté $1500 en supermercado"'
                : '"Cobré $50000 de sueldo"'),
          };
        }

        // Necesitamos una tarjeta para crear la transacción
        const cards = await getCards(userId);
        if (cards.length === 0) {
          return {
            success: false,
            message: "No tenés tarjetas configuradas en la app de finanzas. Agregá una desde la app.",
          };
        }

        // Usar la primera tarjeta disponible (el usuario puede cambiar desde la app web)
        const defaultCard = cards[0];

        const tx = await createTransaction(userId, {
          cardId: defaultCard.id,
          amount: parsed.amount,
          type: parsed.type,
          description: parsed.description,
          date: parsed.date,
        });

        if (!tx) {
          return {
            success: false,
            message: `No pude registrar el ${txType}. Verificá la conexión con la app de finanzas.`,
          };
        }

        const emoji = txType === "gasto" ? "📤" : "📥";
        return {
          success: true,
          message:
            `${emoji} ${txType === "gasto" ? "Gasto" : "Ingreso"} registrado:\n` +
            `${parsed.description}: ${formatCurrency(parsed.amount)}\n` +
            `Tarjeta: ${defaultCard.name}`,
          data: tx,
        };
      }

      default:
        return {
          success: false,
          message:
            "¿Qué querés saber de tus finanzas? Puedo darte el balance, resumen de gastos, o registrar una transacción.",
        };
    }
  },

  /**
   * Genera texto resumen de finanzas para el Morning Summary.
   */
  async getSummaryText(userId: string): Promise<string | null> {
    return getFinancesSummaryText(userId);
  },

  /**
   * Verifica si hay alertas de gasto (gastos mayores que el mes pasado en alguna categoría).
   */
  async checkSpendingAlerts(userId: string): Promise<AgentOutput | null> {
    const report = await getMonthlyReport(userId);
    if (!report || report.last6.length < 2) return null;

    const current = report.last6[report.last6.length - 1];
    const previous = report.last6[report.last6.length - 2];

    if (!current || !previous) return null;

    const increase = current.totalExpenses - previous.totalExpenses;
    const increasePercent = previous.totalExpenses > 0
      ? Math.round((increase / previous.totalExpenses) * 100)
      : 0;

    // Alertar si los gastos subieron más del 20% respecto al mes anterior
    if (increasePercent >= 20) {
      return {
        success: true,
        message:
          `⚠️ Tus gastos este mes (${formatCurrency(current.totalExpenses)}) ` +
          `son ${increasePercent}% más altos que el mes pasado (${formatCurrency(previous.totalExpenses)}).`,
      };
    }

    return null;
  },
};

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

  async process(input: AgentInput): Promise<AgentOutput> {
    const { userId, message } = input;
    const intent = detectIntent(message);

    try {
      switch (intent) {
        case "query_spending": {
          const report = await getMonthlyReport(userId);
          if (!report) return { success: true, message: "No pude obtener los gastos del mes. ¿Configuraste tu API key de finanzas en Ajustes?" };
          const gastos = report.monthly.totalExpenses ?? 0;
          return { success: true, message: `Este mes llevas ${formatCurrency(gastos)} en gastos.` };
        }

        case "query_balance": {
          const report = await getMonthlyReport(userId);
          if (!report) return { success: true, message: "No pude obtener tu balance. ¿Configuraste tu API key de finanzas en Ajustes?" };
          const inc = report.monthly.totalIncome ?? 0;
          const exp = report.monthly.totalExpenses ?? 0;
          const balance = inc - exp;
          const sign = balance >= 0 ? "+" : "";
          return { success: true, message: `Balance del mes: ${sign}${formatCurrency(balance)}. Ingresos: ${formatCurrency(inc)} / Gastos: ${formatCurrency(exp)}.` };
        }

        case "query_report": {
          const [report, txs] = await Promise.all([
            getMonthlyReport(userId),
            getRecentTransactions(userId, 5),
          ]);
          if (!report) return { success: true, message: "No pude obtener el reporte. ¿Configuraste tu API key de finanzas en Ajustes?" };
          const inc = report.monthly.totalIncome ?? 0;
          const exp = report.monthly.totalExpenses ?? 0;
          const balance = inc - exp;
          const txList = txs.length > 0 ? "\n\nÚltimas transacciones:\n" + formatTransactionList(txs) : "";
          return {
            success: true,
            message: `Finanzas del mes:\n• Ingresos: ${formatCurrency(inc)}\n• Gastos: ${formatCurrency(exp)}\n• Balance: ${formatCurrency(balance)}${txList}`,
          };
        }

        case "create_expense":
        case "create_income": {
          // Logging transactions requires a cardId — redirect user to the web app
          const txType = intent === "create_expense" ? "gasto" : "ingreso";
          const parsed = await parseTransactionFromText(message, txType);
          if (!parsed) return { success: true, message: `No pude entender el ${txType}. Registralo en la app de finanzas.` };
          return { success: true, message: `Entendí: ${txType} de ${formatCurrency(parsed.amount)} (${parsed.description}). Registralo en finanzas-lemon.vercel.app para que quede guardado.` };
        }

        default: {
          const summary = await getFinancesSummaryText(userId);
          return { success: true, message: summary ?? "No hay datos de finanzas disponibles." };
        }
      }
    } catch {
      return { success: false, message: "Error consultando finanzas. Verificá tu conexión." };
    }
  },

  async onGoalsUpdate(_userId: string, _goals: import("@prisma/client").UserGoals): Promise<{ ok: boolean }> {
    return { ok: true };
  },
};

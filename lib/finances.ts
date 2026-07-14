// ============================================================
// lib/finances.ts — Cliente para la app de finanzas externa
// URL: https://finanzas-lemon.vercel.app
// Auth: Bearer token (fin_xxx...) guardado en UserSettings.financesApiKey
// ============================================================

import { db } from "@/lib/db";
import { uyDateKey } from "@/lib/dates";

// ─── Tipos de la API de Finanzas ──────────────────────────────────────────────

export type FinancesTransaction = {
  id: string;
  cardId: string;
  amount: number;
  type: "gasto" | "ingreso";
  description: string;
  date: string;
  categoryId?: string | null;
  category?: { id: string; name: string; icon?: string | null } | null;
  card?: { id: string; name: string; type?: string | null } | null;
};

export type FinancesCard = {
  id: string;
  name: string;
  type: string;
  currency?: string;
};

export type FinancesCategory = {
  id: string;
  name: string;
  type: "gasto" | "ingreso";
  icon?: string | null;
};

export type FinancesCategoryBreakdown = {
  name: string;
  emoji?: string | null;
  color?: string | null;
  total: number;
  currency?: string;
};

export type FinancesMonthlyReport = {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  openingBalance?: number;
  // Breakdown por categoría
  expenseByCategory?: FinancesCategoryBreakdown[];
  incomeByCategory?: Array<{ name: string; total: number }>;
  topCategories?: FinancesCategoryBreakdown[];
  // Breakdown por tarjeta
  expenseByCard?: Array<{ name: string; total: number; currency?: string }>;
  // Evolución diaria del saldo (YYYY-MM-DD -> monto)
  dailyBalance?: Record<string, number>;
  // Campo legacy
  byCategory?: Array<{ categoryName: string; total: number; count: number }>;
};

export type FinancesReport = {
  monthly: FinancesMonthlyReport;
  last6: Array<{
    month: number;
    year: number;
    label?: string;
    // Campos que puede devolver la API (distintos nombres según versión)
    totalIncome?: number;
    totalExpenses?: number;
    income?: number;
    expenses?: number;
    balance?: number;
  }>;
};

export type FinancesBalance = {
  card: FinancesCard;
  existing: {
    openingBalance?: number;
    expectedBalance?: number;
    status?: string;
  } | null;
  expectedBalance: number;
};

export type FinancesSummary = {
  report: FinancesReport;
  recentTransactions: FinancesTransaction[];
  balances: FinancesBalance[];
  connected: true;
};

// ─── Helpers internos ────────────────────────────────────────────────────────

const FINANCES_URL =
  process.env.FINANCES_APP_URL ?? "https://finanzas-lemon.vercel.app";

/**
 * Obtiene la API key del usuario desde UserSettings.
 * Fallback a FINANCES_API_KEY de env si no está configurada por el usuario.
 */
export async function getFinancesApiKey(
  userId: string,
): Promise<string | null> {
  const settings = await db.userSettings
    .findUnique({
      where: { userId },
      select: { financesApiKey: true } as { financesApiKey: true },
    })
    .catch(() => null);

  const userKey = settings?.financesApiKey as string | null | undefined;
  return userKey ?? process.env.FINANCES_API_KEY ?? null;
}

/**
 * Hace un fetch autenticado a la API de Finanzas.
 */
async function financesApiFetch<T>(
  apiKey: string,
  path: string,
  options?: RequestInit,
): Promise<T> {
  const url = FINANCES_URL + path;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Finances API error ${res.status} en ${path}: ${text.slice(0, 200)}`,
    );
  }

  // La API a veces devuelve HTML (200) si el endpoint no existe o la API key
  // es rechazada (página de login / fallback de la SPA). Detectarlo y dar un
  // error accionable en vez de un críptico "Unexpected token '<'".
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Finances API devolvió ${contentType || "sin content-type"} (no JSON) en ${path} ` +
        `[status ${res.status}]. Probablemente el endpoint no existe o la API key es inválida. ` +
        `Respuesta: ${text.slice(0, 120).replace(/\s+/g, " ")}`,
    );
  }

  return res.json() as Promise<T>;
}

// ─── Estado de la integración ────────────────────────────────────────────────

/**
 * Verifica si el usuario tiene la API key configurada.
 */
export async function getFinancesStatus(userId: string): Promise<{
  connected: boolean;
  apiKeyConfigured: boolean;
}> {
  const apiKey = await getFinancesApiKey(userId);
  return {
    connected: !!apiKey,
    apiKeyConfigured: !!apiKey,
  };
}

// ─── Reportes ─────────────────────────────────────────────────────────────────

/**
 * Devuelve el reporte mensual + últimos 6 meses.
 */
export async function getMonthlyReport(
  userId: string,
  month?: number,
  year?: number,
): Promise<FinancesReport | null> {
  const apiKey = await getFinancesApiKey(userId);
  if (!apiKey) return null;

  // Mes/año del calendario UY (getMonth()/getFullYear() usan el reloj del
  // server, que en fin de mes de noche ya está en el mes siguiente)
  const [uyYear, uyMonth] = uyDateKey().split("-");
  const params = new URLSearchParams({
    month: String(month ?? Number(uyMonth)),
    year: String(year ?? Number(uyYear)),
  });

  try {
    return await financesApiFetch<FinancesReport>(
      apiKey,
      `/api/reports?${params}`,
    );
  } catch (err) {
    console.error("[finances] getMonthlyReport error:", err);
    return null;
  }
}

// ─── Transacciones ────────────────────────────────────────────────────────────

/**
 * Devuelve las últimas transacciones del mes.
 */
export async function getRecentTransactions(
  userId: string,
  limit = 10,
  month?: number,
  year?: number,
): Promise<FinancesTransaction[]> {
  const apiKey = await getFinancesApiKey(userId);
  if (!apiKey) return [];

  const [uyYear, uyMonth] = uyDateKey().split("-");
  const params = new URLSearchParams({
    month: String(month ?? Number(uyMonth)),
    year: String(year ?? Number(uyYear)),
    limit: String(limit),
  });

  try {
    const data = await financesApiFetch<
      FinancesTransaction[] | { transactions: FinancesTransaction[] }
    >(apiKey, `/api/transactions?${params}`);
    // La API puede devolver array directo o { transactions: [...] }
    return Array.isArray(data)
      ? data
      : ((data as { transactions: FinancesTransaction[] }).transactions ?? []);
  } catch (err) {
    console.error("[finances] getRecentTransactions error:", err);
    return [];
  }
}

/**
 * Crea una transacción en la app de finanzas.
 */
export async function createTransaction(
  userId: string,
  data: {
    cardId: string;
    amount: number;
    type: "gasto" | "ingreso";
    description: string;
    date?: string;
    categoryId?: string;
  },
): Promise<FinancesTransaction | null> {
  const apiKey = await getFinancesApiKey(userId);
  if (!apiKey) return null;

  const body = {
    ...data,
    // Día calendario UY — con toISOString() (UTC) un gasto registrado después
    // de las 21:00 quedaba fechado al día siguiente en finanzas-lemon.
    date: data.date ?? uyDateKey(),
  };

  try {
    return await financesApiFetch<FinancesTransaction>(
      apiKey,
      "/api/transactions",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
  } catch (err) {
    console.error("[finances] createTransaction error:", err);
    return null;
  }
}

// ─── Cards y balances ─────────────────────────────────────────────────────────

/**
 * Devuelve las tarjetas del usuario.
 */
export async function getCards(userId: string): Promise<FinancesCard[]> {
  const apiKey = await getFinancesApiKey(userId);
  if (!apiKey) return [];

  try {
    const data = await financesApiFetch<
      FinancesCard[] | { cards: FinancesCard[] }
    >(apiKey, "/api/cards");
    return Array.isArray(data)
      ? data
      : ((data as { cards: FinancesCard[] }).cards ?? []);
  } catch (err) {
    console.error("[finances] getCards error:", err);
    return [];
  }
}

/**
 * Devuelve los balances del mes por tarjeta.
 */
export async function getBalances(
  userId: string,
  month?: number,
  year?: number,
): Promise<FinancesBalance[]> {
  const apiKey = await getFinancesApiKey(userId);
  if (!apiKey) return [];

  const now = new Date();
  const params = new URLSearchParams({
    month: String(month ?? now.getMonth() + 1),
    year: String(year ?? now.getFullYear()),
  });

  try {
    const data = await financesApiFetch<
      FinancesBalance[] | { balances: FinancesBalance[] }
    >(apiKey, `/api/balances?${params}`);
    return Array.isArray(data)
      ? data
      : ((data as { balances: FinancesBalance[] }).balances ?? []);
  } catch (err) {
    console.error("[finances] getBalances error:", err);
    return [];
  }
}

/**
 * Devuelve las categorías del usuario.
 */
export async function getCategories(
  userId: string,
  type?: "gasto" | "ingreso",
): Promise<FinancesCategory[]> {
  const apiKey = await getFinancesApiKey(userId);
  if (!apiKey) return [];

  const params = type ? `?type=${type}` : "";

  try {
    const data = await financesApiFetch<
      FinancesCategory[] | { categories: FinancesCategory[] }
    >(apiKey, `/api/categories${params}`);
    return Array.isArray(data)
      ? data
      : ((data as { categories: FinancesCategory[] }).categories ?? []);
  } catch (err) {
    console.error("[finances] getCategories error:", err);
    return [];
  }
}

// ─── Summary compuesto ────────────────────────────────────────────────────────

/**
 * Obtiene todo lo necesario para la página /finances en un solo batch.
 * Usa Promise.allSettled para que una falla no bloquee el resto.
 */
export async function getFinancesDashboard(userId: string): Promise<{
  report: FinancesReport | null;
  recentTransactions: FinancesTransaction[];
  balances: FinancesBalance[];
  connected: boolean;
}> {
  const status = await getFinancesStatus(userId);
  if (!status.connected) {
    return {
      report: null,
      recentTransactions: [],
      balances: [],
      connected: false,
    };
  }

  const [reportResult, transactionsResult, balancesResult] =
    await Promise.allSettled([
      getMonthlyReport(userId),
      getRecentTransactions(userId, 10),
      getBalances(userId),
    ]);

  return {
    report: reportResult.status === "fulfilled" ? reportResult.value : null,
    recentTransactions:
      transactionsResult.status === "fulfilled" ? transactionsResult.value : [],
    balances: balancesResult.status === "fulfilled" ? balancesResult.value : [],
    connected: true,
  };
}

// ─── Texto para WhatsApp / Morning Summary ───────────────────────────────────

/**
 * Genera un resumen de finanzas del mes en texto plano para WhatsApp.
 */
export async function getFinancesSummaryText(
  userId: string,
): Promise<string | null> {
  const report = await getMonthlyReport(userId);
  if (!report) return null;

  const { monthly } = report;
  const now = new Date();
  const monthName = now.toLocaleDateString("es-UY", { month: "long" });

  const income = formatCurrency(monthly.totalIncome);
  const expenses = formatCurrency(monthly.totalExpenses);
  const balance = formatCurrency(monthly.balance);
  const sign = monthly.balance >= 0 ? "+" : "";

  return (
    `💰 Finanzas (${monthName}):\n` +
    `Ingresos: ${income}\n` +
    `Gastos: ${expenses}\n` +
    `Balance: ${sign}${balance}`
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export { formatCurrency };

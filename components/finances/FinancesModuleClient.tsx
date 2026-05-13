"use client";

// ============================================================
// FinancesModuleClient — Módulo de Finanzas completo
// Muestra: balance del mes, últimas transacciones, barras por tarjeta
// Lee datos desde /api/finances/summary (proxy server-side)
// ============================================================

import { useState, useEffect, useCallback } from "react";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  RefreshCw,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  FinancesReport,
  FinancesTransaction,
  FinancesBalance,
} from "@/lib/finances";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type Props = {
  connected: boolean;
  report: FinancesReport | null;
  recentTransactions: FinancesTransaction[];
  balances: FinancesBalance[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDateShort(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length < 3) return dateStr;
  return `${parts[2]}/${parts[1]}`; // DD/MM
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function StatCard({
  label,
  amount,
  trend,
  icon: Icon,
  colorClass,
}: {
  label: string;
  amount: number;
  trend?: number | null;
  icon: React.ElementType;
  colorClass: string;
}) {
  return (
    <div className="card flex-1">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
          {label}
        </span>
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", colorClass)}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <p className="text-xl font-bold text-[var(--text-primary)]">
        {formatCurrency(amount)}
      </p>
      {trend !== undefined && trend !== null && (
        <p
          className={cn(
            "text-xs mt-1 flex items-center gap-0.5",
            trend >= 0 ? "text-green-500" : "text-red-500"
          )}
        >
          {trend >= 0 ? (
            <ArrowUpRight className="w-3 h-3" />
          ) : (
            <ArrowDownRight className="w-3 h-3" />
          )}
          {Math.abs(trend)}% vs mes anterior
        </p>
      )}
    </div>
  );
}

function TransactionRow({ tx }: { tx: FinancesTransaction }) {
  const isGasto = tx.type === "gasto";
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[var(--border)] last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)] truncate">
          {tx.description}
        </p>
        <p className="text-xs text-[var(--text-muted)]">
          {tx.card?.name ?? ""}{tx.date ? ` · ${formatDateShort(tx.date)}` : ""}
        </p>
      </div>
      <span
        className={cn(
          "text-sm font-semibold ml-3",
          isGasto ? "text-red-400" : "text-green-400"
        )}
      >
        {isGasto ? "-" : "+"}
        {formatCurrency(tx.amount)}
      </span>
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

export function FinancesModuleClient({
  connected: initialConnected,
  report: initialReport,
  recentTransactions: initialTransactions,
  balances: initialBalances,
}: Props) {
  const [connected, setConnected] = useState(initialConnected);
  const [report, setReport] = useState<FinancesReport | null>(initialReport);
  const [transactions, setTransactions] = useState<FinancesTransaction[]>(initialTransactions);
  const [balances, setBalances] = useState<FinancesBalance[]>(initialBalances);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const currentMonth = new Date().toLocaleDateString("es-UY", {
    month: "long",
    year: "numeric",
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/finances/summary");
      if (!res.ok) throw new Error("Error cargando finanzas");
      const data = (await res.json()) as {
        ok: boolean;
        connected: boolean;
        report: FinancesReport | null;
        recentTransactions: FinancesTransaction[];
        balances: FinancesBalance[];
      };
      setConnected(data.connected);
      setReport(data.report ?? null);
      setTransactions(data.recentTransactions ?? []);
      setBalances(data.balances ?? []);
    } catch (err) {
      setError("No se pudo conectar con la app de finanzas.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Sin API key configurada ─────────────────────────────────────────────

  if (!connected) {
    return (
      <div className="card text-center py-10 space-y-3">
        <AlertCircle className="w-10 h-10 text-[var(--text-muted)] mx-auto opacity-40" />
        <p className="font-medium text-[var(--text-primary)]">
          Finanzas no conectado
        </p>
        <p className="text-sm text-[var(--text-muted)]">
          Configurá tu API key en{" "}
          <a href="/settings" className="text-accent underline">
            Ajustes → Finanzas
          </a>
        </p>
        <a
          href="https://finanzas-lemon.vercel.app/settings"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
        >
          Obtener API key
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    );
  }

  const monthly = report?.monthly;

  // Calcular tendencia vs mes anterior
  const last6 = report?.last6 ?? [];
  let expenseTrend: number | null = null;
  let incomeTrend: number | null = null;
  if (last6.length >= 2) {
    const prev = last6[last6.length - 2];
    const curr = last6[last6.length - 1];
    if (prev && curr && prev.totalExpenses > 0) {
      expenseTrend = Math.round(
        ((curr.totalExpenses - prev.totalExpenses) / prev.totalExpenses) * 100
      );
    }
    if (prev && curr && prev.totalIncome > 0) {
      incomeTrend = Math.round(
        ((curr.totalIncome - prev.totalIncome) / prev.totalIncome) * 100
      );
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Header con mes + refresh ── */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-secondary)] capitalize">{currentMonth}</p>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={loading}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[var(--surface-hover)] text-[var(--text-muted)] transition-colors"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </button>
          <a
            href="https://finanzas-lemon.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[var(--surface-hover)] text-[var(--text-muted)] transition-colors"
            title="Abrir app de finanzas"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {error && (
        <div className="card border-red-500/20 text-sm text-red-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── Stats: Ingresos / Gastos / Balance ── */}
      {monthly ? (
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="Ingresos"
            amount={monthly.totalIncome}
            trend={incomeTrend}
            icon={TrendingUp}
            colorClass="bg-green-500/10 text-green-500"
          />
          <StatCard
            label="Gastos"
            amount={monthly.totalExpenses}
            trend={expenseTrend}
            icon={TrendingDown}
            colorClass="bg-red-500/10 text-red-400"
          />
          <StatCard
            label="Balance"
            amount={monthly.balance}
            icon={Wallet}
            colorClass={
              monthly.balance >= 0
                ? "bg-blue-500/10 text-blue-400"
                : "bg-red-500/10 text-red-400"
            }
          />
        </div>
      ) : (
        <div className="card text-center py-6">
          <p className="text-sm text-[var(--text-muted)]">Sin datos del mes</p>
        </div>
      )}

      {/* ── Balances por tarjeta ── */}
      {balances.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
            Balances por cuenta
          </h3>
          <div className="space-y-2">
            {balances.map((b, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm text-[var(--text-secondary)]">
                  {b.card?.name ?? "Cuenta"}
                </span>
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  {formatCurrency(b.expectedBalance)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Últimas transacciones ── */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Últimas transacciones
          </h3>
          <a
            href="https://finanzas-lemon.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent flex items-center gap-1 hover:underline"
          >
            Ver todas
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {transactions.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] text-center py-4">
            Sin transacciones este mes
          </p>
        ) : (
          <div>
            {transactions.slice(0, 8).map((tx) => (
              <TransactionRow key={tx.id} tx={tx} />
            ))}
          </div>
        )}
      </div>

      {/* ── Historial últimos 6 meses ── */}
      {last6.length > 1 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
            Últimos 6 meses
          </h3>
          <div className="space-y-2">
            {[...last6].reverse().slice(0, 6).map((m, i) => {
              const monthLabel = new Date(m.year, m.month - 1, 1).toLocaleDateString(
                "es-UY",
                { month: "short", year: "2-digit" }
              );
              const maxExpenses = Math.max(...last6.map((x) => x.totalExpenses), 1);
              const barWidth = Math.round((m.totalExpenses / maxExpenses) * 100);
              const balanceColor = m.balance >= 0 ? "text-green-400" : "text-red-400";
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-[var(--text-muted)] w-12 capitalize">
                    {monthLabel}
                  </span>
                  <div className="flex-1 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-400/60 rounded-full"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <span className={cn("text-xs font-medium w-20 text-right", balanceColor)}>
                    {m.balance >= 0 ? "+" : ""}
                    {formatCurrency(m.balance)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

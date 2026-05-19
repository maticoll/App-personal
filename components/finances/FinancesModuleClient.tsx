"use client";

// ============================================================
// FinancesModuleClient — Módulo de Finanzas (diseño Stitch)
// Secciones: stats · top categorías · donut · área diaria ·
//            6 meses · gasto por tarjeta · balances · transacciones
// ============================================================

import { useState, useCallback } from "react";
import {
  TrendingUp, TrendingDown, Wallet,
  ArrowUpRight, ArrowDownRight,
  ExternalLink, RefreshCw, Loader2, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  FinancesReport, FinancesTransaction, FinancesBalance,
  FinancesCategoryBreakdown,
} from "@/lib/finances";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Props = {
  connected: boolean;
  report: FinancesReport | null;
  recentTransactions: FinancesTransaction[];
  balances: FinancesBalance[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(amount: number): string {
  return new Intl.NumberFormat("es-UY", {
    style: "currency", currency: "UYU",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount);
}

function dateShort(d: string): string {
  const p = d.split("-");
  return p.length < 3 ? d : `${p[2]}/${p[1]}`;
}

// Normaliza last6 para manejar distintos nombres de campos de la API
function normalizeLast6(raw: FinancesReport["last6"]) {
  return raw.map((m) => ({
    month: m.month,
    year: m.year,
    label: m.label ?? "",
    income:   m.totalIncome  ?? m.income   ?? 0,
    expenses: m.totalExpenses ?? m.expenses ?? 0,
    balance:  m.balance ?? ((m.totalIncome ?? m.income ?? 0) - (m.totalExpenses ?? m.expenses ?? 0)),
  }));
}

// Colores para el donut (conic-gradient y leyenda)
const CAT_COLORS = [
  "#8083ff", "#adc6ff", "#ffb783", "#d97721",
  "#6ee7b7", "#f87171", "#a78bfa", "#34d399",
];

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-bold tracking-widest text-[#6B7280] uppercase">
      {children}
    </h2>
  );
}

function TrendChip({ value }: { value: number }) {
  const pos = value >= 0;
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold",
      pos ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
    )}>
      {pos ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {pos ? "+" : ""}{value}%
    </span>
  );
}

function StatCard({ label, amount, trend, icon: Icon, color }: {
  label: string; amount: number; trend?: number | null;
  icon: React.ElementType; color: string;
}) {
  return (
    <div className="flex-1 min-w-[140px] bg-[#1A1D27] border border-white/[0.06] rounded-xl p-4">
      <p className="text-[11px] font-bold tracking-widest text-[#6B7280] uppercase mb-1">{label}</p>
      <p className={cn("text-lg font-bold", color)}>{fmt(amount)}</p>
      {trend !== undefined && trend !== null && <TrendChip value={trend} />}
    </div>
  );
}

function TopCategories({ cats }: { cats: FinancesCategoryBreakdown[] }) {
  if (!cats.length) return null;
  const max = Math.max(...cats.map((c) => c.total), 1);
  return (
    <section className="space-y-3">
      <SectionLabel>Top categorías</SectionLabel>
      <div className="bg-[#1A1D27] border border-white/[0.06] rounded-xl p-4 space-y-4">
        {cats.slice(0, 5).map((cat, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                {cat.emoji && <span className="text-base">{cat.emoji}</span>}
                <span className="text-sm text-[#e4e1ed]">{cat.name}</span>
              </div>
              <span className="text-sm font-bold text-[#e4e1ed]">{fmt(cat.total)}</span>
            </div>
            <div className="h-2 w-full bg-[#2D313E] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.round((cat.total / max) * 100)}%`,
                  backgroundColor: cat.color ?? "#0566d9",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function DonutChart({ cats, total }: { cats: FinancesCategoryBreakdown[]; total: number }) {
  if (!cats.length) return null;

  // Construir conic-gradient con porcentajes reales
  let accumulated = 0;
  const segments = cats.slice(0, 5).map((cat, i) => {
    const pct = Math.round((cat.total / total) * 100);
    const start = accumulated;
    accumulated += pct;
    return { cat, color: CAT_COLORS[i] ?? "#464554", start, end: accumulated };
  });
  // El resto (otros)
  if (accumulated < 100) {
    segments.push({ cat: { name: "Otros", total: 0 }, color: "#464554", start: accumulated, end: 100 });
  }

  const gradient = segments.map((s) => `${s.color} ${s.start}% ${s.end}%`).join(", ");

  return (
    <section className="space-y-3">
      <SectionLabel>Gastos por categoría</SectionLabel>
      <div className="bg-[#1A1D27] border border-white/[0.06] rounded-xl p-4 flex flex-col items-center">
        {/* Donut via conic-gradient */}
        <div
          className="w-44 h-44 rounded-full relative flex items-center justify-center"
          style={{ background: `conic-gradient(${gradient})` }}
        >
          {/* Agujero interior */}
          <div className="absolute inset-6 bg-[#1A1D27] rounded-full flex flex-col items-center justify-center">
            <p className="text-[10px] font-bold tracking-widest text-[#6B7280] uppercase">Gastos</p>
            <p className="text-base font-bold text-red-400">-{fmt(total)}</p>
          </div>
        </div>
        {/* Leyenda */}
        <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 w-full">
          {segments.filter((s) => s.cat.total > 0 || s.cat.name !== "Otros").slice(0, 6).map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-xs text-[#c7c4d7] truncate">{s.cat.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DailyEvolution({ dailyBalance }: { dailyBalance: Record<string, number> }) {
  const entries = Object.entries(dailyBalance).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length < 2) return null;

  const values = entries.map(([, v]) => v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  // Normalizar a Y (0=top, 100=bottom del SVG)
  const points = entries.map(([, v], i) => {
    const x = (i / (entries.length - 1)) * 310;
    const y = 90 - ((v - min) / range) * 80;
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L310,100 L0,100 Z`;

  const today = new Date().toISOString().split("T")[0];
  const todayIdx = entries.findIndex(([d]) => d === today);
  const todayPt = todayIdx >= 0 ? points[todayIdx] : null;

  const daysInMonth = entries.length;
  const firstDay = entries[0]?.[0]?.split("-")[2] ?? "1";
  const lastDay = entries[daysInMonth - 1]?.[0]?.split("-")[2] ?? "31";

  return (
    <section className="space-y-3">
      <SectionLabel>Evolución del mes</SectionLabel>
      <div className="bg-[#1A1D27] border border-white/[0.06] rounded-xl p-4">
        <div className="relative h-36 w-full">
          <svg viewBox="0 0 310 100" className="w-full h-full overflow-visible" preserveAspectRatio="none">
            <defs>
              <linearGradient id="evoGrad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#8083ff" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#8083ff" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={areaPath} fill="url(#evoGrad)" />
            <path d={linePath} fill="none" stroke="#8083ff" strokeWidth="2" />
            {todayPt && (
              <>
                <circle cx={todayPt.x} cy={todayPt.y} r="4" fill="#8083ff" />
                <line x1={todayPt.x} y1={todayPt.y} x2={todayPt.x} y2="100"
                  stroke="#8083ff" strokeWidth="1" strokeDasharray="4" opacity="0.5" />
              </>
            )}
          </svg>
        </div>
        <div className="flex justify-between mt-1 text-[10px] text-[#6B7280]">
          <span>{firstDay}</span>
          <span>{Math.round(parseInt(lastDay) / 2)}</span>
          <span>{lastDay}</span>
        </div>
      </div>
    </section>
  );
}

function Last6Months({ last6 }: { last6: ReturnType<typeof normalizeLast6> }) {
  if (last6.length < 2) return null;
  const maxVal = Math.max(...last6.flatMap((m) => [m.income, m.expenses]), 1);

  return (
    <section className="space-y-3">
      <SectionLabel>Últimos 6 meses</SectionLabel>
      <div className="bg-[#1A1D27] border border-white/[0.06] rounded-xl p-4">
        <div className="flex justify-between items-end h-28 gap-2 mb-2">
          {last6.map((m, i) => {
            const incH = Math.round((m.income / maxVal) * 100);
            const expH = Math.round((m.expenses / maxVal) * 100);
            const label = m.label || new Date(m.year, m.month - 1, 1).toLocaleDateString("es-UY", { month: "short" });
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="flex items-end gap-[2px] w-full justify-center h-24">
                  <div className="w-2.5 bg-[#c0c1ff] rounded-t-sm" style={{ height: `${incH}%` }} />
                  <div className="w-2.5 bg-red-400 rounded-t-sm" style={{ height: `${expH}%` }} />
                </div>
                <span className="text-[10px] text-[#6B7280] capitalize">{label}</span>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 justify-center mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#c0c1ff]" />
            <span className="text-[10px] text-[#6B7280] uppercase">Ingresos</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-[10px] text-[#6B7280] uppercase">Gastos</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function CardExpenses({ cards }: { cards: Array<{ name: string; total: number }> }) {
  if (!cards.length) return null;
  const max = Math.max(...cards.map((c) => c.total), 1);
  return (
    <section className="space-y-3">
      <SectionLabel>Gasto por tarjeta</SectionLabel>
      <div className="bg-[#1A1D27] border border-white/[0.06] rounded-xl p-4 space-y-4">
        {cards.map((card, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-[#c7c4d7]">{card.name}</span>
              <span className="font-bold text-[#e4e1ed]">{fmt(card.total)}</span>
            </div>
            <div className="h-2 w-full bg-[#2D313E] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#ffb783] rounded-full"
                style={{ width: `${Math.round((card.total / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TransactionRow({ tx }: { tx: FinancesTransaction }) {
  const isGasto = tx.type === "gasto";
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#e4e1ed] truncate">{tx.description}</p>
        <p className="text-xs text-[#6B7280]">
          {tx.card?.name ?? ""}{tx.date ? ` · ${dateShort(tx.date)}` : ""}
        </p>
      </div>
      <span className={cn("text-sm font-semibold ml-3", isGasto ? "text-red-400" : "text-green-400")}>
        {isGasto ? "-" : "+"}{fmt(tx.amount)}
      </span>
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

export function FinancesModuleClient({
  connected: initialConnected,
  report: initialReport,
  recentTransactions: initialTxs,
  balances: initialBalances,
}: Props) {
  const [connected, setConnected] = useState(initialConnected);
  const [report, setReport] = useState<FinancesReport | null>(initialReport);
  const [txs, setTxs] = useState<FinancesTransaction[]>(initialTxs);
  const [balances, setBalances] = useState<FinancesBalance[]>(initialBalances);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const currentMonth = new Date().toLocaleDateString("es-UY", { month: "long", year: "numeric" });

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/finances/summary");
      if (!res.ok) throw new Error();
      const data = await res.json() as {
        ok: boolean; connected: boolean;
        report: FinancesReport | null;
        recentTransactions: FinancesTransaction[];
        balances: FinancesBalance[];
      };
      setConnected(data.connected);
      setReport(data.report ?? null);
      setTxs(data.recentTransactions ?? []);
      setBalances(data.balances ?? []);
    } catch {
      setError("No se pudo conectar con la app de finanzas.");
    } finally {
      setLoading(false);
    }
  }, []);

  if (!connected) {
    return (
      <div className="bg-[#1A1D27] border border-white/[0.06] rounded-xl text-center py-10 space-y-3">
        <AlertCircle className="w-10 h-10 text-[#6B7280] mx-auto opacity-40" />
        <p className="font-medium text-[#e4e1ed]">Finanzas no conectado</p>
        <p className="text-sm text-[#6B7280]">
          Configurá tu API key en{" "}
          <a href="/settings" className="text-indigo-400 underline">Ajustes</a>
        </p>
      </div>
    );
  }

  const monthly = report?.monthly;
  const last6raw = report?.last6 ?? [];
  const last6 = normalizeLast6(last6raw);

  // Tendencias vs mes anterior
  let expenseTrend: number | null = null;
  let incomeTrend: number | null = null;
  if (last6.length >= 2) {
    const prev = last6[last6.length - 2];
    const curr = last6[last6.length - 1];
    if (prev.expenses > 0)
      expenseTrend = Math.round(((curr.expenses - prev.expenses) / prev.expenses) * 100);
    if (prev.income > 0)
      incomeTrend = Math.round(((curr.income - prev.income) / prev.income) * 100);
  }

  // Categorías: preferir topCategories, sino expenseByCategory
  const cats: FinancesCategoryBreakdown[] =
    monthly?.topCategories ?? monthly?.expenseByCategory ?? [];

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#6B7280] capitalize">{currentMonth}</p>
        <div className="flex items-center gap-2">
          <button onClick={refresh} disabled={loading}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#292932] text-[#6B7280] transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </button>
          <a href="https://finanzas-lemon.vercel.app" target="_blank" rel="noopener noreferrer"
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#292932] text-[#6B7280] transition-colors">
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {error && (
        <div className="bg-[#1A1D27] border border-red-500/20 rounded-xl text-sm text-red-400 flex items-center gap-2 p-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      {/* ── Stats row ──────────────────────────────────────────── */}
      {monthly ? (
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4">
          <StatCard label="Ingresos" amount={monthly.totalIncome}
            trend={incomeTrend} icon={TrendingUp} color="text-[#c0c1ff]" />
          <StatCard label="Gastos" amount={monthly.totalExpenses}
            trend={expenseTrend} icon={TrendingDown} color="text-red-400" />
          <StatCard label="Balance" amount={monthly.balance}
            icon={Wallet} color={monthly.balance >= 0 ? "text-[#ffb783]" : "text-red-400"} />
        </div>
      ) : (
        <div className="bg-[#1A1D27] border border-white/[0.06] rounded-xl text-center py-6">
          <p className="text-sm text-[#6B7280]">Sin datos del mes</p>
        </div>
      )}

      {/* ── Top categorías ─────────────────────────────────────── */}
      {cats.length > 0 && <TopCategories cats={cats} />}

      {/* ── Donut ──────────────────────────────────────────────── */}
      {cats.length > 0 && monthly && (
        <DonutChart cats={cats} total={monthly.totalExpenses} />
      )}

      {/* ── Evolución diaria ───────────────────────────────────── */}
      {monthly?.dailyBalance && Object.keys(monthly.dailyBalance).length > 1 && (
        <DailyEvolution dailyBalance={monthly.dailyBalance} />
      )}

      {/* ── Últimos 6 meses ────────────────────────────────────── */}
      {last6.length > 1 && <Last6Months last6={last6} />}

      {/* ── Gasto por tarjeta ──────────────────────────────────── */}
      {(monthly?.expenseByCard?.length ?? 0) > 0 && (
        <CardExpenses cards={monthly!.expenseByCard!} />
      )}

      {/* ── Balances por cuenta ────────────────────────────────── */}
      {balances.length > 0 && (
        <section className="space-y-3">
          <SectionLabel>Balances por cuenta</SectionLabel>
          <div className="bg-[#1A1D27] border border-white/[0.06] rounded-xl p-4 space-y-2">
            {balances.map((b, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm text-[#c7c4d7]">{b.card?.name ?? "Cuenta"}</span>
                <span className={cn(
                  "text-sm font-semibold",
                  b.expectedBalance >= 0 ? "text-green-400" : "text-red-400"
                )}>
                  {b.expectedBalance >= 0 ? "+" : ""}{fmt(b.expectedBalance)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Últimas transacciones ──────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionLabel>Últimas transacciones</SectionLabel>
          <a href="https://finanzas-lemon.vercel.app" target="_blank" rel="noopener noreferrer"
            className="text-xs text-indigo-400 flex items-center gap-1 hover:underline">
            Ver todas <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="bg-[#1A1D27] border border-white/[0.06] rounded-xl px-4">
          {txs.length === 0
            ? <p className="text-sm text-[#6B7280] text-center py-6">Sin transacciones este mes</p>
            : txs.slice(0, 8).map((tx) => <TransactionRow key={tx.id} tx={tx} />)
          }
        </div>
      </section>

    </div>
  );
}

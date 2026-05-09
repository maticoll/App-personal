"use client";

// ============================================================
// ScoringHistoryClient — Componente interactivo del historial
// Maneja: selector de período, filtro de módulos, gráfico + cards
// Sesión 2 — Dashboard + Scoring
// ============================================================

import { useState, useMemo } from "react";
import { PeriodSelector, type Period } from "./PeriodSelector";
import { ScoreTrendChart } from "./ScoreTrendChart";
import { ModuleToggle, type ModuleKey } from "./ModuleToggle";
import { DailyScoreCard } from "./DailyScoreCard";
import type { HistoricalScoreEntry } from "@/lib/scoring";

interface ScoringHistoryClientProps {
  initialData: HistoricalScoreEntry[];
  isMock: boolean;
}

function filterDataByPeriod(
  data: HistoricalScoreEntry[],
  period: Period
): HistoricalScoreEntry[] {
  const now = new Date();
  const cutoff = new Date();

  if (period === "daily") {
    cutoff.setDate(now.getDate() - 13); // últimos 14 días
  } else if (period === "weekly") {
    cutoff.setDate(now.getDate() - 55); // últimas 8 semanas
  } else {
    cutoff.setMonth(now.getMonth() - 6); // últimos 6 meses
  }

  const cutoffStr = cutoff.toISOString().split("T")[0];
  return data.filter((e) => e.date >= cutoffStr);
}

function aggregateByWeek(
  data: HistoricalScoreEntry[]
): HistoricalScoreEntry[] {
  const weeks: Map<string, number[][]> = new Map();
  const MODULE_KEYS: (keyof HistoricalScoreEntry)[] = [
    "global", "sleep", "fitness", "nutrition", "projects",
  ];

  for (const entry of data) {
    const d = new Date(entry.date);
    // Lunes de la semana
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    const weekKey = monday.toISOString().split("T")[0];

    if (!weeks.has(weekKey)) {
      weeks.set(weekKey, MODULE_KEYS.map(() => []));
    }

    MODULE_KEYS.forEach((key, i) => {
      const val = entry[key];
      if (typeof val === "number") {
        weeks.get(weekKey)![i].push(val);
      }
    });
  }

  return Array.from(weeks.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, arrays]) => ({
      date,
      global: arrays[0].length
        ? Math.round(arrays[0].reduce((a, b) => a + b) / arrays[0].length)
        : null,
      sleep: arrays[1].length
        ? Math.round(arrays[1].reduce((a, b) => a + b) / arrays[1].length)
        : null,
      fitness: arrays[2].length
        ? Math.round(arrays[2].reduce((a, b) => a + b) / arrays[2].length)
        : null,
      nutrition: arrays[3].length
        ? Math.round(arrays[3].reduce((a, b) => a + b) / arrays[3].length)
        : null,
      projects: arrays[4].length
        ? Math.round(arrays[4].reduce((a, b) => a + b) / arrays[4].length)
        : null,
    }));
}

function aggregateByMonth(
  data: HistoricalScoreEntry[]
): HistoricalScoreEntry[] {
  const months: Map<string, number[][]> = new Map();
  const MODULE_KEYS: (keyof HistoricalScoreEntry)[] = [
    "global", "sleep", "fitness", "nutrition", "projects",
  ];

  for (const entry of data) {
    const monthKey = entry.date.slice(0, 7) + "-01"; // YYYY-MM-01

    if (!months.has(monthKey)) {
      months.set(monthKey, MODULE_KEYS.map(() => []));
    }

    MODULE_KEYS.forEach((key, i) => {
      const val = entry[key];
      if (typeof val === "number") {
        months.get(monthKey)![i].push(val);
      }
    });
  }

  return Array.from(months.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, arrays]) => ({
      date,
      global: arrays[0].length
        ? Math.round(arrays[0].reduce((a, b) => a + b) / arrays[0].length)
        : null,
      sleep: arrays[1].length
        ? Math.round(arrays[1].reduce((a, b) => a + b) / arrays[1].length)
        : null,
      fitness: arrays[2].length
        ? Math.round(arrays[2].reduce((a, b) => a + b) / arrays[2].length)
        : null,
      nutrition: arrays[3].length
        ? Math.round(arrays[3].reduce((a, b) => a + b) / arrays[3].length)
        : null,
      projects: arrays[4].length
        ? Math.round(arrays[4].reduce((a, b) => a + b) / arrays[4].length)
        : null,
    }));
}

export function ScoringHistoryClient({
  initialData,
  isMock,
}: ScoringHistoryClientProps) {
  const [period, setPeriod] = useState<Period>("weekly");
  const [activeModules, setActiveModules] = useState<ModuleKey[]>([]);
  const [showModules, setShowModules] = useState(false);

  // Filtrar y agregar datos según el período seleccionado
  const chartData = useMemo(() => {
    const filtered = filterDataByPeriod(initialData, period);
    if (period === "weekly") return aggregateByWeek(filtered);
    if (period === "monthly") return aggregateByMonth(filtered);
    return filtered; // daily: sin agregar
  }, [initialData, period]);

  // Para la lista de días: siempre diarios, últimos N días
  const dailyCards = useMemo(() => {
    const daysToShow = period === "daily" ? 14 : period === "weekly" ? 28 : 30;
    const filtered = filterDataByPeriod(initialData, "daily");
    return [...filtered]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, daysToShow);
  }, [initialData, period]);

  // Calcular estadísticas del período
  const stats = useMemo(() => {
    const globals = chartData
      .map((e) => e.global)
      .filter((v): v is number => v !== null);
    if (globals.length === 0) return null;
    return {
      avg: Math.round(globals.reduce((a, b) => a + b, 0) / globals.length),
      max: Math.max(...globals),
      min: Math.min(...globals),
    };
  }, [chartData]);

  return (
    <div className="space-y-4">

      {/* ─── Selector de período ───────────────────────────── */}
      <PeriodSelector value={period} onChange={setPeriod} />

      {/* ─── Stats rápidas ─────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Promedio", value: stats.avg },
            { label: "Máximo", value: stats.max },
            { label: "Mínimo", value: stats.min },
          ].map(({ label, value }) => (
            <div key={label} className="card text-center py-3">
              <p className="text-lg font-bold text-[var(--text-primary)]">
                {value}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ─── Gráfico de tendencia ──────────────────────────── */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="font-medium text-[var(--text-primary)] text-sm">
            Evolución del score
          </span>
          <button
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            onClick={() => setShowModules((v) => !v)}
          >
            {showModules ? "Ocultar módulos" : "Mostrar módulos"}
          </button>
        </div>

        {/* Toggle de módulos */}
        {showModules && (
          <ModuleToggle
            active={activeModules}
            onChange={setActiveModules}
          />
        )}

        {/* Gráfico */}
        <ScoreTrendChart
          data={chartData}
          period={period}
          activeModules={activeModules}
          showGlobal
          height={220}
        />

        {isMock && (
          <p className="text-xs text-[var(--text-muted)] text-center">
            * Datos de ejemplo generados para visualización
          </p>
        )}
      </div>

      {/* ─── Lista de días ─────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
          Días recientes
        </h3>
        <div className="space-y-3">
          {dailyCards.map((entry) => (
            <DailyScoreCard key={entry.date} entry={entry} />
          ))}
          {dailyCards.length === 0 && (
            <div className="card text-center py-8">
              <p className="text-sm text-[var(--text-muted)]">
                Sin registros para este período
              </p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

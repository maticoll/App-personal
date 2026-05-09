"use client";

// ============================================================
// ScoreTrendChart — Gráfico de líneas temporal con Recharts
// Muestra evolución de scores (global + por módulo)
// Sesión 2 — Dashboard + Scoring
// ============================================================

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { HistoricalScoreEntry } from "@/lib/scoring";
import type { Period } from "./PeriodSelector";

interface ScoreTrendChartProps {
  data: HistoricalScoreEntry[];
  period: Period;
  activeModules?: ("sleep" | "fitness" | "nutrition" | "projects")[];
  showGlobal?: boolean;
  height?: number;
}

const MODULE_COLORS = {
  global: "#6366F1",    // Indigo accent
  sleep: "#8B5CF6",     // Violeta
  fitness: "#06B6D4",   // Cyan
  nutrition: "#10B981", // Esmeralda
  projects: "#F59E0B",  // Ámbar
} as const;

const MODULE_LABELS = {
  global: "Global",
  sleep: "Sueño",
  fitness: "Fitness",
  nutrition: "Nutrición",
  projects: "Proyectos",
} as const;

function formatXAxis(dateStr: string, period: Period): string {
  try {
    const d = parseISO(dateStr);
    if (period === "daily") return format(d, "d MMM", { locale: es });
    if (period === "weekly") return format(d, "d/MM", { locale: es });
    return format(d, "MMM", { locale: es });
  } catch {
    return dateStr;
  }
}

// Tooltip personalizado
interface TooltipPayload {
  name: string;
  value: number | null;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length || !label) return null;

  let dateLabel = label;
  try {
    dateLabel = format(parseISO(label), "EEEE d 'de' MMMM", { locale: es });
  } catch {
    // keep original
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 shadow-lg text-xs space-y-1.5">
      <p className="font-medium text-[var(--text-primary)] capitalize mb-2">
        {dateLabel}
      </p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-[var(--text-secondary)]">{entry.name}:</span>
          <span className="font-bold" style={{ color: entry.color }}>
            {entry.value !== null && entry.value !== undefined
              ? `${entry.value}/100`
              : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ScoreTrendChart({
  data,
  period,
  activeModules = [],
  showGlobal = true,
  height = 220,
}: ScoreTrendChartProps) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-[var(--text-muted)] text-sm"
        style={{ height }}
      >
        Sin datos para este período
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={data}
        margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border)"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tickFormatter={(v) => formatXAxis(v, period)}
          tick={{ fontSize: 11, fill: "var(--text-muted)" }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: "var(--text-muted)" }}
          axisLine={false}
          tickLine={false}
          tickCount={5}
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
          formatter={(value) => (
            <span style={{ color: "var(--text-secondary)" }}>{value}</span>
          )}
        />

        {/* Línea global */}
        {showGlobal && (
          <Line
            type="monotone"
            dataKey="global"
            name={MODULE_LABELS.global}
            stroke={MODULE_COLORS.global}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, strokeWidth: 0 }}
            connectNulls={false}
          />
        )}

        {/* Líneas por módulo */}
        {activeModules.map((mod) => (
          <Line
            key={mod}
            type="monotone"
            dataKey={mod}
            name={MODULE_LABELS[mod]}
            stroke={MODULE_COLORS[mod]}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
            strokeDasharray="4 2"
            connectNulls={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

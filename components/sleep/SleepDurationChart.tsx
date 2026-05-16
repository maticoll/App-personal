"use client";

// ============================================================
// SleepDurationChart — Gráfico de barras de duración (7 días)
// Recharts BarChart con rangos de referencia
// ============================================================

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { formatDuration } from "@/lib/utils";
import type { SleepLogEntry } from "@/lib/sleep";

type Props = {
  history: SleepLogEntry[];
  days?: number;
};

type ChartEntry = {
  date: string;
  label: string;
  hours: number | null;
  minutes: number | null;
  color: string;
};

function getBarColor(minutes: number | null): string {
  if (minutes === null) return "#374151"; // gray-700
  const h = minutes / 60;
  if (h >= 7 && h <= 9) return "#8B5CF6"; // module-sleep / ideal
  if (h >= 6 && h <= 10) return "#A78BFA"; // aceptable
  return "#EF4444"; // fuera de rango
}

const DAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

// Custom tooltip
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number | null; payload: ChartEntry }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0].payload;
  return (
    <div className="bg-surface-container border border-outline-variant/20 rounded-xl p-3 text-sm shadow-xl">
      <p className="font-semibold text-on-surface mb-1">{label}</p>
      {entry.minutes !== null ? (
        <>
          <p className="text-on-surface-variant">
            {formatDuration(entry.minutes)}
          </p>
          <p className="text-xs text-outline mt-0.5">
            {entry.hours !== null && entry.hours >= 7 && entry.hours <= 9
              ? "✅ Rango ideal"
              : entry.hours !== null && entry.hours >= 6 && entry.hours <= 10
              ? "🟡 Aceptable"
              : "🔴 Fuera de rango"}
          </p>
        </>
      ) : (
        <p className="text-outline">Sin registro</p>
      )}
    </div>
  );
}

export function SleepDurationChart({ history, days = 7 }: Props) {
  // Generar los últimos N días con o sin datos
  const data: ChartEntry[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dStr = d.toISOString().split("T")[0];

    const log = history.find(
      (l) => l.date.toString().split("T")[0] === dStr
    );

    const minutes = log?.durationMinutes ?? null;
    const hours = minutes !== null ? Math.round((minutes / 60) * 10) / 10 : null;

    data.push({
      date: dStr,
      label: DAYS_ES[d.getDay()],
      hours,
      minutes,
      color: getBarColor(minutes),
    });
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-on-surface-variant">
          Duración (últimos {days} días)
        </h3>
        <div className="flex items-center gap-3 text-xs text-outline">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />
            Ideal
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-violet-300 inline-block" />
            Aceptable
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 0, left: -20, bottom: 0 }}
          barSize={days <= 7 ? 28 : 16}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 10]}
            ticks={[0, 4, 6, 7, 8, 9, 10]}
            tick={{ fill: "var(--text-muted)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => (v === 0 ? "" : `${v}h`)}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          {/* Rango ideal */}
          <ReferenceLine
            y={7}
            stroke="#22C55E"
            strokeDasharray="4 4"
            strokeOpacity={0.4}
            label={{
              value: "7h",
              fill: "var(--text-muted)",
              fontSize: 9,
              position: "right",
            }}
          />
          <ReferenceLine
            y={9}
            stroke="#22C55E"
            strokeDasharray="4 4"
            strokeOpacity={0.4}
            label={{
              value: "9h",
              fill: "var(--text-muted)",
              fontSize: 9,
              position: "right",
            }}
          />
          <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} opacity={entry.hours === null ? 0.3 : 1} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

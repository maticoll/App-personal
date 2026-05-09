"use client";

// ============================================================
// SleepQualityChart — Score Garmin + duración últimos 14 días
// Recharts ComposedChart: Area (calidad) + Line (duración normalizada)
// ============================================================

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { SleepLogEntry } from "@/lib/sleep";
import { formatDuration } from "@/lib/utils";

type Props = {
  history: SleepLogEntry[];
};

type ChartEntry = {
  label: string;
  date: string;
  garminScore: number | null;
  durationH: number | null;
  durationMin: number | null;
};

const DAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number | null; name: string; payload: ChartEntry }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0].payload;
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 text-sm shadow-xl space-y-1">
      <p className="font-semibold text-[var(--text-primary)]">{label}</p>
      {entry.garminScore !== null && (
        <p className="text-[var(--text-secondary)]">
          <span className="text-module-sleep font-medium">
            {entry.garminScore}/100
          </span>{" "}
          Garmin
        </p>
      )}
      {entry.durationMin !== null && (
        <p className="text-[var(--text-secondary)]">
          <span className="text-amber-400 font-medium">
            {formatDuration(entry.durationMin)}
          </span>{" "}
          duración
        </p>
      )}
      {entry.garminScore === null && entry.durationMin === null && (
        <p className="text-[var(--text-muted)]">Sin datos</p>
      )}
    </div>
  );
}

export function SleepQualityChart({ history }: Props) {
  const days = 14;
  const data: ChartEntry[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dStr = d.toISOString().split("T")[0];

    const log = history.find(
      (l) => l.date.toString().split("T")[0] === dStr
    );

    const durationMin = log?.durationMinutes ?? null;
    // Normalizar duración a escala 0-100 para superponerla con el score Garmin
    // 0h=0, 8h=100, se satura en 100
    const durationH = durationMin !== null ? durationMin / 60 : null;
    const durationNorm = durationH !== null ? Math.min((durationH / 9) * 100, 100) : null;

    data.push({
      label: DAYS_ES[d.getDay()],
      date: dStr,
      garminScore: log?.garminScore ?? null,
      durationH: durationNorm,
      durationMin,
    });
  }

  const hasGarminData = data.some((d) => d.garminScore !== null);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)]">
          {hasGarminData ? "Calidad Garmin (14 días)" : "Duración (14 días)"}
        </h3>
        {hasGarminData && (
          <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />
              Garmin
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              Duración
            </span>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 0, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="garminGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--text-muted)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tick={{ fill: "var(--text-muted)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            y={70}
            stroke="#22C55E"
            strokeDasharray="4 4"
            strokeOpacity={0.3}
          />
          {hasGarminData && (
            <Area
              type="monotone"
              dataKey="garminScore"
              stroke="#8B5CF6"
              strokeWidth={2}
              fill="url(#garminGrad)"
              connectNulls={false}
              dot={{ r: 3, fill: "#8B5CF6", strokeWidth: 0 }}
              activeDot={{ r: 5, fill: "#8B5CF6" }}
            />
          )}
          <Line
            type="monotone"
            dataKey="durationH"
            stroke="#F59E0B"
            strokeWidth={hasGarminData ? 1.5 : 2.5}
            strokeDasharray={hasGarminData ? "4 3" : undefined}
            connectNulls={false}
            dot={{ r: 2, fill: "#F59E0B", strokeWidth: 0 }}
            activeDot={{ r: 4, fill: "#F59E0B" }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {!hasGarminData && (
        <p className="text-xs text-center text-[var(--text-muted)] mt-2">
          Conectá Garmin para ver el score de calidad del sueño
        </p>
      )}
    </div>
  );
}

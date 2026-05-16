"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { WeeklyStatEntry } from "@/lib/fitness";

const DAY_SHORT: Record<string, string> = {
  "0": "Dom",
  "1": "Lun",
  "2": "Mar",
  "3": "Mié",
  "4": "Jue",
  "5": "Vie",
  "6": "Sáb",
};

function getDayShort(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return DAY_SHORT[String(d.getDay())] ?? dateStr.slice(5);
}

function formatMinutes(min: number): string {
  if (min === 0) return "0";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const entry = payload[0]?.payload as WeeklyStatEntry;

  return (
    <div className="bg-surface-container border border-outline-variant/20 rounded-xl p-3 shadow-lg">
      <p className="text-xs font-semibold text-on-surface mb-2">{label}</p>
      {entry.gymMinutes > 0 && (
        <p className="text-xs text-module-fitness">
          Gym: {formatMinutes(entry.gymMinutes)}
        </p>
      )}
      {entry.cardioMinutes > 0 && (
        <p className="text-xs text-orange-400">
          Cardio: {formatMinutes(entry.cardioMinutes)}
        </p>
      )}
      {entry.totalMinutes > 0 && (
        <p className="text-xs text-outline mt-1">
          Total: {formatMinutes(entry.totalMinutes)}
        </p>
      )}
      {entry.totalMinutes === 0 && (
        <p className="text-xs text-outline">Sin actividad</p>
      )}
    </div>
  );
}

type Props = {
  data: WeeklyStatEntry[];
};

export default function WeeklyVolumeChart({ data }: Props) {
  const chartData = data.map((d) => ({
    ...d,
    day: getDayShort(d.date),
  }));

  const maxMinutes = Math.max(...data.map((d) => d.totalMinutes), 60);
  const hasData = data.some((d) => d.totalMinutes > 0);

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-on-surface">
          Volumen semanal
        </h3>
        <span className="text-xs text-outline">Últimos 7 días</span>
      </div>

      {!hasData ? (
        <div className="text-center py-8 text-outline text-sm">
          Sin actividades registradas esta semana
        </div>
      ) : (
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barSize={28} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <XAxis
                dataKey="day"
                tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={formatMinutes}
                tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                domain={[0, maxMinutes + 20]}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="totalMinutes" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={
                      entry.gymMinutes > 0
                        ? "#06B6D4" // cyan para gym
                        : entry.cardioMinutes > 0
                        ? "#F97316" // naranja para cardio
                        : entry.totalMinutes > 0
                        ? "#8B5CF6" // violeta para otro
                        : "#464554"
                    }
                    fillOpacity={entry.totalMinutes > 0 ? 0.85 : 0.4}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Leyenda */}
      <div className="flex items-center gap-4 text-xs text-outline">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-module-fitness opacity-85 inline-block" />
          Gym
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-orange-400 opacity-85 inline-block" />
          Cardio
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-purple-400 opacity-85 inline-block" />
          Otro
        </div>
      </div>
    </div>
  );
}

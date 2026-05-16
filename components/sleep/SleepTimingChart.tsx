"use client";

// ============================================================
// SleepTimingChart — Horarios de sueño (7 días)
// Muestra ventanas de sueño como barras flotantes
// Y-axis: "horas desde las 9 PM" (offset visual)
// ============================================================

import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { formatTime } from "@/lib/utils";
import type { SleepLogEntry } from "@/lib/sleep";

type Props = {
  history: SleepLogEntry[];
};

type ChartEntry = {
  label: string;
  date: string;
  // "Horas desde las 9 PM del día anterior"
  // bedOffset: cuántas horas después de las 9 PM empezó el sueño
  bedOffset: number | null;
  // duration en horas
  duration: number | null;
  // referencias para tooltip
  bedTime: Date | null;
  wakeTime: Date | null;
};

const DAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

// Convertir hora a "horas desde las 9 PM"
// 9 PM = 0, 10 PM = 1, 11 PM = 2, 12 AM = 3, 1 AM = 4, ..., 8 AM = 11
function timeToOffset(date: Date): number {
  const h = date.getHours() + date.getMinutes() / 60;
  // Si la hora es después de las 9 PM (≥21) o antes de mediodía
  if (h >= 21) return h - 21; // 21 → 0, 23.5 → 2.5
  if (h < 12) return h + 3; // 0 → 3, 6 → 9, 7.5 → 10.5
  return 0; // Fuera de rango esperado (siestas diurnas)
}

// Eje Y: de 0 a 13 (9 PM → 10 AM siguiente día)
// Ticks: cada 2h con label de hora real
const Y_TICKS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const Y_LABELS: Record<number, string> = {
  0: "9 PM",
  1: "10 PM",
  2: "11 PM",
  3: "12 AM",
  4: "1 AM",
  5: "2 AM",
  6: "3 AM",
  7: "4 AM",
  8: "5 AM",
  9: "6 AM",
  10: "7 AM",
  11: "8 AM",
  12: "9 AM",
  13: "10 AM",
};

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartEntry }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0].payload;
  return (
    <div className="bg-surface-container border border-outline-variant/20 rounded-xl p-3 text-sm shadow-xl">
      <p className="font-semibold text-on-surface mb-2">{label}</p>
      {entry.bedTime && (
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-violet-500" />
            <span className="text-outline">Dormiste:</span>
            <span className="font-medium text-on-surface">
              {formatTime(entry.bedTime)}
            </span>
          </div>
          {entry.wakeTime && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-outline">Desperté:</span>
              <span className="font-medium text-on-surface">
                {formatTime(entry.wakeTime)}
              </span>
            </div>
          )}
          {entry.duration !== null && (
            <div className="flex items-center gap-1.5 pt-1 border-t border-outline-variant/20">
              <span className="text-outline">Duración:</span>
              <span className="font-medium text-module-sleep">
                {Math.floor(entry.duration)}h{" "}
                {Math.round((entry.duration % 1) * 60)}min
              </span>
            </div>
          )}
        </div>
      )}
      {!entry.bedTime && (
        <p className="text-xs text-outline">Sin registro</p>
      )}
    </div>
  );
}

export function SleepTimingChart({ history }: Props) {
  const days = 7;
  const today = new Date();
  const data: ChartEntry[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dStr = d.toISOString().split("T")[0];

    const log = history.find(
      (l) => l.date.toString().split("T")[0] === dStr
    );

    if (log?.bedTime) {
      const bedOffset = timeToOffset(new Date(log.bedTime));
      const wakeOffset = log.wakeTime ? timeToOffset(new Date(log.wakeTime)) : null;
      const duration = wakeOffset !== null ? wakeOffset - bedOffset : null;

      data.push({
        label: DAYS_ES[d.getDay()],
        date: dStr,
        bedOffset,
        duration: duration ?? null,
        bedTime: new Date(log.bedTime),
        wakeTime: log.wakeTime ? new Date(log.wakeTime) : null,
      });
    } else {
      data.push({
        label: DAYS_ES[d.getDay()],
        date: dStr,
        bedOffset: null,
        duration: null,
        bedTime: null,
        wakeTime: null,
      });
    }
  }

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-on-surface-variant mb-4">
        Horarios de sueño (últimos 7 días)
      </h3>

      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 0, left: -4, bottom: 0 }}
          barSize={20}
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
            domain={[0, 13]}
            ticks={[0, 2, 3, 5, 8, 10, 13]}
            tick={{ fill: "var(--text-muted)", fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => Y_LABELS[v] ?? ""}
            reversed // Invertir: 9PM arriba, 10AM abajo
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          {/* Hora ideal de dormir: 10 PM – 11 PM = offset 1–2 */}
          <ReferenceLine
            y={2}
            stroke="#22C55E"
            strokeDasharray="4 4"
            strokeOpacity={0.35}
            label={{ value: "Ideal", fill: "var(--text-muted)", fontSize: 9, position: "right" }}
          />
          {/* La barra transparente "empuja" hacia abajo hasta la hora de dormir */}
          <Bar dataKey="bedOffset" stackId="sleep" fill="transparent" radius={0} />
          {/* La barra coloreada representa la ventana de sueño */}
          <Bar dataKey="duration" stackId="sleep" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.duration ? "#8B5CF6" : "transparent"}
                opacity={entry.duration ? 0.85 : 0}
              />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>

      <p className="text-xs text-center text-outline mt-1">
        Cada barra muestra la ventana de sueño (hora de dormir → despertar)
      </p>
    </div>
  );
}

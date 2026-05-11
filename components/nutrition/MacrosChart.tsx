"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type Props = {
  proteinG: number;
  carbsG: number;
  fatG: number;
  calories: number | null;
};

const COLORS = {
  Proteínas: "#6366F1",
  Carbohidratos: "#06B6D4",
  Grasas: "#F59E0B",
};

export default function MacrosChart({ proteinG, carbsG, fatG, calories }: Props) {
  const total = proteinG + carbsG + fatG;
  if (total === 0) return null;

  const data = [
    { name: "Proteínas", value: Math.round(proteinG), unit: "g" },
    { name: "Carbohidratos", value: Math.round(carbsG), unit: "g" },
    { name: "Grasas", value: Math.round(fatG), unit: "g" },
  ].filter((d) => d.value > 0);

  return (
    <div className="rounded-xl bg-surface border border-white/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-text-primary">Macros del día</h3>
        {calories !== null && (
          <span className="text-xs text-text-muted">
            ~{Math.round(calories)} kcal total
          </span>
        )}
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={75}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={COLORS[entry.name as keyof typeof COLORS]}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [`${value}g`, name]}
              contentStyle={{
                background: "#1A1D27",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                color: "#E2E8F0",
              }}
            />
            <Legend
              formatter={(value) => (
                <span style={{ color: "#94A3B8", fontSize: "12px" }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2">
        {data.map((d) => (
          <div key={d.name} className="text-center">
            <p className="text-xs text-text-muted">{d.name}</p>
            <p className="text-sm font-semibold text-text-primary">
              {d.value}g
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";

type Props = {
  totalThermos: number;
  goalThermos: number;
  onLogged: () => void;
};

export default function WaterTracker({ totalThermos, goalThermos, onLogged }: Props) {
  const [loading, setLoading] = useState(false);

  const filled = Math.round(totalThermos);
  const total = Math.max(Math.ceil(goalThermos), filled);
  const liters = (totalThermos * 0.5).toFixed(1);
  const goalLiters = (goalThermos * 0.5).toFixed(1);

  const handleAdd = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/nutrition/water", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thermos: 1 }),
      });
      if (!res.ok) throw new Error();
      onLogged();
    } catch { /* silently fail */ } finally { setLoading(false); }
  };

  return (
    <section className="glass-card p-4 rounded-2xl">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <span
            className="material-symbols-outlined text-accent-emerald text-[22px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            water_drop
          </span>
          <h3 className="text-xl font-bold text-on-surface">Hydration</h3>
        </div>
        <span className="text-sm text-on-surface-variant">{liters}L / {goalLiters}L</span>
      </div>

      <div className="flex justify-between items-center bg-surface-container-lowest px-4 py-3 rounded-xl border border-outline-variant/10">
        {/* Thermos icons */}
        <div className="flex gap-1 flex-wrap">
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className="material-symbols-outlined text-[22px]"
              style={{
                fontVariationSettings: "'FILL' 1",
                color: i < filled ? "#10B981" : "rgba(255,255,255,0.15)",
              }}
            >
              thermometer
            </span>
          ))}
        </div>

        {/* Button */}
        <button
          onClick={handleAdd}
          disabled={loading}
          className="ml-3 flex-shrink-0 bg-accent-emerald text-[#0D0F14] font-bold px-4 py-2 rounded-full text-sm active:scale-95 transition-all disabled:opacity-60"
        >
          {loading ? "..." : "+ 500ml"}
        </button>
      </div>
    </section>
  );
}

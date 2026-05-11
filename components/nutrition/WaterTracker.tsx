"use client";

import { useState } from "react";

type Props = {
  totalThermos: number;
  goalThermos: number;
  onLogged: () => void;
};

function ThermosIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`w-8 h-8 transition-colors ${
        filled ? "text-blue-400" : "text-white/15"
      }`}
    >
      <path
        d="M7 2h10M8 2v2a1 1 0 000 2h8a1 1 0 000-2V2M6 6h12l-1 14a2 2 0 01-2 2H9a2 2 0 01-2-2L6 6z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={filled ? "currentColor" : "none"}
        fillOpacity={filled ? 0.2 : 0}
      />
      {filled && (
        <path
          d="M6 14h12"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity={0.5}
        />
      )}
    </svg>
  );
}

export default function WaterTracker({ totalThermos, goalThermos, onLogged }: Props) {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const filledCount = Math.min(Math.round(totalThermos), Math.ceil(goalThermos));
  const totalIcons = Math.max(Math.ceil(goalThermos), filledCount);
  const percentage = Math.min((totalThermos / goalThermos) * 100, 100);

  const handleAddWater = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/nutrition/water", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thermos: 1 }),
      });
      if (!res.ok) throw new Error();
      setFeedback("💧 +1 termo registrado");
      setTimeout(() => setFeedback(null), 3000);
      onLogged();
    } catch {
      setFeedback("Error registrando agua");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl bg-surface border border-white/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-text-primary">Hidratación</h3>
        <span className="text-xs text-text-muted">
          {totalThermos.toFixed(1)}/{goalThermos.toFixed(1)} termos
        </span>
      </div>

      {/* Iconos de termos */}
      <div className="flex flex-wrap gap-2 mb-3">
        {Array.from({ length: totalIcons }).map((_, i) => (
          <ThermosIcon key={i} filled={i < filledCount} />
        ))}
      </div>

      {/* Barra de progreso */}
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            percentage >= 100 ? "bg-emerald-400" : "bg-blue-400"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleAddWater}
          disabled={loading}
          className="flex-1 py-2 rounded-lg bg-blue-500/20 text-blue-400 text-sm font-medium hover:bg-blue-500/30 transition-colors disabled:opacity-50"
        >
          {loading ? "Registrando..." : "💧 +1 Termo"}
        </button>
        {percentage >= 100 && (
          <span className="text-emerald-400 text-xs font-medium">✓ Meta cumplida</span>
        )}
      </div>

      {feedback && (
        <p className="text-xs text-text-muted mt-2 text-center">{feedback}</p>
      )}
    </div>
  );
}

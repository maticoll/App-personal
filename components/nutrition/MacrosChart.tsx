"use client";

type Props = {
  proteinG: number;
  carbsG: number;
  fatG: number;
  calories: number | null;
};

// Calcula el stroke-dashoffset para un arco SVG en un círculo r=45, circunferencia=282.7
function calcOffset(value: number, total: number): number {
  if (total === 0) return 282.7;
  const pct = Math.min(value / total, 1);
  return 282.7 * (1 - pct);
}

export default function MacrosChart({ proteinG, carbsG, fatG, calories }: Props) {
  const total = proteinG + carbsG + fatG;

  // Offsets acumulados para cada arco (apilados)
  const proteinPct = total > 0 ? proteinG / total : 0;
  const carbsPct = total > 0 ? carbsG / total : 0;
  const fatPct = total > 0 ? fatG / total : 0;

  const CIRC = 282.7;
  const proteinDash = CIRC * proteinPct;
  const carbsDash = CIRC * carbsPct;
  const fatDash = CIRC * fatPct;

  // Para apilar los arcos usamos rotation
  const proteinRot = 0;
  const carbsRot = proteinPct * 360;
  const fatRot = (proteinPct + carbsPct) * 360;

  const hasData = total > 0;

  return (
    <section className="flex flex-col items-center glass-card rounded-2xl p-4">
      {/* Ring */}
      <div className="relative w-56 h-56 flex items-center justify-center">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          {/* Track */}
          <circle
            cx="50" cy="50" r="45" fill="none"
            stroke="rgba(255,255,255,0.06)" strokeWidth="8"
          />
          {hasData ? (
            <>
              {/* Protein — emerald */}
              <circle
                cx="50" cy="50" r="45" fill="none"
                stroke="#10B981"
                strokeWidth="8"
                strokeDasharray={`${proteinDash} ${CIRC - proteinDash}`}
                strokeDashoffset="0"
                strokeLinecap="round"
                style={{ transform: `rotate(${proteinRot}deg)`, transformOrigin: "50px 50px" }}
                className="drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]"
              />
              {/* Carbs — primary */}
              <circle
                cx="50" cy="50" r="45" fill="none"
                stroke="#c0c1ff"
                strokeWidth="8"
                strokeDasharray={`${carbsDash} ${CIRC - carbsDash}`}
                strokeDashoffset="0"
                strokeLinecap="round"
                style={{ transform: `rotate(${carbsRot}deg)`, transformOrigin: "50px 50px" }}
              />
              {/* Fat — tertiary */}
              <circle
                cx="50" cy="50" r="45" fill="none"
                stroke="#ffb783"
                strokeWidth="8"
                strokeDasharray={`${fatDash} ${CIRC - fatDash}`}
                strokeDashoffset="0"
                strokeLinecap="round"
                style={{ transform: `rotate(${fatRot}deg)`, transformOrigin: "50px 50px" }}
              />
            </>
          ) : (
            <circle cx="50" cy="50" r="45" fill="none"
              stroke="rgba(255,255,255,0.04)" strokeWidth="8" strokeDasharray="8 6" />
          )}
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
            {hasData ? "Total" : "Sin datos"}
          </span>
          <span className="text-4xl font-bold text-on-surface leading-tight">
            {calories !== null ? Math.round(calories) : "—"}
          </span>
          <span className="text-sm font-medium text-accent-emerald">kcal</span>
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-3 gap-4 w-full mt-4 px-2">
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-accent-emerald flex-shrink-0" />
            <span className="text-xs font-medium text-on-surface">Protein</span>
          </div>
          <span className="text-xl font-bold text-on-surface">{Math.round(proteinG)}g</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
            <span className="text-xs font-medium text-on-surface">Carbs</span>
          </div>
          <span className="text-xl font-bold text-on-surface">{Math.round(carbsG)}g</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "#ffb783" }} />
            <span className="text-xs font-medium text-on-surface">Fat</span>
          </div>
          <span className="text-xl font-bold text-on-surface">{Math.round(fatG)}g</span>
        </div>
      </div>
    </section>
  );
}

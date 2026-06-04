"use client";

type Props = { steps: number; goal: number; color?: string };

export default function StepsRing({ steps, goal, color = "#34D399" }: Props) {
  const pct = goal > 0 ? Math.min(steps / goal, 1) : 0;
  const reached = steps >= goal;
  const R = 70, C = 2 * Math.PI * R;
  return (
    <div className="flex justify-center my-4">
      <div className="relative w-[180px] h-[180px]">
        <svg width="180" height="180" className="-rotate-90">
          <circle cx="90" cy="90" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
          <circle
            cx="90" cy="90" r={R} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - pct)}
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-on-surface">{steps.toLocaleString("es-UY")}</span>
          <span className="text-xs" style={{ color }}>
            {reached ? "Meta cumplida ✓" : `de ${goal.toLocaleString("es-UY")} pasos`}
          </span>
        </div>
      </div>
    </div>
  );
}

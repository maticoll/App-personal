"use client";
import Link from "next/link";
import type { ActivityMeta } from "@/lib/fitness-activities";
import type { WorkoutWithExercises, ActivityTypeSummary } from "@/lib/fitness";
import StepsRing from "./StepsRing";
import ActivityLogForm from "./ActivityLogForm";
import ActivityStatsDisclosure from "./ActivityStatsDisclosure";
import HrZonesBar from "./HrZonesBar";

type Props = {
  activity: ActivityMeta;
  last: WorkoutWithExercises | null;
  week: ActivityTypeSummary;
  history: WorkoutWithExercises[];
  steps?: number;
  goal?: number;
};

const fmtPace = (mps: number | null, per = 1000): string => {
  if (!mps || mps <= 0) return "—";
  const sec = per / mps;
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};
const fmtKmh = (mps: number | null): string => (mps && mps > 0 ? (mps * 3.6).toFixed(1) : "—");
const fmtKm = (km: number | null): string => (km != null ? km.toFixed(km < 10 ? 2 : 1) : "—");

function Stat({ v, k }: { v: string; k: string }) {
  return (
    <div className="glass-card rounded-xl p-3">
      <div className="text-lg font-bold text-on-surface">{v}</div>
      <div className="text-[10px] text-on-surface-variant uppercase tracking-wide">{k}</div>
    </div>
  );
}

export default function ActivityPageClient({ activity, last, week, history, steps, goal }: Props) {
  const isWalk = activity.type === "WALKING";
  const isSwim = activity.type === "SWIMMING";
  const isBike = activity.type === "CYCLING";
  const m = (last?.garminMetrics as Record<string, unknown> | null) ?? null;
  const zones = (m?.hrZones as number[] | undefined) ?? null;

  return (
    <div className="space-y-4">
      <Link href="/fitness" className="inline-flex items-center gap-1 text-sm text-accent-cyan">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span> Volver a fitness
      </Link>
      <h1 className="text-2xl font-bold text-on-surface flex items-center gap-2">
        <span className="material-symbols-outlined" style={{ color: activity.color }}>{activity.icon}</span>
        {activity.label}
      </h1>

      {isWalk && steps != null && goal != null && <StepsRing steps={steps} goal={goal} color={activity.color} />}

      <div className="grid grid-cols-2 gap-2">
        <Stat v={fmtKm(last?.distanceKm ?? null) + (last?.distanceKm != null ? " km" : "")} k="Última distancia" />
        <Stat v={last?.calories != null ? String(last.calories) : "—"} k="Calorías" />
      </div>

      <ActivityLogForm activity={activity} />

      <ActivityStatsDisclosure>
        <div className="grid grid-cols-2 gap-2">
          {!isBike && <Stat v={fmtPace(last?.avgSpeedMps ?? null, isSwim ? 100 : 1000)} k={isSwim ? "Ritmo /100m" : "Ritmo /km"} />}
          {isBike && <Stat v={fmtKmh(last?.avgSpeedMps ?? null) + " km/h"} k="Velocidad media" />}
          {isBike && <Stat v={fmtKmh(last?.maxSpeedMps ?? null) + " km/h"} k="Velocidad máx" />}
          <Stat v={last?.avgHr != null ? `${last.avgHr} bpm` : "—"} k="FC media" />
          <Stat v={last?.maxHr != null ? String(last.maxHr) : "—"} k="FC máx" />
          {!isSwim && <Stat v={last?.elevationGainM != null ? `+${last.elevationGainM} m` : "—"} k="Desnivel" />}
          {!isSwim && last?.cadence != null && <Stat v={String(Math.round(last.cadence))} k="Cadencia" />}
          {isSwim && m?.activeLengths != null && <Stat v={String(m.activeLengths)} k="Largos" />}
          {isSwim && m?.avgSwolf != null && <Stat v={String(m.avgSwolf)} k="SWOLF" />}
          {isSwim && m?.strokes != null && <Stat v={String(m.strokes)} k="Brazadas" />}
        </div>
        {zones && (
          <div>
            <div className="text-[10px] text-on-surface-variant uppercase tracking-wide mb-1">Zonas de FC</div>
            <HrZonesBar zones={zones} />
          </div>
        )}
      </ActivityStatsDisclosure>

      <div className="glass-card rounded-xl p-3 text-sm text-on-surface-variant">
        Esta semana: <span className="text-on-surface font-semibold">{fmtKm(week.weekDistanceKm)} km</span> · {week.weekCount} {week.weekCount === 1 ? "salida" : "salidas"}
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest px-1">Historial</h3>
        {history.length === 0 && <p className="text-sm text-outline px-1">Sin actividades todavía.</p>}
        {history.map((w) => (
          <div key={w.id} className="glass-card rounded-xl px-3 py-2 flex justify-between text-sm">
            <span className="text-on-surface">{w.locationName ?? w.title ?? new Date(w.date).toLocaleDateString("es-UY")}</span>
            <span className="text-on-surface-variant">{fmtKm(w.distanceKm)} km · {w.durationMinutes ?? 0} min</span>
          </div>
        ))}
      </div>
    </div>
  );
}

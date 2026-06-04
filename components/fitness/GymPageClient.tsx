"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { GymStats, WorkoutWithExercises } from "@/lib/fitness";
import { ACTIVITIES } from "@/lib/fitness-activities";
import RoutineManager from "./RoutineManager";

export default function GymPageClient({ stats, history }: { stats: GymStats; history: WorkoutWithExercises[] }) {
  const router = useRouter();
  const gym = ACTIVITIES.gym;
  return (
    <div className="space-y-4">
      <Link href="/fitness" className="inline-flex items-center gap-1 text-sm text-accent-cyan">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span> Volver a fitness
      </Link>
      <h1 className="text-2xl font-bold text-on-surface flex items-center gap-2">
        <span className="material-symbols-outlined" style={{ color: gym.color }}>{gym.icon}</span> Gym
      </h1>

      <div className="grid grid-cols-3 gap-2">
        <div className="glass-card rounded-xl p-3"><div className="text-lg font-bold text-on-surface">{stats.weekSessions}</div><div className="text-[10px] text-on-surface-variant uppercase">Sesiones/sem</div></div>
        <div className="glass-card rounded-xl p-3"><div className="text-lg font-bold text-on-surface">{stats.weekVolumeKg.toLocaleString("es-UY")}</div><div className="text-[10px] text-on-surface-variant uppercase">Volumen/sem (kg)</div></div>
        <div className="glass-card rounded-xl p-3"><div className="text-lg font-bold text-on-surface">{stats.totalVolumeKg.toLocaleString("es-UY")}</div><div className="text-[10px] text-on-surface-variant uppercase">Última (kg)</div></div>
      </div>

      <button onClick={() => router.push("/fitness/session")} className="w-full py-3 rounded-full font-bold text-sm text-[#0D0F14]" style={{ background: gym.color }}>
        + Empezar sesión
      </button>

      <div className="space-y-2">
        <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest px-1">Rutinas</h3>
        <RoutineManager onChanged={() => router.refresh()} />
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest px-1">Historial</h3>
        {history.length === 0 && <p className="text-sm text-outline px-1">Sin sesiones todavía.</p>}
        {history.map((w) => (
          <div key={w.id} className="glass-card rounded-xl px-3 py-2 flex justify-between text-sm">
            <span className="text-on-surface">{w.title ?? "Sesión de gym"}</span>
            <span className="text-on-surface-variant">{new Date(w.date).toLocaleDateString("es-UY")} · {w.durationMinutes ?? 0} min</span>
          </div>
        ))}
      </div>
    </div>
  );
}

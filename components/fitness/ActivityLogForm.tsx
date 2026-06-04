"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ActivityMeta } from "@/lib/fitness-activities";

export default function ActivityLogForm({ activity }: { activity: ActivityMeta }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [duration, setDuration] = useState("");
  const [dist, setDist] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isSwim = activity.type === "SWIMMING";
  const needsDist = ["RUNNING", "SWIMMING", "CYCLING", "WALKING"].includes(activity.type);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErr(null);
    try {
      const distanceKm = dist ? (isSwim ? parseFloat(dist) / 1000 : parseFloat(dist)) : undefined;
      const res = await fetch("/api/fitness/workout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: activity.type,
          ...(duration && { durationMinutes: parseInt(duration) }),
          ...(distanceKm !== undefined && { distanceKm }),
        }),
      });
      if (!res.ok) throw new Error();
      setOpen(false); setDuration(""); setDist("");
      router.refresh();
    } catch {
      setErr("Error al registrar");
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-3 rounded-full font-bold text-sm text-[#0D0F14] active:scale-95 transition-all"
        style={{ background: activity.color }}
      >
        + Registrar {activity.label.toLowerCase()}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="glass-card rounded-2xl p-4 space-y-2">
      <div className={`grid gap-2 ${needsDist ? "grid-cols-2" : "grid-cols-1"}`}>
        <div>
          <label className="text-xs text-on-surface-variant mb-1 block">Duración (min)</label>
          <input type="number" min="1" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="45" className="input text-base" />
        </div>
        {needsDist && (
          <div>
            <label className="text-xs text-on-surface-variant mb-1 block">{isSwim ? "Distancia (m)" : "Distancia (km)"}</label>
            <input type="number" step={isSwim ? "10" : "0.1"} min="0" value={dist} onChange={(e) => setDist(e.target.value)} placeholder={isSwim ? "1000" : "5.0"} className="input text-base" />
          </div>
        )}
      </div>
      {err && <p className="text-xs text-red-400">{err}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2 rounded-full text-sm font-semibold text-on-surface-variant bg-white/5">Cancelar</button>
        <button type="submit" disabled={loading} className="flex-1 py-2 rounded-full text-sm font-bold text-[#0D0F14] disabled:opacity-60" style={{ background: activity.color }}>
          {loading ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </form>
  );
}

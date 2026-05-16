"use client";

import { useState } from "react";

type ActivityType = "GYM" | "RUNNING" | "SWIMMING" | "WALKING" | "CYCLING";

const ACTIVITIES: { type: ActivityType; icon: string; label: string; color: string }[] = [
  { type: "GYM",      icon: "fitness_center",  label: "Gym",     color: "#06B6D4" },
  { type: "RUNNING",  icon: "directions_run",  label: "Correr",  color: "#FB923C" },
  { type: "SWIMMING", icon: "pool",            label: "Nadar",   color: "#60A5FA" },
  { type: "WALKING",  icon: "directions_walk", label: "Caminar", color: "#34D399" },
  { type: "CYCLING",  icon: "pedal_bike",      label: "Bike",    color: "#A78BFA" },
];

type Props = { onLogged: () => void };

export default function FitnessQuickActions({ onLogged }: Props) {
  const [nlpText, setNlpText] = useState("");
  const [loading, setLoading] = useState<"gym" | "nlp" | "activity" | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<ActivityType | null>(null);
  const [duration, setDuration] = useState("");
  const [distance, setDistance] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const flash = (ok: boolean, msg: string) => {
    setFeedback({ ok, msg });
    setTimeout(() => setFeedback(null), 4000);
  };

  // ── Gym directo ───────────────────────────────────────────────
  const handleGym = async () => {
    setLoading("gym");
    try {
      const res = await fetch("/api/fitness/workout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "GYM" }),
      });
      if (!res.ok) throw new Error();
      flash(true, "¡Sesión de gym iniciada!");
      onLogged();
    } catch {
      flash(false, "Error al registrar gym");
    } finally {
      setLoading(null);
    }
  };

  // ── Actividad cardio ──────────────────────────────────────────
  const handleActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedActivity) return;
    setLoading("activity");
    try {
      const res = await fetch("/api/fitness/workout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedActivity,
          ...(duration && { durationMinutes: parseInt(duration) }),
          ...(distance && { distanceKm: parseFloat(distance) }),
        }),
      });
      if (!res.ok) throw new Error();
      flash(true, `✅ ${ACTIVITIES.find(a => a.type === selectedActivity)?.label} registrada`);
      setSelectedActivity(null);
      setDuration("");
      setDistance("");
      onLogged();
    } catch {
      flash(false, "Error al registrar");
    } finally {
      setLoading(null);
    }
  };

  // ── NLP exercise log ──────────────────────────────────────────
  const handleNLP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nlpText.trim()) return;
    setLoading("nlp");
    try {
      const res = await fetch("/api/fitness/log-exercise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: nlpText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      flash(true, data.message ?? "✅ Ejercicio registrado");
      setNlpText("");
      onLogged();
    } catch (err) {
      flash(false, err instanceof Error ? err.message : "Error al procesar");
    } finally {
      setLoading(null);
    }
  };

  const needsDistance = selectedActivity && ["RUNNING", "SWIMMING", "CYCLING", "WALKING"].includes(selectedActivity);

  return (
    <div className="space-y-4">

      {/* ── Activity pills ──────────────────────────────────── */}
      <div className="glass-card rounded-2xl p-4 space-y-3">
        <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
          Registrar actividad
        </span>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {ACTIVITIES.map(({ type, icon, label, color }) => (
            <button
              key={type}
              onClick={() => {
                if (type === "GYM") { handleGym(); return; }
                setSelectedActivity(selectedActivity === type ? null : type);
              }}
              disabled={loading === "gym"}
              className="flex-shrink-0 flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-xl transition-all active:scale-90"
              style={{
                background: selectedActivity === type
                  ? `${color}25`
                  : "rgba(255,255,255,0.04)",
                border: `1px solid ${selectedActivity === type ? color + "50" : "rgba(255,255,255,0.08)"}`,
                color,
              }}
            >
              <span className="material-symbols-outlined text-[22px]">{icon}</span>
              <span className="text-[11px] font-semibold">{label}</span>
            </button>
          ))}
        </div>

        {/* Formulario cardio (expandible) */}
        {selectedActivity && selectedActivity !== "GYM" && (
          <form onSubmit={handleActivity} className="space-y-2 pt-2 border-t border-white/10">
            <div className={`grid gap-2 ${needsDistance ? "grid-cols-2" : "grid-cols-1"}`}>
              <div>
                <label className="text-xs text-on-surface-variant mb-1 block">Duración (min)</label>
                <input
                  type="number" value={duration} onChange={(e) => setDuration(e.target.value)}
                  placeholder="45" min="1" className="input text-base"
                />
              </div>
              {needsDistance && (
                <div>
                  <label className="text-xs text-on-surface-variant mb-1 block">Distancia (km)</label>
                  <input
                    type="number" step="0.1" value={distance} onChange={(e) => setDistance(e.target.value)}
                    placeholder="5.0" min="0" className="input text-base"
                  />
                </div>
              )}
            </div>
            <button
              type="submit" disabled={loading === "activity"}
              className="w-full py-2 rounded-full text-sm font-bold text-[#0D0F14] bg-accent-cyan active:scale-95 transition-all disabled:opacity-60"
            >
              {loading === "activity" ? "Guardando..." : "Guardar"}
            </button>
          </form>
        )}
      </div>

      {/* ── NLP Quick Log (estilo Stitch) ────────────────────── */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest ml-1">
          Quick Log Exercise
        </label>
        <form onSubmit={handleNLP} className="relative">
          <div className="absolute left-4 top-4 text-accent-cyan font-mono text-sm select-none">&gt;</div>
          <textarea
            value={nlpText}
            onChange={(e) => setNlpText(e.target.value)}
            placeholder="Bench press 100kg 3x8..."
            rows={3}
            className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-2xl pt-4 pl-9 pr-14 pb-4 text-on-surface font-mono text-sm focus:ring-1 focus:ring-accent-cyan focus:border-accent-cyan transition-all resize-none outline-none"
          />
          <button
            type="submit"
            disabled={!nlpText.trim() || loading === "nlp"}
            className="absolute right-3 bottom-3 w-10 h-10 rounded-full bg-accent-cyan text-[#0D0F14] flex items-center justify-center shadow-lg active:scale-90 transition-transform disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[20px]">
              {loading === "nlp" ? "hourglass_empty" : "send"}
            </span>
          </button>
        </form>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`text-sm px-4 py-3 rounded-2xl border ${
          feedback.ok
            ? "bg-[#10B981]/10 text-[#34D399] border-[#10B981]/20"
            : "bg-[#EF4444]/10 text-[#F87171] border-[#EF4444]/20"
        }`}>
          {feedback.msg}
        </div>
      )}
    </div>
  );
}

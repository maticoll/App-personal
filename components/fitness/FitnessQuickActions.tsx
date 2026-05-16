"use client";

import { useState } from "react";
import { Dumbbell, Timer, Droplets, MapPin, Bike, ChevronUp, Send } from "lucide-react";

type ActivityType = "GYM" | "RUNNING" | "SWIMMING" | "WALKING" | "CYCLING";

const ACTIVITY_CONFIG: Record<
  ActivityType,
  { label: string; icon: React.ReactNode; color: string }
> = {
  GYM: {
    label: "Gym",
    icon: <Dumbbell className="w-5 h-5" />,
    color: "text-module-fitness bg-[#06B6D4]/10 hover:bg-[#06B6D4]/20",
  },
  RUNNING: {
    label: "Correr",
    icon: <Timer className="w-5 h-5" />,
    color: "text-orange-400 bg-orange-400/10 hover:bg-orange-400/20",
  },
  SWIMMING: {
    label: "Nadar",
    icon: <Droplets className="w-5 h-5" />,
    color: "text-blue-400 bg-blue-400/10 hover:bg-blue-400/20",
  },
  WALKING: {
    label: "Caminar",
    icon: <MapPin className="w-5 h-5" />,
    color: "text-green-400 bg-green-400/10 hover:bg-green-400/20",
  },
  CYCLING: {
    label: "Ciclismo",
    icon: <Bike className="w-5 h-5" />,
    color: "text-purple-400 bg-purple-400/10 hover:bg-purple-400/20",
  },
};

type Props = {
  onLogged: () => void;
};

export default function FitnessQuickActions({ onLogged }: Props) {
  const [nlpText, setNlpText] = useState("");
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [selectedType, setSelectedType] = useState<ActivityType>("RUNNING");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [loading, setLoading] = useState<"gym" | "nlp" | "activity" | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const showFeedback = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  // Registrar gym (inicio de sesión)
  const handleGym = async () => {
    setLoading("gym");
    try {
      const res = await fetch("/api/fitness/workout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "GYM" }),
      });
      if (!res.ok) throw new Error("Error al registrar gym");
      showFeedback("success", "¡Sesión de gym iniciada! Ahora podés loguear los ejercicios.");
      onLogged();
    } catch {
      showFeedback("error", "Error al registrar gym");
    } finally {
      setLoading(null);
    }
  };

  // Abrir formulario para una actividad
  const openForm = (type: ActivityType) => {
    setSelectedType(type);
    setShowActivityForm(true);
    setDurationMinutes("");
    setDistanceKm("");
  };

  // Registrar actividad cardiovascular
  const handleActivitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading("activity");
    try {
      const body = {
        type: selectedType,
        ...(durationMinutes && { durationMinutes: parseInt(durationMinutes) }),
        ...(distanceKm && { distanceKm: parseFloat(distanceKm) }),
      };
      const res = await fetch("/api/fitness/workout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Error al registrar actividad");
      showFeedback(
        "success",
        `¡${ACTIVITY_CONFIG[selectedType].label} registrada!${durationMinutes ? ` ${durationMinutes} min` : ""}${distanceKm ? ` · ${distanceKm} km` : ""}`
      );
      setShowActivityForm(false);
      onLogged();
    } catch {
      showFeedback("error", "Error al registrar actividad");
    } finally {
      setLoading(null);
    }
  };

  // Parsear ejercicio con NLP (Claude API)
  const handleNLPSubmit = async (e: React.FormEvent) => {
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
      if (!res.ok) throw new Error(data.error ?? "Error al parsear");
      showFeedback("success", data.message ?? "✅ Ejercicio registrado");
      setNlpText("");
      onLogged();
    } catch (e: unknown) {
      showFeedback(
        "error",
        e instanceof Error ? e.message : "Error al procesar el ejercicio"
      );
    } finally {
      setLoading(null);
    }
  };

  const showDistanceField = ["RUNNING", "SWIMMING", "CYCLING", "WALKING"].includes(
    selectedType
  );

  return (
    <div className="card space-y-4">
      <h3 className="font-semibold text-on-surface">Registrar actividad</h3>

      {/* Quick buttons */}
      <div className="grid grid-cols-5 gap-2">
        {/* Gym — acción directa */}
        <button
          onClick={handleGym}
          disabled={loading === "gym"}
          className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-colors disabled:opacity-50 ${ACTIVITY_CONFIG.GYM.color}`}
        >
          {ACTIVITY_CONFIG.GYM.icon}
          <span className="text-xs font-medium">{ACTIVITY_CONFIG.GYM.label}</span>
        </button>

        {/* Actividades cardiovasculares — abren formulario */}
        {(["RUNNING", "SWIMMING", "WALKING", "CYCLING"] as ActivityType[]).map(
          (type) => (
            <button
              key={type}
              onClick={() => openForm(type)}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-colors ${ACTIVITY_CONFIG[type].color}`}
            >
              {ACTIVITY_CONFIG[type].icon}
              <span className="text-xs font-medium">{ACTIVITY_CONFIG[type].label}</span>
            </button>
          )
        )}
      </div>

      {/* Formulario de actividad */}
      {showActivityForm && (
        <form
          onSubmit={handleActivitySubmit}
          className="space-y-3 pt-3 border-t border-outline-variant/20"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-on-surface">
              {ACTIVITY_CONFIG[selectedType].label}
            </span>
            <button
              type="button"
              onClick={() => setShowActivityForm(false)}
              className="text-outline hover:text-on-surface-variant"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
          <div className={`grid gap-2 ${showDistanceField ? "grid-cols-2" : "grid-cols-1"}`}>
            <div>
              <label className="text-xs text-on-surface-variant mb-1 block">
                Duración (min)
              </label>
              <input
                type="number"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                placeholder="45"
                min="1"
                className="input text-base"
              />
            </div>
            {showDistanceField && (
              <div>
                <label className="text-xs text-on-surface-variant mb-1 block">
                  Distancia (km)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(e.target.value)}
                  placeholder="5.0"
                  min="0"
                  className="input text-base"
                />
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={loading === "activity"}
            className="btn-primary w-full text-sm"
          >
            {loading === "activity" ? "Guardando..." : "Guardar actividad"}
          </button>
        </form>
      )}

      {/* NLP exercise logging */}
      <div className="pt-3 border-t border-outline-variant/20 space-y-2">
        <label className="text-xs text-on-surface-variant block">
          Ejercicios del gym en lenguaje natural
        </label>
        <form onSubmit={handleNLPSubmit} className="flex gap-2">
          <input
            type="text"
            value={nlpText}
            onChange={(e) => setNlpText(e.target.value)}
            placeholder='ej: "press plano 100kg 4 reps 3 series"'
            className="input flex-1 text-base"
          />
          <button
            type="submit"
            disabled={!nlpText.trim() || loading === "nlp"}
            className="btn-primary px-3 flex items-center gap-1 disabled:opacity-50"
          >
            {loading === "nlp" ? (
              <span className="text-sm">...</span>
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          className={`text-sm px-3 py-2 rounded-xl ${
            feedback.type === "success"
              ? "bg-green-500/10 text-green-400 border border-green-500/20"
              : "bg-red-500/10 text-red-400 border border-red-500/20"
          }`}
        >
          {feedback.message}
        </div>
      )}
    </div>
  );
}

"use client";

// ============================================================
// RetroSleepLogger — Modal para cargar sueño retroactivo
// Dos ruedas: hora de dormir (ayer) + hora de despertar (hoy)
// ============================================================

import { useState } from "react";
import TimeWheelPicker from "./TimeWheelPicker";

type Step = "bed" | "wake";

type Props = {
  onLogged: () => void;
  onClose: () => void;
};

export default function RetroSleepLogger({ onLogged, onClose }: Props) {
  const now = new Date();

  // Defaults: dormir 23:00 ayer, despertar hora actual
  const [step, setStep] = useState<Step>("bed");
  const [bedHour, setBedHour] = useState(23);
  const [bedMin, setBedMin] = useState(0);
  const [wakeHour, setWakeHour] = useState(now.getHours());
  const [wakeMin, setWakeMin] = useState(now.getMinutes());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Construir fecha ISO: bedTime = ayer, wakeTime = hoy
  function buildBedTime() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(bedHour, bedMin, 0, 0);
    return d.toISOString();
  }

  function buildWakeTime() {
    const d = new Date();
    d.setHours(wakeHour, wakeMin, 0, 0);
    return d.toISOString();
  }

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sleep/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "manual",
          bedTime: buildBedTime(),
          wakeTime: buildWakeTime(),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Error al guardar");
      }
      onLogged();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-surface-container rounded-t-3xl pb-safe overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-outline-variant/40" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3">
          <button onClick={onClose} className="text-sm text-on-surface-variant active:opacity-60">
            Cancelar
          </button>
          <h2 className="text-base font-bold text-on-surface">Cargar sueño</h2>
          <div className="w-16" />
        </div>

        {/* Step tabs */}
        <div className="flex mx-6 mb-2 bg-surface-container-high rounded-xl p-1 gap-1">
          {(["bed", "wake"] as Step[]).map((s) => (
            <button
              key={s}
              onClick={() => setStep(s)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                step === s
                  ? "bg-[#7C3AED] text-white shadow"
                  : "text-on-surface-variant"
              }`}
            >
              {s === "bed" ? "Me dormí" : "Me desperté"}
            </button>
          ))}
        </div>

        {/* Context label */}
        <p className="text-xs text-on-surface-variant text-center mb-1">
          {step === "bed"
            ? `Anoche — ${new Date(Date.now() - 86400000).toLocaleDateString("es-UY", { weekday: "long", day: "numeric", month: "short" })}`
            : `Hoy — ${new Date().toLocaleDateString("es-UY", { weekday: "long", day: "numeric", month: "short" })}`}
        </p>

        {/* Wheel picker */}
        {step === "bed" ? (
          <TimeWheelPicker
            hour={bedHour} minute={bedMin}
            onHourChange={setBedHour} onMinuteChange={setBedMin}
          />
        ) : (
          <TimeWheelPicker
            hour={wakeHour} minute={wakeMin}
            onHourChange={setWakeHour} onMinuteChange={setWakeMin}
          />
        )}

        {/* Summary */}
        <div className="flex justify-center gap-8 py-3">
          <div className="text-center">
            <span className="text-xs text-on-surface-variant block mb-0.5">Dormí</span>
            <span className={`text-xl font-bold ${step === "bed" ? "text-[#7C3AED]" : "text-on-surface"}`}>
              {pad(bedHour)}:{pad(bedMin)}
            </span>
          </div>
          <div className="text-on-surface-variant text-xl self-center">→</div>
          <div className="text-center">
            <span className="text-xs text-on-surface-variant block mb-0.5">Desperté</span>
            <span className={`text-xl font-bold ${step === "wake" ? "text-[#7C3AED]" : "text-on-surface"}`}>
              {pad(wakeHour)}:{pad(wakeMin)}
            </span>
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-400 text-center px-6 mb-2">{error}</p>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 px-6 pb-6">
          {step === "bed" ? (
            <button
              onClick={() => setStep("wake")}
              className="flex-1 py-3.5 rounded-2xl bg-[#7C3AED] text-white font-bold text-base active:scale-95 transition-all"
            >
              Siguiente →
            </button>
          ) : (
            <>
              <button
                onClick={() => setStep("bed")}
                className="px-5 py-3.5 rounded-2xl bg-surface-container-high text-on-surface font-semibold text-sm active:scale-95 transition-all"
              >
                ← Atrás
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex-1 py-3.5 rounded-2xl bg-[#7C3AED] text-white font-bold text-base active:scale-95 transition-all disabled:opacity-60"
              >
                {loading ? "Guardando..." : "Guardar sueño"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

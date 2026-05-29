"use client";

// ============================================================
// EditSleepLogger — Modal para editar un registro de sueño
// Inicializa los wheel pickers con los valores actuales del log.
// Permite editar bedTime, wakeTime y notes.
// ============================================================

import { useState } from "react";
import TimeWheelPicker from "./TimeWheelPicker";
import type { SleepLogEntry } from "@/lib/sleep";

type Step = "bed" | "wake";

type Props = {
  log: SleepLogEntry;
  onSaved: () => void;
  onClose: () => void;
};

export default function EditSleepLogger({ log, onSaved, onClose }: Props) {
  const bed = new Date(log.bedTime);
  const wake = log.wakeTime ? new Date(log.wakeTime) : new Date();

  const [step, setStep] = useState<Step>("bed");
  const [bedHour, setBedHour] = useState(bed.getHours());
  const [bedMin, setBedMin] = useState(bed.getMinutes());
  const [wakeHour, setWakeHour] = useState(wake.getHours());
  const [wakeMin, setWakeMin] = useState(wake.getMinutes());
  const [notes, setNotes] = useState(log.notes ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // bedTime se preserva en el dia que tenia; solo cambian horas/minutos.
  function buildBedTime() {
    const d = new Date(log.bedTime);
    d.setHours(bedHour, bedMin, 0, 0);
    return d.toISOString();
  }

  // wakeTime usa el dia base del log (log.date = dia de despertar).
  function buildWakeTime() {
    const d = log.wakeTime ? new Date(log.wakeTime) : new Date(log.date);
    d.setHours(wakeHour, wakeMin, 0, 0);
    return d.toISOString();
  }

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sleep/${log.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bedTime: buildBedTime(),
          wakeTime: buildWakeTime(),
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Error al guardar");
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-surface-container rounded-t-3xl overflow-hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
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
          <h2 className="text-base font-bold text-on-surface">Editar sueño</h2>
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

        {/* Wheel picker */}
        {step === "bed" ? (
          <TimeWheelPicker
            hour={bedHour}
            minute={bedMin}
            onHourChange={setBedHour}
            onMinuteChange={setBedMin}
          />
        ) : (
          <TimeWheelPicker
            hour={wakeHour}
            minute={wakeMin}
            onHourChange={setWakeHour}
            onMinuteChange={setWakeMin}
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

        {/* Notes */}
        <div className="px-6 pb-3">
          <label className="text-xs text-on-surface-variant block mb-1">
            Notas (opcional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Cómo dormiste..."
            className="w-full text-sm bg-surface-container-high/50 border border-outline-variant/20 rounded-lg px-3 py-2 text-on-surface placeholder:text-outline focus:outline-none focus:border-[#7C3AED]/50"
          />
        </div>

        {error && (
          <p className="text-xs text-red-400 text-center px-6 mb-2">{error}</p>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            className="px-5 py-3.5 rounded-2xl bg-surface-container-high text-on-surface font-semibold text-sm active:scale-95 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 py-3.5 rounded-2xl bg-[#7C3AED] text-white font-bold text-base active:scale-95 transition-all disabled:opacity-60"
          >
            {loading ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

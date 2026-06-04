"use client";

import { useState } from "react";
import Link from "next/link";
import { ACTIVITY_ORDER, ACTIVITIES } from "@/lib/fitness-activities";

type Props = { onLogged: () => void };

export default function FitnessQuickActions({ onLogged }: Props) {
  const [nlpText, setNlpText] = useState("");
  const [loading, setLoading] = useState<"nlp" | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const flash = (ok: boolean, msg: string) => {
    setFeedback({ ok, msg });
    setTimeout(() => setFeedback(null), 4000);
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

  return (
    <div className="space-y-4">

      {/* ── Activity pills ──────────────────────────────────── */}
      <div className="glass-card rounded-2xl p-4 space-y-3">
        <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
          Registrar actividad
        </span>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {ACTIVITY_ORDER.map((slug) => {
            const a = ACTIVITIES[slug];
            return (
              <Link
                key={slug}
                href={`/fitness/${slug}`}
                className="flex-shrink-0 flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-xl transition-all active:scale-90"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: a.color }}
              >
                <span className="material-symbols-outlined text-[22px]">{a.icon}</span>
                <span className="text-[11px] font-semibold">{a.label}</span>
              </Link>
            );
          })}
        </div>
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

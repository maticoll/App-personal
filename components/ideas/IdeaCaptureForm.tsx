"use client";

import { useState } from "react";
import { Send, Sparkles, Check } from "lucide-react";
import type { IdeaWithMeta } from "@/lib/ideas";

type Props = {
  onCaptured: (idea: IdeaWithMeta) => void;
};

type Stage = "input" | "preview" | "saved";

export default function IdeaCaptureForm({ onCaptured }: Props) {
  const [text, setText] = useState("");
  const [stage, setStage] = useState<Stage>("input");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<IdeaWithMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!text.trim() || text.trim().length < 3) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      if (!res.ok) throw new Error("Error del servidor");
      const idea: IdeaWithMeta = await res.json();
      setPreview(idea);
      setStage("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al procesar la idea");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!preview) return;
    onCaptured(preview);
    setStage("saved");
    setTimeout(() => {
      setText("");
      setPreview(null);
      setStage("input");
    }, 2000);
  };

  const handleEdit = () => {
    setStage("input");
  };

  if (stage === "saved") {
    return (
      <div className="rounded-xl bg-surface border border-pink-500/20 p-6 text-center">
        <div className="flex items-center justify-center gap-2 text-emerald-400">
          <Check className="w-5 h-5" />
          <span className="text-sm font-medium">¡Idea guardada!</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-surface border border-white/5 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-pink-400" />
        <h3 className="text-sm font-medium text-text-primary">Capturar idea</h3>
      </div>

      {stage === "input" && (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.metaKey) handleSubmit();
            }}
            placeholder="¿Qué se te ocurrió? Escribilo como quieras — crudo, informal, en cualquier idioma. La IA lo estructura después."
            rows={5}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted/50 resize-none focus:outline-none focus:border-pink-500/40 transition-colors"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-text-muted/60">⌘ + Enter para enviar</p>
            <button
              onClick={handleSubmit}
              disabled={loading || text.trim().length < 3}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-module-ideas/20 text-pink-400 text-sm font-medium hover:bg-module-ideas/30 transition-colors disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
              {loading ? "Procesando con IA..." : "Capturar"}
            </button>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </>
      )}

      {stage === "preview" && preview && (
        <div className="space-y-3">
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-xs text-text-muted mb-1">Título generado por IA</p>
            <p className="text-sm font-semibold text-text-primary">{preview.title}</p>
          </div>
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-xs text-text-muted mb-1">Idea estructurada</p>
            <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
              {preview.cleanedText}
            </p>
          </div>
          {preview.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {preview.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-full bg-module-ideas/15 text-pink-400 text-xs border border-pink-500/20"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleEdit}
              className="flex-1 py-2 rounded-lg bg-white/5 text-text-muted text-sm hover:bg-white/10 transition-colors"
            >
              Editar texto
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 py-2 rounded-lg bg-module-ideas/20 text-pink-400 text-sm font-medium hover:bg-module-ideas/30 transition-colors"
            >
              ✓ Confirmar y guardar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

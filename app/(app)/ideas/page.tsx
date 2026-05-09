// ============================================================
// Módulo de Ideas — /ideas
// TODO: Sesión 5 — IA cleanup, Lumina sync
// ============================================================

import { Lightbulb } from "lucide-react";

export default function IdeasPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Lightbulb className="w-5 h-5 text-module-ideas" />
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Ideas</h2>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          Captura y desarrolla ideas con IA
        </p>
      </div>

      {/* Placeholder — TODO: Sesión 5 */}
      <div className="card text-center py-12">
        <Lightbulb className="w-12 h-12 text-module-ideas mx-auto mb-4 opacity-40" />
        <p className="font-medium text-[var(--text-primary)]">Módulo en construcción</p>
        <p className="text-sm text-[var(--text-muted)] mt-1">Se implementa en la Sesión 5</p>
      </div>

      {/* TODO: Sesión 5
        - IdeaFeed: lista de ideas con raw + cleaned text
        - QuickCaptureInput: captura rápida de idea
        - LuminaSyncButton: sync con Lumina app
        - IdeaCard: con tags y opción de desarrollar conversacionalmente
      */}
    </div>
  );
}

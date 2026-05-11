"use client";

import { useState } from "react";
import { Edit2, Save, X } from "lucide-react";
import type { DietInfo } from "@/lib/nutrition";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type Props = {
  diet: DietInfo;
  onUpdated: () => void;
};

export default function DietCard({ diet, onUpdated }: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(diet?.content ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (text.trim().length < 10) {
      setError("Mínimo 10 caracteres");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/nutrition/diet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text.trim() }),
      });
      if (!res.ok) throw new Error();
      setEditing(false);
      onUpdated();
    } catch {
      setError("Error guardando la dieta");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl bg-surface border border-white/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-text-primary">Mi dieta</h3>
        {!editing ? (
          <button
            onClick={() => {
              setText(diet?.content ?? "");
              setEditing(true);
            }}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
            {diet ? "Editar" : "Configurar"}
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(false)}
              className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"
            >
              <X className="w-3.5 h-3.5" /> Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="Describí tu dieta actual. Ej: Dieta alta en proteínas. Desayuno: avena con proteína. Almuerzo: arroz, pollo y vegetales. Cena: huevos o carne magra con ensalada. Sin azúcar refinada ni harinas..."
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted/50 resize-none focus:outline-none focus:border-module-nutrition/50 transition-colors"
          />
          {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
        </div>
      ) : diet ? (
        <div>
          <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
            {diet.content}
          </p>
          <p className="text-xs text-text-muted mt-2">
            Actualizado{" "}
            {format(new Date(diet.updatedAt), "d MMM yyyy", { locale: es })}
          </p>
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-text-muted text-sm">Sin dieta configurada</p>
          <p className="text-text-muted/60 text-xs mt-1">
            Configurá tu dieta para que la IA evalúe qué tan alineadas están tus comidas
          </p>
        </div>
      )}
    </div>
  );
}

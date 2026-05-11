"use client";

import { useState } from "react";
import { Edit2, Trash2, X, Save } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { IdeaWithMeta } from "@/lib/ideas";

type Props = {
  idea: IdeaWithMeta;
  onDeleted: (id: string) => void;
  onUpdated: (idea: IdeaWithMeta) => void;
  onClick: () => void;
};

export default function IdeaCard({ idea, onDeleted, onUpdated, onClick }: Props) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(idea.title ?? "");
  const [editContent, setEditContent] = useState(idea.cleanedText ?? idea.rawText);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaving(true);
    try {
      const res = await fetch(`/api/ideas/${idea.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, content: editContent }),
      });
      if (res.ok) {
        const updated = await res.json();
        onUpdated(updated);
        setEditing(false);
      }
    } catch {
      console.error("Error actualizando idea");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleting(true);
    try {
      await fetch(`/api/ideas/${idea.id}`, { method: "DELETE" });
      onDeleted(idea.id);
    } catch {
      console.error("Error eliminando idea");
    } finally {
      setDeleting(false);
    }
  };

  const previewText = idea.cleanedText ?? idea.rawText;

  return (
    <div
      onClick={editing ? undefined : onClick}
      className={`rounded-xl bg-surface border border-white/5 p-4 transition-all ${
        !editing ? "cursor-pointer hover:border-pink-500/20 hover:bg-white/3" : ""
      }`}
    >
      {editing ? (
        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-pink-500/50"
            placeholder="Título"
          />
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={4}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-text-primary resize-none focus:outline-none focus:border-pink-500/50"
            placeholder="Contenido"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); setEditing(false); }}
              className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"
            >
              <X className="w-3.5 h-3.5" /> Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 text-xs text-pink-400 hover:text-pink-300 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-sm font-semibold text-text-primary leading-snug line-clamp-2">
              {idea.title ?? "Idea sin título"}
            </h3>
            <div className="flex gap-1 shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); setEditing(true); }}
                className="p-1.5 text-text-muted hover:text-text-primary transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="p-1.5 text-text-muted hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <p className="text-xs text-text-muted leading-relaxed line-clamp-2 mb-3">
            {previewText}
          </p>

          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-1">
              {idea.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-full bg-module-ideas/15 text-pink-400 text-xs border border-pink-500/15"
                >
                  #{tag}
                </span>
              ))}
            </div>
            <span className="text-xs text-text-muted/60 shrink-0">
              {format(new Date(idea.createdAt), "d MMM", { locale: es })}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

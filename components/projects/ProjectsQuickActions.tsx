"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

type Props = { onCreated: () => void };

export default function ProjectsQuickActions({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!title.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      if (res.ok) { setTitle(""); setOpen(false); onCreated(); }
    } catch { /* silently fail */ } finally { setLoading(false); }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-30
          w-12 h-12 rounded-full bg-amber-500 text-white shadow-lg
          flex items-center justify-center hover:bg-amber-600 transition-colors active:scale-95"
        aria-label="Nuevo proyecto"
      >
        <Plus className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-30
      bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl p-4 w-72">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-[var(--text-primary)]">Nuevo proyecto</span>
        <button onClick={() => { setOpen(false); setTitle(""); }} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
          <X className="w-4 h-4" />
        </button>
      </div>
      <input
        type="text" value={title} onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        placeholder="Nombre del proyecto..."
        className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--surface-hover)]
          border border-[var(--border)] text-[var(--text-primary)]
          placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-amber-500/50 mb-3"
        autoFocus
      />
      <button
        onClick={handleCreate} disabled={!title.trim() || loading}
        className="w-full py-2 text-sm font-medium rounded-lg bg-amber-500 text-white
          hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Creando..." : "Crear proyecto"}
      </button>
    </div>
  );
}

"use client";

import { useState, useCallback, useMemo } from "react";
import type { IdeaWithMeta, IdeasStats } from "@/lib/ideas";

import IdeaCaptureForm from "./IdeaCaptureForm";
import IdeasGrid from "./IdeasGrid";
import TagFilter from "./TagFilter";
import IdeaDetail from "./IdeaDetail";
import IdeasStatsComponent from "./IdeasStats";

type Tab = "capturar" | "explorar";

type Props = {
  initialIdeas: IdeaWithMeta[];
  initialStats: IdeasStats;
};

export default function IdeasModuleClient({
  initialIdeas,
  initialStats,
}: Props) {
  const [tab, setTab] = useState<Tab>("capturar");
  const [ideas, setIdeas] = useState<IdeaWithMeta[]>(initialIdeas);
  const [stats, setStats] = useState<IdeasStats>(initialStats);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedIdea, setSelectedIdea] = useState<IdeaWithMeta | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Construir lista de tags con conteo
  const tagList = useMemo(() => {
    const map = new Map<string, number>();
    for (const idea of ideas) {
      for (const tag of idea.tags) {
        map.set(tag, (map.get(tag) ?? 0) + 1);
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => ({ tag, count }));
  }, [ideas]);

  // Filtrar ideas por tag y búsqueda
  const filteredIdeas = useMemo(() => {
    return ideas.filter((idea) => {
      if (selectedTag && !idea.tags.includes(selectedTag)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          idea.title?.toLowerCase().includes(q) ||
          idea.cleanedText?.toLowerCase().includes(q) ||
          idea.rawText.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [ideas, selectedTag, searchQuery]);

  const handleCaptured = useCallback((newIdea: IdeaWithMeta) => {
    setIdeas((prev) => [newIdea, ...prev]);
    setStats((prev) => ({
      ...prev,
      total: prev.total + 1,
      thisWeek: prev.thisWeek + 1,
      thisMonth: prev.thisMonth + 1,
    }));
    // Cambiar a explorar para ver la nueva idea
    setTimeout(() => setTab("explorar"), 2500);
  }, []);

  const handleDeleted = useCallback((id: string) => {
    setIdeas((prev) => prev.filter((i) => i.id !== id));
    setStats((prev) => ({
      ...prev,
      total: Math.max(0, prev.total - 1),
    }));
  }, []);

  const handleUpdated = useCallback((updated: IdeaWithMeta) => {
    setIdeas((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  }, []);

  const tabs: { id: Tab; label: string }[] = [
    { id: "capturar", label: "Capturar" },
    { id: "explorar", label: `Explorar (${ideas.length})` },
  ];

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 bg-surface rounded-xl p-1 border border-white/5">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id
                ? "bg-module-ideas/20 text-pink-400"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB: CAPTURAR */}
      {tab === "capturar" && (
        <div className="space-y-4">
          <IdeaCaptureForm onCaptured={handleCaptured} />
          <IdeasStatsComponent stats={stats} />
        </div>
      )}

      {/* TAB: EXPLORAR */}
      {tab === "explorar" && (
        <div className="space-y-4">
          {/* Search */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar ideas..."
            className="w-full bg-surface border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-pink-500/40 transition-colors"
          />

          {/* Tags */}
          <TagFilter
            tags={tagList}
            selected={selectedTag}
            onSelect={setSelectedTag}
          />

          {/* Grid */}
          <IdeasGrid
            ideas={filteredIdeas}
            onDeleted={handleDeleted}
            onUpdated={handleUpdated}
            onSelect={setSelectedIdea}
          />
        </div>
      )}

      {/* Modal detalle */}
      {selectedIdea && (
        <IdeaDetail
          idea={selectedIdea}
          onClose={() => setSelectedIdea(null)}
        />
      )}
    </div>
  );
}

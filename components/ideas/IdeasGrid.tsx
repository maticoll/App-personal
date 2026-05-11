"use client";

import type { IdeaWithMeta } from "@/lib/ideas";
import IdeaCard from "./IdeaCard";

type Props = {
  ideas: IdeaWithMeta[];
  onDeleted: (id: string) => void;
  onUpdated: (idea: IdeaWithMeta) => void;
  onSelect: (idea: IdeaWithMeta) => void;
};

export default function IdeasGrid({ ideas, onDeleted, onUpdated, onSelect }: Props) {
  if (ideas.length === 0) {
    return (
      <div className="rounded-xl bg-surface border border-white/5 p-8 text-center">
        <p className="text-2xl mb-2">💡</p>
        <p className="text-text-muted text-sm">Sin ideas todavía</p>
        <p className="text-text-muted/60 text-xs mt-1">
          Capturá tu primera idea usando el formulario de arriba
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {ideas.map((idea) => (
        <IdeaCard
          key={idea.id}
          idea={idea}
          onDeleted={onDeleted}
          onUpdated={onUpdated}
          onClick={() => onSelect(idea)}
        />
      ))}
    </div>
  );
}

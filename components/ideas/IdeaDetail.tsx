"use client";

import { X } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { IdeaWithMeta } from "@/lib/ideas";

type Props = {
  idea: IdeaWithMeta;
  onClose: () => void;
};

export default function IdeaDetail({ idea, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#1A1D27] rounded-2xl border border-white/10 shadow-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-white/5">
          <div className="flex-1 min-w-0 pr-3">
            <h2 className="text-base font-semibold text-text-primary leading-snug">
              {idea.title ?? "Idea"}
            </h2>
            <p className="text-xs text-text-muted mt-1">
              {format(new Date(idea.createdAt), "EEEE d 'de' MMMM yyyy", {
                locale: es,
              })}{" "}
              · {idea.wordCount} palabras
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-text-primary transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
            {idea.cleanedText ?? idea.rawText}
          </p>

          {idea.cleanedText && idea.rawText !== idea.cleanedText && (
            <details className="mt-4">
              <summary className="text-xs text-text-muted cursor-pointer hover:text-text-primary">
                Ver texto original
              </summary>
              <p className="text-xs text-text-muted mt-2 bg-white/5 rounded-lg p-3 italic">
                {idea.rawText}
              </p>
            </details>
          )}
        </div>

        {/* Footer: tags */}
        {idea.tags.length > 0 && (
          <div className="px-5 py-3 border-t border-white/5 flex flex-wrap gap-2">
            {idea.tags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 rounded-full bg-module-ideas/15 text-pink-400 text-xs border border-pink-500/20"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

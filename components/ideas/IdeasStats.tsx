"use client";

import type { IdeasStats } from "@/lib/ideas";

type Props = {
  stats: IdeasStats;
};

export default function IdeasStats({ stats }: Props) {
  const items = [
    { label: "Total ideas", value: stats.total, emoji: "💡" },
    { label: "Esta semana", value: stats.thisWeek, emoji: "📅" },
    { label: "Este mes", value: stats.thisMonth, emoji: "📆" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-xl bg-surface border border-white/5 p-3 text-center">
            <p className="text-xl mb-1">{item.emoji}</p>
            <p className="text-2xl font-bold text-text-primary">{item.value}</p>
            <p className="text-xs text-text-muted mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>

      {stats.topTags.length > 0 && (
        <div className="rounded-xl bg-surface border border-white/5 p-4">
          <p className="text-xs text-text-muted mb-2">Top tags</p>
          <div className="flex flex-wrap gap-2">
            {stats.topTags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 rounded-full bg-module-ideas/15 text-pink-400 text-xs font-medium border border-pink-500/20"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

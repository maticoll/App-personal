"use client";

type Props = {
  tags: { tag: string; count: number }[];
  selected: string | null;
  onSelect: (tag: string | null) => void;
};

export default function TagFilter({ tags, selected, onSelect }: Props) {
  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect(null)}
        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
          selected === null
            ? "bg-module-ideas/20 text-pink-400 border-pink-500/30"
            : "bg-white/5 text-text-muted border-white/10 hover:bg-white/10"
        }`}
      >
        Todas
      </button>
      {tags.map(({ tag, count }) => (
        <button
          key={tag}
          onClick={() => onSelect(selected === tag ? null : tag)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
            selected === tag
              ? "bg-module-ideas/20 text-pink-400 border-pink-500/30"
              : "bg-white/5 text-text-muted border-white/10 hover:bg-white/10"
          }`}
        >
          #{tag}
          <span className="ml-1.5 opacity-60">{count}</span>
        </button>
      ))}
    </div>
  );
}

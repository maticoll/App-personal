"use client";

type Props = {
  score: number | null;
  size?: "sm" | "md";
};

export default function AlignmentBadge({ score, size = "sm" }: Props) {
  if (score === null) return null;

  const config =
    score >= 70
      ? { label: "Alineado", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" }
      : score >= 40
      ? { label: "Parcial", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" }
      : { label: "Fuera de dieta", color: "bg-red-500/20 text-red-400 border-red-500/30" };

  const sizeClass = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1";

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${sizeClass} ${config.color}`}
    >
      {score}% · {config.label}
    </span>
  );
}

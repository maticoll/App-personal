"use client";

// ============================================================
// GlobalScoreRing — Score global con anillo SVG animado
// Sesión 2 — Dashboard + Scoring
// ============================================================

import { useEffect, useState } from "react";
import { getScoreEmoji } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface GlobalScoreRingProps {
  score: number | null;
  size?: "md" | "lg";
  className?: string;
}

function getScoreColorHex(score: number): string {
  if (score >= 80) return "#22C55E";
  if (score >= 60) return "#84CC16";
  if (score >= 40) return "#EAB308";
  if (score >= 20) return "#F97316";
  return "#EF4444";
}

export function GlobalScoreRing({
  score,
  size = "lg",
  className,
}: GlobalScoreRingProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const value = score ?? 0;

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedScore(value);
    }, 150);
    return () => clearTimeout(timer);
  }, [value]);

  const isLg = size === "lg";
  const svgSize = isLg ? 160 : 120;
  const radius = isLg ? 68 : 50;
  const strokeWidth = isLg ? 10 : 8;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedScore / 100) * circumference;
  const color = getScoreColorHex(animatedScore);

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative" style={{ width: svgSize, height: svgSize }}>
        <svg
          width={svgSize}
          height={svgSize}
          viewBox={`0 0 ${svgSize} ${svgSize}`}
          className="-rotate-90"
        >
          {/* Track */}
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth={strokeWidth}
          />
          {/* Progress */}
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1s ease-out, stroke 0.5s ease" }}
          />
        </svg>

        {/* Centro */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {score !== null ? (
            <>
              <span
                className={cn(
                  "font-bold leading-none",
                  isLg ? "text-4xl" : "text-2xl"
                )}
                style={{ color }}
              >
                {animatedScore}
              </span>
              <span className={cn("text-[var(--text-muted)]", isLg ? "text-sm" : "text-xs")}>
                /100
              </span>
            </>
          ) : (
            <span className={cn("text-[var(--text-muted)]", isLg ? "text-2xl" : "text-xl")}>
              —
            </span>
          )}
        </div>
      </div>

      {/* Emoji + label */}
      {score !== null && (
        <div className="flex items-center gap-1.5 mt-2">
          <span className={isLg ? "text-xl" : "text-lg"}>
            {getScoreEmoji(value)}
          </span>
          <span className="text-sm font-medium text-[var(--text-secondary)]">
            Score del día
          </span>
        </div>
      )}
      {score === null && (
        <span className="text-sm text-[var(--text-muted)] mt-2">
          Completá módulos para ver tu score
        </span>
      )}
    </div>
  );
}

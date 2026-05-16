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
  size?: "sm" | "md" | "lg";
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
  const isSm = size === "sm";
  const svgSize = isLg ? 160 : isSm ? 72 : 120;
  const radius = isLg ? 68 : isSm ? 30 : 50;
  const strokeWidth = isLg ? 10 : isSm ? 6 : 8;
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
            stroke="#464554"
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
                  isLg ? "text-4xl" : isSm ? "text-lg" : "text-2xl"
                )}
                style={{ color }}
              >
                {animatedScore}
              </span>
              <span className={cn("text-outline", isLg ? "text-sm" : "text-xs")}>
                /100
              </span>
            </>
          ) : (
            <span className={cn("text-outline", isLg ? "text-2xl" : isSm ? "text-base" : "text-xl")}>
              —
            </span>
          )}
        </div>
      </div>

      {/* Emoji + label — hidden for sm size */}
      {score !== null && !isSm && (
        <div className="flex items-center gap-1.5 mt-2">
          <span className={isLg ? "text-xl" : "text-lg"}>
            {getScoreEmoji(value)}
          </span>
          <span className="text-sm font-medium text-on-surface-variant">
            Score del día
          </span>
        </div>
      )}
      {score === null && !isSm && (
        <span className="text-sm text-outline mt-2">
          Completá módulos para ver tu score
        </span>
      )}
    </div>
  );
}

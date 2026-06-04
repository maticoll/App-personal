// components/ui/skeletons/SkeletonBase.tsx
// Primitivos atómicos para skeleton screens.
// Sk.Card es solo shell (sin shimmer). Los primitivos hoja shimmean.

import React from "react";

function Line({
  w = "w-full",
  h = "h-4",
  className = "",
}: {
  w?: string;
  h?: string;
  className?: string;
}) {
  return <div className={`skeleton-shimmer rounded-lg ${h} ${w} ${className}`} />;
}

function LineH({
  w = "w-full",
  h = "h-6",
  className = "",
}: {
  w?: string;
  h?: string;
  className?: string;
}) {
  return <div className={`skeleton-shimmer rounded-lg ${h} ${w} ${className}`} />;
}

function Circle({
  size,
  className = "",
}: {
  size: number;
  className?: string;
}) {
  return (
    <div
      className={`skeleton-shimmer rounded-full flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

function Block({
  h = "h-16",
  w = "w-full",
  className = "",
}: {
  h?: string;
  w?: string;
  className?: string;
}) {
  return <div className={`skeleton-shimmer rounded-xl ${h} ${w} ${className}`} />;
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`card space-y-3 ${className}`}>
      {children}
    </div>
  );
}

function TabNav({ tabs = 2 }: { tabs?: number }) {
  return (
    <div className="flex p-1 bg-surface-container rounded-xl gap-1">
      {Array.from({ length: tabs }).map((_, i) => (
        <div key={i} className="flex-1 h-9 rounded-lg skeleton-shimmer" />
      ))}
    </div>
  );
}

export const Sk = { Line, LineH, Circle, Block, Card, TabNav };

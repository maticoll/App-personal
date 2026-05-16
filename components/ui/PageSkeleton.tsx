// Skeleton genérico para páginas mientras cargan datos
export default function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Heading */}
      <div className="h-8 w-40 bg-surface-container-high rounded-xl" />

      {/* Cards */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="glass-card rounded-2xl p-4 space-y-3">
          <div className="h-4 w-24 bg-surface-container-high rounded-lg" />
          <div className="h-16 bg-surface-container-high/60 rounded-xl" />
        </div>
      ))}
    </div>
  );
}

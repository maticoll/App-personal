"use client";

const ZONE_COLORS = ["#60A5FA", "#34D399", "#FBBF24", "#FB923C", "#EF4444"];

export default function HrZonesBar({ zones }: { zones: number[] }) {
  const max = Math.max(...zones, 1);
  return (
    <div>
      <div className="flex gap-1 h-9 items-end">
        {zones.map((z, i) => (
          <div
            key={i}
            className="flex-1 rounded-t"
            style={{ height: `${Math.max((z / max) * 100, 4)}%`, background: ZONE_COLORS[i] }}
            title={`Z${i + 1}: ${Math.round(z / 60)} min`}
          />
        ))}
      </div>
      <div className="flex gap-1 mt-1">
        {zones.map((_, i) => (
          <span key={i} className="flex-1 text-center text-[9px] text-on-surface-variant">Z{i + 1}</span>
        ))}
      </div>
    </div>
  );
}

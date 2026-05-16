"use client";

// ============================================================
// TimeWheelPicker — Rueda de selección de hora (24h) y minuto
// Estilo iOS: scroll con snap, número central resaltado
// ============================================================

import { useRef, useEffect, useCallback } from "react";

const ITEM_H = 44; // px por ítem
const VISIBLE = 5; // ítems visibles (centro + 2 arriba + 2 abajo)

type WheelColumnProps = {
  items: number[];
  value: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
};

function WheelColumn({ items, value, onChange, format }: WheelColumnProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isSyncing = useRef(false);

  // Scroll al ítem seleccionado
  const scrollTo = useCallback(
    (v: number, behavior: ScrollBehavior = "instant") => {
      if (!ref.current) return;
      const idx = items.indexOf(v);
      if (idx < 0) return;
      isSyncing.current = true;
      ref.current.scrollTo({ top: idx * ITEM_H, behavior });
      setTimeout(() => { isSyncing.current = false; }, 300);
    },
    [items]
  );

  // Inicializar posición
  useEffect(() => { scrollTo(value, "instant"); }, []); // eslint-disable-line

  // Cuando value cambia externamente
  useEffect(() => { scrollTo(value, "smooth"); }, [value, scrollTo]);

  const handleScroll = () => {
    if (!ref.current || isSyncing.current) return;
    const idx = Math.round(ref.current.scrollTop / ITEM_H);
    const clamped = Math.max(0, Math.min(idx, items.length - 1));
    if (items[clamped] !== value) onChange(items[clamped]);
  };

  return (
    <div className="relative flex-1 select-none">
      {/* Gradientes top/bottom */}
      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="h-[88px] bg-gradient-to-b from-[#10131d] to-transparent" />
        <div className="absolute bottom-0 h-[88px] w-full bg-gradient-to-t from-[#10131d] to-transparent" />
      </div>

      {/* Highlight line del ítem central */}
      <div
        className="pointer-events-none absolute left-0 right-0 z-10 border-t border-b border-white/10"
        style={{ top: ITEM_H * 2, height: ITEM_H }}
      />

      {/* Scroll container */}
      <div
        ref={ref}
        onScroll={handleScroll}
        className="overflow-y-scroll no-scrollbar"
        style={{
          height: ITEM_H * VISIBLE,
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {/* Padding superior e inferior para centrar primero/último */}
        <div style={{ height: ITEM_H * 2 }} />
        {items.map((v) => (
          <div
            key={v}
            style={{ height: ITEM_H, scrollSnapAlign: "center" }}
            className={`flex items-center justify-center transition-all duration-150 ${
              v === value
                ? "text-on-surface text-3xl font-bold"
                : "text-on-surface-variant/40 text-2xl font-medium"
            }`}
          >
            {format ? format(v) : String(v)}
          </div>
        ))}
        <div style={{ height: ITEM_H * 2 }} />
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────

type Props = {
  hour: number;
  minute: number;
  onHourChange: (h: number) => void;
  onMinuteChange: (m: number) => void;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const pad = (n: number) => String(n).padStart(2, "0");

export default function TimeWheelPicker({ hour, minute, onHourChange, onMinuteChange }: Props) {
  return (
    <div className="flex items-center gap-1 h-[220px] px-4">
      <WheelColumn items={HOURS} value={hour} onChange={onHourChange} format={pad} />

      <span className="text-3xl font-bold text-on-surface pb-1 flex-shrink-0">:</span>

      <WheelColumn items={MINUTES} value={minute} onChange={onMinuteChange} format={pad} />
    </div>
  );
}

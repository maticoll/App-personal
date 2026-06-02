"use client";
import { useEffect, useState } from "react";

type Props = { seconds: number; onDone: () => void; onSkip: () => void; onAdjust: (delta: number) => void };

export default function RestTimer({ seconds, onDone, onSkip, onAdjust }: Props) {
  const [remaining, setRemaining] = useState(seconds);
  useEffect(() => setRemaining(seconds), [seconds]);
  useEffect(() => {
    if (remaining <= 0) { onDone(); return; }
    const t = setInterval(() => setRemaining((r) => r - 1), 1000);
    return () => clearInterval(t);
  }, [remaining, onDone]);

  const mm = Math.floor(Math.max(remaining, 0) / 60);
  const ss = String(Math.max(remaining, 0) % 60).padStart(2, "0");
  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-[#06B6D4]/15 text-accent-cyan rounded-full px-3 py-2 backdrop-blur">
      <button onClick={() => onAdjust(-15)} className="px-2 font-bold">-15</button>
      <span className="font-mono font-bold tabular-nums">⏱ {mm}:{ss}</span>
      <button onClick={() => onAdjust(15)} className="px-2 font-bold">+15</button>
      <button onClick={onSkip} className="ml-1 text-xs underline">Saltar</button>
    </div>
  );
}

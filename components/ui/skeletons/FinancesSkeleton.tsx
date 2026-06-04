// components/ui/skeletons/FinancesSkeleton.tsx
import { Sk } from "./SkeletonBase";

export default function FinancesSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando...">

      {/* Header con refresh icon */}
      <div className="flex justify-between items-center">
        <Sk.Line w="w-28" />
        <Sk.Circle size={28} />
      </div>

      {/* Stats — 3 cards */}
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Sk.Card key={i} className="space-y-1">
            <Sk.Line h="h-2" w="w-16" />
            <Sk.LineH h="h-5" w="w-24" />
            <Sk.Block h="h-5" w="w-14" className="rounded-full" />
          </Sk.Card>
        ))}
      </div>

      {/* Top Categorías */}
      <Sk.Card className="space-y-4">
        <Sk.Line h="h-2" w="w-24" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex justify-between">
              <Sk.Line w="w-24" />
              <Sk.Line w="w-16" />
            </div>
            <Sk.Block h="h-2" className="rounded-full" />
          </div>
        ))}
      </Sk.Card>

      {/* Donut */}
      <Sk.Card className="flex flex-col items-center">
        <Sk.Circle size={176} />
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 w-full mt-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Sk.Circle size={10} />
              <Sk.Line w="w-20" />
            </div>
          ))}
        </div>
      </Sk.Card>

      {/* DailyEvolution chart */}
      <Sk.Card><Sk.Block h="h-36" /></Sk.Card>

      {/* Last6Months — alturas fijas para Tailwind purging */}
      <Sk.Card>
        <Sk.Line h="h-2" w="w-24" />
        <div className="flex justify-between items-end h-24 gap-2 mt-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex-1 flex items-end justify-center">
              <Sk.Block h="h-16" w="w-5" className="rounded-t-sm" />
            </div>
          ))}
        </div>
      </Sk.Card>

      {/* Balances por cuenta */}
      <Sk.Card className="space-y-2">
        <Sk.Line h="h-2" w="w-24" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex justify-between items-center">
            <Sk.Line w="w-24" />
            <Sk.Line w="w-20" />
          </div>
        ))}
      </Sk.Card>

      {/* Transacciones */}
      <Sk.Card className="space-y-0">
        <div className="flex justify-between items-center pb-2">
          <Sk.Line h="h-2" w="w-32" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex justify-between items-center py-2.5 border-b border-outline-variant/10 last:border-0"
          >
            <div className="space-y-1">
              <Sk.Line w="w-40" />
              <Sk.Line h="h-3" w="w-28" />
            </div>
            <Sk.Line w="w-20" />
          </div>
        ))}
      </Sk.Card>

    </div>
  );
}

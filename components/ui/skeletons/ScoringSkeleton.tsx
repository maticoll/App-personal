// components/ui/skeletons/ScoringSkeleton.tsx
import { Sk } from "./SkeletonBase";

export default function ScoringSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando...">

      {/* Header */}
      <div className="flex items-center gap-2">
        <Sk.Circle size={20} />
        <Sk.LineH w="w-24" />
      </div>

      {/* PeriodSelector */}
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Sk.Block key={i} h="h-9" w="w-24" className="rounded-full" />
        ))}
      </div>

      {/* Stats Promedio/Máximo/Mínimo */}
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Sk.Card key={i} className="text-center py-3 space-y-1">
            <Sk.LineH h="h-6" w="w-10" className="mx-auto" />
            <Sk.Line h="h-3" w="w-16" className="mx-auto" />
          </Sk.Card>
        ))}
      </div>

      {/* Chart card — h-56 (224px) aproxima los 220px reales */}
      <Sk.Card className="space-y-4">
        <div className="flex justify-between items-center">
          <Sk.Line w="w-32" />
          <Sk.Line w="w-28" />
        </div>
        <Sk.Block h="h-56" className="rounded-xl" />
      </Sk.Card>

      {/* Días recientes */}
      <div>
        <Sk.Line h="h-3" w="w-28" className="mb-3" />
        <div className="space-y-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Sk.Card key={i} className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <Sk.Line w="w-24" />
                  <Sk.Line h="h-3" w="w-16" />
                </div>
                <Sk.LineH h="h-7" w="w-12" />
              </div>
              <Sk.Block h="h-2" className="rounded-full" />
            </Sk.Card>
          ))}
        </div>
      </div>

    </div>
  );
}

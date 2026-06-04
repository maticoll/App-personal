// components/ui/skeletons/FitnessSkeleton.tsx
import { Sk } from "./SkeletonBase";

export default function FitnessSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando...">

      {/* Header */}
      <div className="flex items-center gap-2">
        <Sk.Circle size={20} />
        <Sk.LineH w="w-24" />
      </div>

      {/* TabNav — Today | Stats */}
      <Sk.TabNav />

      {/* StepsCard */}
      <Sk.Card>
        <div className="flex gap-4 items-center">
          <Sk.Circle size={64} />
          <div className="flex-1 space-y-2">
            <Sk.Line w="w-24" />
            <Sk.LineH h="h-6" w="w-32" />
            <Sk.Block h="h-2" className="rounded-full" />
          </div>
        </div>
      </Sk.Card>

      {/* GymRoutineCard */}
      <Sk.Card>
        <Sk.LineH w="w-36" />
        <div className="space-y-3 mt-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Sk.Circle size={16} />
              <Sk.Line w="w-40" />
              <Sk.Line w="w-20" className="ml-auto" />
            </div>
          ))}
        </div>
      </Sk.Card>

      {/* Daily Focus heading */}
      <div className="flex items-center justify-between">
        <Sk.LineH w="w-28" />
        <Sk.Line h="h-2" w="w-16" />
      </div>

      {/* CTA button */}
      <Sk.Block h="h-12" className="rounded-full" />

      {/* FitnessQuickActions — carrusel de actividades */}
      <Sk.Card>
        <Sk.Line h="h-2" w="w-32" />
        <div className="flex gap-2 overflow-hidden pb-1 mt-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Sk.Block key={i} h="h-16" w="w-14" className="flex-shrink-0 rounded-xl" />
          ))}
        </div>
      </Sk.Card>

    </div>
  );
}

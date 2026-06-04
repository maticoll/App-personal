// components/ui/skeletons/SleepSkeleton.tsx
import { Sk } from "./SkeletonBase";

export default function SleepSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando...">

      {/* Header */}
      <div className="flex items-center gap-2">
        <Sk.Circle size={20} />
        <Sk.LineH w="w-20" />
      </div>

      {/* QuickActions — 2 botones pill */}
      <Sk.Card>
        <div className="flex gap-3">
          <Sk.Block h="h-10" className="rounded-full" />
          <Sk.Block h="h-10" className="rounded-full" />
        </div>
      </Sk.Card>

      {/* TodayCard */}
      <Sk.Card>
        <Sk.LineH w="w-24" />
        <Sk.LineH h="h-8" w="w-20" />
        <div className="flex gap-4 mt-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Sk.Block key={i} h="h-14" />
          ))}
        </div>
      </Sk.Card>

      {/* WeekStats — 4 pills */}
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Sk.Card key={i} className="p-3 text-center space-y-1">
            <Sk.LineH h="h-5" w="w-8" className="mx-auto" />
            <Sk.Line h="h-3" w="w-12" className="mx-auto" />
          </Sk.Card>
        ))}
      </div>

      {/* TabNav */}
      <Sk.TabNav />

      {/* Charts */}
      <Sk.Card><Sk.Block h="h-40" /></Sk.Card>
      <Sk.Card><Sk.Block h="h-32" /></Sk.Card>
      <Sk.Card><Sk.Block h="h-32" /></Sk.Card>

    </div>
  );
}

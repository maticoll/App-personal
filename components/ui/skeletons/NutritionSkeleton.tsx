// components/ui/skeletons/NutritionSkeleton.tsx
import { Sk } from "./SkeletonBase";

export default function NutritionSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando...">

      {/* Header */}
      <div className="flex items-center gap-2">
        <Sk.Circle size={20} />
        <Sk.LineH w="w-24" />
      </div>

      {/* WaterTracker */}
      <Sk.Card>
        <div className="flex justify-between">
          <Sk.Line w="w-24" />
          <Sk.Line w="w-16" />
        </div>
        <Sk.Block h="h-3" className="rounded-full mt-2" />
        <div className="flex gap-2 mt-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Sk.Block key={i} h="h-8" className="rounded-full" />
          ))}
        </div>
      </Sk.Card>

      {/* QuickActions NLP */}
      <Sk.Card>
        <Sk.Block h="h-10" className="rounded-lg" />
      </Sk.Card>

      {/* MealLogCards × 3 */}
      {Array.from({ length: 3 }).map((_, i) => (
        <Sk.Card key={i}>
          <div className="flex justify-between">
            <Sk.LineH w="w-20" />
            <Sk.Line w="w-16" />
          </div>
          <Sk.Line h="h-3" w="w-40" />
        </Sk.Card>
      ))}

      {/* MacrosChart */}
      <Sk.Card><Sk.Block h="h-40" /></Sk.Card>

      {/* WeekStats */}
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Sk.Card key={i} className="text-center space-y-1">
            <Sk.LineH h="h-5" w="w-12" className="mx-auto" />
            <Sk.Line h="h-3" w="w-16" className="mx-auto" />
          </Sk.Card>
        ))}
      </div>

    </div>
  );
}

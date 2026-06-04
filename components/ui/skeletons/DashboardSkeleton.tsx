// components/ui/skeletons/DashboardSkeleton.tsx
import { Sk } from "./SkeletonBase";

export default function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando...">

      {/* Saludo */}
      <section className="space-y-1">
        <Sk.LineH w="w-44" />
        <Sk.Line w="w-32" h="h-3" />
      </section>

      {/* Score Ring */}
      <section className="flex justify-center">
        <Sk.Circle size={120} />
      </section>

      {/* Bento grid 2×3 */}
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Sk.Card key={i} className="aspect-square flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <Sk.Line w="w-16" h="h-2" />
              <Sk.Circle size={20} />
            </div>
            <div className="space-y-1.5">
              <Sk.LineH w="w-10" />
              <Sk.Line w="w-24" h="h-2" />
            </div>
          </Sk.Card>
        ))}
      </div>

      {/* TasksBlock */}
      <Sk.Card>
        <Sk.Line w="w-36" />
        <div className="space-y-2 mt-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Sk.Circle size={16} />
              <Sk.Line w="w-48" />
            </div>
          ))}
        </div>
      </Sk.Card>

      {/* Garmin Sync button */}
      <div className="flex justify-center">
        <Sk.Block h="h-11" w="w-44" className="rounded-full" />
      </div>

    </div>
  );
}

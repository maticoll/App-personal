// components/ui/skeletons/ProjectsSkeleton.tsx
import { Sk } from "./SkeletonBase";

export default function ProjectsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando...">

      {/* Header */}
      <div className="flex items-center gap-2">
        <Sk.Circle size={20} />
        <Sk.LineH w="w-24" />
      </div>

      {/* Project cards × 4 */}
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Sk.Card key={i}>
            <div className="flex justify-between items-start">
              <Sk.LineH w="w-40" />
              <Sk.Block h="h-6" w="w-20" className="rounded-full" />
            </div>
            <Sk.Line h="h-3" w="w-full" />
            <Sk.Line h="h-3" w="w-3/4" />
            <div className="flex gap-2 mt-1">
              <Sk.Block h="h-5" w="w-16" className="rounded-full" />
              <Sk.Line h="h-3" w="w-20" className="ml-auto" />
            </div>
          </Sk.Card>
        ))}
      </div>

    </div>
  );
}

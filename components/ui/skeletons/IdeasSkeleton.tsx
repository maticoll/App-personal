// components/ui/skeletons/IdeasSkeleton.tsx
import { Sk } from "./SkeletonBase";

export default function IdeasSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Cargando...">

      {/* Header */}
      <div className="flex items-center gap-2">
        <Sk.Circle size={20} />
        <Sk.LineH w="w-16" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Sk.Card key={i} className="text-center space-y-1">
            <Sk.LineH h="h-6" w="w-8" className="mx-auto" />
            <Sk.Line h="h-3" w="w-14" className="mx-auto" />
          </Sk.Card>
        ))}
      </div>

      {/* Capture form */}
      <Sk.Card>
        <div className="flex gap-2 items-center">
          <Sk.Circle size={16} />
          <Sk.Line w="w-24" />
        </div>
        <Sk.Block h="h-16" className="rounded-lg mt-2" />
        <div className="flex gap-2 mt-3 flex-wrap">
          {Array.from({ length: 4 }).map((_, i) => (
            <Sk.Block key={i} h="h-6" w="w-16" className="rounded-full" />
          ))}
          <Sk.Block h="h-7" w="w-20" className="rounded-lg ml-auto" />
        </div>
      </Sk.Card>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <Sk.Block key={i} h="h-7" w="w-20" className="rounded-full flex-shrink-0" />
        ))}
      </div>

      {/* Search input */}
      <Sk.Block h="h-9" className="rounded-lg" />

      {/* Idea cards */}
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Sk.Card key={i} className="space-y-0">
            <div className="flex gap-3 items-start">
              <Sk.Circle size={8} className="mt-1.5" />
              <div className="flex-1 space-y-1">
                <Sk.LineH w="w-48" />
                <div className="flex gap-1">
                  <Sk.Block h="h-4" w="w-12" className="rounded-full" />
                  <Sk.Block h="h-4" w="w-12" className="rounded-full" />
                </div>
              </div>
              <Sk.Block h="h-5" w="w-16" className="rounded-full ml-auto flex-shrink-0" />
            </div>
          </Sk.Card>
        ))}
      </div>

    </div>
  );
}

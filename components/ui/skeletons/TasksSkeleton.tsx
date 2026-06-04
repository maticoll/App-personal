// components/ui/skeletons/TasksSkeleton.tsx
import { Sk } from "./SkeletonBase";

export default function TasksSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Cargando...">

      {/* Header */}
      <div className="flex items-center gap-2">
        <Sk.Circle size={20} />
        <Sk.LineH w="w-16" />
      </div>

      {/* Sección A: Pendientes */}
      <section>
        <div className="flex justify-between items-center mb-3">
          <Sk.Line h="h-2" w="w-20" />
          <Sk.Block h="h-5" w="w-8" className="rounded-full" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Sk.Card key={i} className="space-y-0">
              <div className="flex gap-3 items-center">
                <Sk.Circle size={18} />
                <div className="flex-1 space-y-1">
                  <Sk.Line w="w-48" />
                  <Sk.Line h="h-3" w="w-32" />
                </div>
              </div>
            </Sk.Card>
          ))}
        </div>
      </section>

      {/* Sección B: Tablero — CRÍTICO no omitir */}
      <section>
        <div className="flex justify-between items-center mb-3">
          <Sk.Line h="h-2" w="w-16" />
          <div className="flex gap-2">
            <Sk.Block h="h-7" w="w-20" className="rounded-full" />
            <Sk.Block h="h-7" w="w-28" className="rounded-xl" />
          </div>
        </div>
        <Sk.Block h="h-64" className="rounded-2xl" />
      </section>

      {/* Sección C: Tareas terminadas */}
      <section>
        <Sk.Line h="h-2" w="w-32" className="mb-3" />
        <div className="space-y-2 opacity-60">
          {Array.from({ length: 3 }).map((_, i) => (
            <Sk.Card key={i} className="space-y-0">
              <div className="flex gap-3 items-center">
                <Sk.Circle size={18} />
                <Sk.Line w="w-40" />
              </div>
            </Sk.Card>
          ))}
        </div>
      </section>

    </div>
  );
}

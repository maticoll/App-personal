// components/ui/skeletons/SettingsSkeleton.tsx
import { Sk } from "./SkeletonBase";

export default function SettingsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando...">

      {/* Header */}
      <div className="flex items-center gap-2">
        <Sk.Circle size={20} />
        <Sk.LineH w="w-28" />
      </div>

      {/* 4 secciones de settings */}
      {Array.from({ length: 4 }).map((_, section) => (
        <Sk.Card key={section} className="space-y-4">
          <Sk.Line h="h-2" w="w-24" />
          {Array.from({ length: 3 }).map((_, row) => (
            <div key={row} className="flex justify-between items-center">
              <div className="space-y-1">
                <Sk.Line w="w-32" />
                <Sk.Line h="h-3" w="w-48" />
              </div>
              <Sk.Block h="h-7" w="w-12" className="rounded-full flex-shrink-0 ml-4" />
            </div>
          ))}
        </Sk.Card>
      ))}

    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const MOBILE_NAV = [
  { href: "/", icon: "dashboard", label: "Inicio" },
  { href: "/fitness", icon: "fitness_center", label: "Fitness" },
  { href: "/sleep", icon: "bedtime", label: "Sueño" },
  { href: "/projects", icon: "folder", label: "Proyectos" },
  { href: "/settings", icon: "person", label: "Perfil" },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-md z-50 flex justify-around items-center h-16 px-4 py-2 bg-surface-container/60 backdrop-blur-md border border-outline-variant/20 rounded-full shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0px)" }}
    >
      {MOBILE_NAV.map(({ href, icon, label }) => {
        const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center justify-center transition-all active:scale-90 duration-150",
              isActive
                ? "text-primary drop-shadow-[0_0_8px_rgba(192,193,255,0.5)]"
                : "text-on-surface-variant opacity-60 hover:opacity-100"
            )}
          >
            <span
              className="material-symbols-outlined"
              style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {icon}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

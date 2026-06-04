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
      className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-24px)] max-w-md z-50 flex justify-around items-center h-[60px] px-2 bg-surface-container/70 backdrop-blur-xl border border-outline-variant/20 rounded-[28px] shadow-[0_16px_40px_rgba(0,0,0,0.5)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {MOBILE_NAV.map(({ href, icon, label }) => {
        const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 min-w-[52px] h-full transition-all active:scale-90 duration-150 rounded-2xl px-1",
              isActive
                ? "text-primary drop-shadow-[0_0_8px_rgba(192,193,255,0.5)]"
                : "text-on-surface-variant opacity-55 hover:opacity-100"
            )}
          >
            <span
              className="material-symbols-outlined text-[22px] leading-none"
              style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {icon}
            </span>
            <span className={cn(
              "text-[9px] font-medium leading-none tracking-wide",
              isActive ? "opacity-100" : "opacity-80"
            )}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

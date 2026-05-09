"use client";

// ============================================================
// BottomNav — Navegación inferior (mobile, iPhone 14)
// Se muestra en pantallas menores a md (768px)
// Incluye safe area inset para el home indicator de iOS
// ============================================================

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Moon,
  Dumbbell,
  Salad,
  FolderKanban,
  Lightbulb,
  Wallet,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Solo los 5 más usados en mobile para no saturar
const MOBILE_NAV = [
  { href: "/", label: "Inicio", icon: LayoutDashboard },
  { href: "/sleep", label: "Sueño", icon: Moon },
  { href: "/fitness", label: "Fitness", icon: Dumbbell },
  { href: "/nutrition", label: "Nutrición", icon: Salad },
  { href: "/scoring", label: "Score", icon: BarChart3 },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--surface)] border-t border-[var(--border)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch justify-around px-2 pt-2 pb-1">
        {MOBILE_NAV.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors min-w-[56px]",
                isActive
                  ? "text-[var(--accent)]"
                  : "text-[var(--text-muted)]"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

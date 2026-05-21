"use client";

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
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, color: "text-primary" },
  { href: "/sleep", label: "Sueno", icon: Moon, color: "text-module-sleep" },
  { href: "/fitness", label: "Fitness", icon: Dumbbell, color: "text-module-fitness" },
  { href: "/nutrition", label: "Nutricion", icon: Salad, color: "text-module-nutrition" },
  { href: "/projects", label: "Proyectos", icon: FolderKanban, color: "text-module-projects" },
  { href: "/ideas", label: "Ideas", icon: Lightbulb, color: "text-module-ideas" },
  { href: "/finances", label: "Finanzas", icon: Wallet, color: "text-module-finances" },
  { href: "/scoring", label: "Scoring", icon: BarChart3, color: "text-module-scoring" },
] as const;

interface SidebarProps {
  userName?: string | null;
}

export function Sidebar({ userName }: SidebarProps = {}) {
  const pathname = usePathname();
  const firstName = userName?.split(" ")[0] ?? "CLAUDIO";
  const initial   = firstName[0]?.toUpperCase() ?? "C";

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen sticky top-0 border-r border-outline-variant/20 bg-surface-container-low px-4 py-6 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-2 mb-8">
        <div className="w-8 h-8 rounded-xl bg-primary-container flex items-center justify-center text-on-primary font-bold text-sm">
          {initial}
        </div>
        <span className="font-semibold text-on-surface">{firstName}</span>
      </div>

      {/* Navegacion */}
      <nav className="flex-1 flex flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon, color }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-sm font-medium",
                isActive
                  ? "bg-primary-container/20 text-primary"
                  : "text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"
              )}
            >
              <Icon
                className={cn(
                  "w-5 h-5 shrink-0",
                  isActive ? "text-primary" : color
                )}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer del sidebar */}
      <div className="flex items-center justify-between pt-4 border-t border-outline-variant/20">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
            pathname.startsWith("/settings")
              ? "text-primary"
              : "text-on-surface-variant hover:bg-surface-container-highest"
          )}
        >
          <Settings className="w-4.5 h-4.5" />
          Configuracion
        </Link>
        <ThemeToggle />
      </div>
    </aside>
  );
}

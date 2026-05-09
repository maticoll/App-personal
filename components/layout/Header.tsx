"use client";

// ============================================================
// Header — Cabecera mobile (solo visible en pantallas <md)
// Muestra el título del módulo actual y botones de acción
// ============================================================

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Settings } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/sleep": "Sueño",
  "/fitness": "Fitness",
  "/nutrition": "Nutrición",
  "/projects": "Proyectos",
  "/ideas": "Ideas",
  "/finances": "Finanzas",
  "/scoring": "Scoring",
  "/settings": "Configuración",
};

export function Header() {
  const pathname = usePathname();

  // Obtener el título de la página actual
  const title =
    Object.entries(PAGE_TITLES).find(([path]) =>
      path === "/" ? pathname === "/" : pathname.startsWith(path)
    )?.[1] ?? "App Personal";

  return (
    <header className="md:hidden sticky top-0 z-40 bg-[var(--surface)] border-b border-[var(--border)]"
      style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="flex items-center justify-between px-4 h-14">
        {/* Logo + Título */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center text-white font-bold text-xs">
            A
          </div>
          <h1 className="font-semibold text-[var(--text-primary)]">{title}</h1>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link
            href="/settings"
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] transition-colors"
          >
            <Settings className="w-4.5 h-4.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

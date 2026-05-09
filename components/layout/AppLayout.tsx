// ============================================================
// AppLayout — Wrapper de layout para todas las páginas autenticadas
// Desktop: Sidebar fijo izquierda + contenido derecha
// Mobile: Header + contenido + BottomNav fija
// ============================================================

import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      {/* Desktop: Sidebar */}
      <Sidebar />

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile: Header */}
        <Header />

        {/* Página */}
        <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile: Bottom Navigation */}
      <BottomNav />
    </div>
  );
}

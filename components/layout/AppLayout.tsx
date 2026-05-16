import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop: Sidebar */}
      <Sidebar />

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header — visible siempre */}
        <Header />

        {/* Página */}
        <main className="flex-1 pb-32 md:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile: Bottom Navigation flotante */}
      <div className="md:hidden">
        <BottomNav />
      </div>
    </div>
  );
}

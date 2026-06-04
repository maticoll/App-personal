import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";
import { auth } from "@/auth";

interface AppLayoutProps {
  children: React.ReactNode;
}

export async function AppLayout({ children }: AppLayoutProps) {
  const session = await auth();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop: Sidebar */}
      <Sidebar userName={session?.user?.name} />

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header — visible siempre */}
        <Header
          userImage={session?.user?.image}
          userName={session?.user?.name}
        />

        {/* Pagina */}
        <main className="flex-1 px-4 pt-4 pb-[100px] md:px-6 md:pt-6 md:pb-8 max-w-lg mx-auto w-full md:max-w-none">
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

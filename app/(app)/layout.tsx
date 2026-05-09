// ============================================================
// Layout de la app autenticada
// Envuelve todas las páginas con el AppLayout (sidebar/nav)
// La autenticación se maneja en middleware.ts
// ============================================================

import { AppLayout } from "@/components/layout/AppLayout";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}

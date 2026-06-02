import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import ActiveWorkoutClient from "@/components/fitness/ActiveWorkoutClient";

export default async function SessionPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return (
    <Suspense
      fallback={
        <div className="max-w-md mx-auto py-10 text-center text-outline">
          Cargando…
        </div>
      }
    >
      <ActiveWorkoutClient />
    </Suspense>
  );
}
